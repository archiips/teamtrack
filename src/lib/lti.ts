import {
  createRemoteJWKSet,
  jwtVerify,
  importJWK,
  SignJWT,
  JWTPayload,
} from "jose";
import { createHash, randomUUID } from "node:crypto";
import { sql, init } from "./store";
import { seed } from "./seed";
import { State, User } from "./types";
export const claim = "https://purl.imsglobal.org/spec/lti/claim/";
export type Registration = {
  issuer: string;
  clientId: string;
  deploymentId: string;
  authUrl: string;
  tokenUrl: string;
  jwksUrl: string;
  origin: string;
};
export function registration(): Registration {
  if (!process.env.LTI_REGISTRATION)
    throw Error("Canvas integration is not configured");
  return JSON.parse(process.env.LTI_REGISTRATION);
}
export function validateClaims(
  p: JWTPayload,
  nonce: string,
  deployment: string,
) {
  if (
    p.nonce !== nonce ||
    p[claim + "deployment_id"] !== deployment ||
    p[claim + "version"] !== "1.3.0" ||
    p[claim + "message_type"] !== "LtiResourceLinkRequest"
  )
    throw Error("Invalid LTI launch");
  const context = p[claim + "context"] as { id?: string } | undefined;
  const roles = p[claim + "roles"];
  if (!p.sub || !context?.id || !Array.isArray(roles))
    throw Error("Missing course identity");
  const role = roles.includes(
    "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  )
    ? "instructor"
    : roles.includes(
          "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
        )
      ? "student"
      : null;
  if (!role) throw Error("Unsupported Canvas role");
  return { subject: p.sub, courseId: context.id, role } as const;
}
export async function beginLaunch(
  issuer: string,
  clientId: string | undefined,
  loginHint: string,
  messageHint: string | undefined,
) {
  const r = registration();
  if (issuer !== r.issuer || (clientId && clientId !== r.clientId))
    throw Error("Unregistered Canvas platform");
  if (!sql) throw Error("Database required");
  await init();
  await sql`CREATE TABLE IF NOT EXISTS teamtrack_launch (state text PRIMARY KEY, nonce text NOT NULL, expires_at timestamptz NOT NULL)`;
  const state = randomUUID(),
    nonce = randomUUID();
  await sql`INSERT INTO teamtrack_launch VALUES (${state},${nonce},now()+interval '5 minutes')`;
  const url = new URL(r.authUrl);
  url.search = new URLSearchParams({
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: r.clientId,
    redirect_uri: process.env.APP_URL + "/api/lti/launch",
    login_hint: loginHint,
    state,
    nonce,
    ...(messageHint ? { lti_message_hint: messageHint } : {}),
  }).toString();
  return url;
}
function id(v: string) {
  return createHash("sha256").update(v).digest("hex").slice(0, 32);
}
export async function finishLaunch(state: string, token: string) {
  const r = registration();
  if (!sql) throw Error("Database required");
  const rows =
    await sql`DELETE FROM teamtrack_launch WHERE state=${state} AND expires_at>now() RETURNING nonce`;
  if (rows.length !== 1) throw Error("Launch expired or already used");
  const { payload } = await jwtVerify(
    token,
    createRemoteJWKSet(new URL(r.jwksUrl)),
    {
      issuer: r.issuer,
      audience: r.clientId,
      algorithms: ["RS256"],
      maxTokenAge: "5m",
      clockTolerance: 10,
    },
  );
  if (
    Array.isArray(payload.aud) &&
    payload.aud.length > 1 &&
    payload.azp !== r.clientId
  )
    throw Error("Invalid authorized party");
  const v = validateClaims(payload, rows[0].nonce, r.deploymentId);
  const namespace =
    "canvas-" + id(r.issuer + r.clientId + r.deploymentId + v.courseId);
  const userId = id(r.issuer + r.clientId + v.subject);
  const name =
    typeof payload.name === "string" ? payload.name : "Canvas participant";
  const user: User = {
    id: userId,
    name,
    role: v.role,
    initials: name
      .split(" ")
      .map((x) => x[0])
      .slice(0, 2)
      .join(""),
    color: "blue",
  };
  await init();
  await sql.begin(async (tx) => {
    const fresh = seed();
    fresh.course = String(
      (payload[claim + "context"] as { title?: string }).title ||
        "Canvas course",
    );
    fresh.project = "Your team project";
    fresh.users = [];
    fresh.teams = [];
    fresh.tasks = [];
    fresh.entries = [];
    fresh.events = [];
    await tx`INSERT INTO teamtrack_state (id,data) VALUES (${namespace},${tx.json(fresh)}) ON CONFLICT DO NOTHING`;
    const records =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = records[0].data as State;
    const old = s.users.find((x) => x.id === userId);
    if (old) Object.assign(old, user);
    else s.users.push(user);
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
  });
  const nrps = payload[
    "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice"
  ] as { context_memberships_url?: string } | undefined;
  if (v.role === "instructor" && nrps?.context_memberships_url)
    await syncCanvasRoster(namespace, nrps.context_memberships_url).catch(
      () => {
        /* Launch remains usable; explicit sync reports failure. */
      },
    );
  return { namespace, userId };
}
export async function syncCanvasRoster(
  namespace: string,
  membershipUrl: string,
) {
  const r = registration();
  if (!sql || !process.env.LTI_PRIVATE_JWK)
    throw Error("Roster service not configured");
  const url = new URL(membershipUrl);
  if (url.origin !== r.origin) throw Error("Unregistered roster host");
  const jwk = JSON.parse(process.env.LTI_PRIVATE_JWK);
  const key = await importJWK(jwk, "RS256");
  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(r.clientId)
    .setSubject(r.clientId)
    .setAudience(r.tokenUrl)
    .setIssuedAt()
    .setExpirationTime("1m")
    .setJti(randomUUID())
    .sign(key);
  const response = await fetch(r.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      scope:
        "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
    }),
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok) throw Error("Canvas denied roster permission");
  const token = await response.json();
  const members: User[] = [];
  let next: string | null = url.href;
  for (let page = 0; next && page < 20; page++) {
    if (new URL(next).origin !== r.origin)
      throw Error("Invalid pagination host");
    const rr: Response = await fetch(next, {
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        Accept: "application/vnd.ims.lti-nrps.v2.membershipcontainer+json",
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!rr.ok) throw Error("Canvas roster unavailable");
    const data = await rr.json();
    if (!Array.isArray(data.members)) throw Error("Malformed roster");
    for (const m of data.members) {
      if (m.status !== "Active") continue;
      const role = m.roles?.includes(
        "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
      )
        ? "instructor"
        : m.roles?.includes(
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
            )
          ? "student"
          : null;
      if (!role) continue;
      const name = typeof m.name === "string" ? m.name : "Canvas participant";
      members.push({
        id: id(r.issuer + r.clientId + String(m.user_id)),
        name,
        role,
        initials: name
          .split(" ")
          .map((x: string) => x[0])
          .slice(0, 2)
          .join(""),
        color: "blue",
      });
    }
    const link: string | null = rr.headers.get("link");
    next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
  }
  if (next) throw Error("Roster exceeds sync limit");
  await sql.begin(async (tx) => {
    const rows =
      await tx`SELECT data FROM teamtrack_state WHERE id=${namespace} FOR UPDATE`;
    const s = rows[0].data as State;
    const users = new Map(s.users.map((u) => [u.id, { ...u, active: false }]));
    for (const u of members) users.set(u.id, { ...u, active: true });
    s.users = [...users.values()];
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
  });
  return members.length;
}
