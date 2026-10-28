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
  /** The demo LMS bundled with this app: its users are the demo workspace's own users. */
  builtin?: boolean;
};
export const DEMO_LMS = {
  clientId: "teamtrack-demo",
  deploymentId: "css474-demo",
  courseId: "css474-fall-2026",
};
export function registrations(): Registration[] {
  const list: Registration[] = [];
  if (process.env.LTI_REGISTRATION)
    list.push(JSON.parse(process.env.LTI_REGISTRATION));
  const app = process.env.APP_URL;
  if (app && process.env.LMS_PRIVATE_JWK && process.env.DEMO_MODE !== "false")
    list.push({
      issuer: app + "/lms",
      clientId: DEMO_LMS.clientId,
      deploymentId: DEMO_LMS.deploymentId,
      authUrl: app + "/lms/api/authorize",
      tokenUrl: app + "/lms/api/token",
      jwksUrl: app + "/lms/api/jwks",
      origin: new URL(app).origin,
      builtin: true,
    });
  return list;
}
function registration(issuer: string): Registration {
  const r = registrations().find((x) => x.issuer === issuer);
  if (!r) throw Error("Unregistered Canvas platform");
  return r;
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
  const r = registration(issuer);
  assertRegistration(r, issuer, clientId);
  if (!sql) throw Error("Database required");
  await init();
  await sql`CREATE TABLE IF NOT EXISTS teamtrack_launch (state text PRIMARY KEY, nonce text NOT NULL, expires_at timestamptz NOT NULL)`;
  await sql`ALTER TABLE teamtrack_launch ADD COLUMN IF NOT EXISTS issuer text`;
  const state = randomUUID(),
    nonce = randomUUID();
  await sql`INSERT INTO teamtrack_launch (state,nonce,expires_at,issuer) VALUES (${state},${nonce},now()+interval '5 minutes',${r.issuer})`;
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
  if (!sql) throw Error("Database required");
  const rows =
    await sql`DELETE FROM teamtrack_launch WHERE state=${state} AND expires_at>now() RETURNING nonce,issuer`;
  if (rows.length !== 1) throw Error("Launch expired or already used");
  const r = registration(rows[0].issuer);
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
  if (r.builtin) return finishDemoLaunch(v, payload);
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
    active: true,
  };
  await init();
  await sql.begin(async (tx) => {
    const fresh = seed();
    fresh.course = String(
      (payload[claim + "context"] as { title?: string }).title ||
        "Canvas course",
    );
    fresh.project = "Your team project";
    fresh.description =
      "Set your project brief, form teams and agree on the next checkpoint.";
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
  await connectRoster(namespace, v.role, payload);
  return { namespace, userId };
}
/** The demo LMS course is the demo workspace; its user ids are the workspace's own. */
async function finishDemoLaunch(
  v: ReturnType<typeof validateClaims>,
  payload: JWTPayload,
) {
  if (!sql) throw Error("Database required");
  if (v.courseId !== DEMO_LMS.courseId) throw Error("Unknown demo course");
  await init();
  const s = (await sql`SELECT data FROM teamtrack_state WHERE id='demo'`)[0]
    ?.data as State | undefined;
  const user = s?.users.find((u) => u.id === v.subject);
  if (!user || user.role !== v.role) throw Error("Unknown demo participant");
  await connectRoster("demo", v.role, payload);
  return { namespace: "demo", userId: user.id };
}
async function connectRoster(
  namespace: string,
  role: "instructor" | "student",
  payload: JWTPayload,
) {
  if (!sql) throw Error("Database required");
  const nrps = payload[
    "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice"
  ] as { context_memberships_url?: string } | undefined;
  await courseMetadataTable();
  if (role === "instructor") {
    await sql`INSERT INTO teamtrack_course (namespace,membership_url,error) VALUES (${namespace},${nrps?.context_memberships_url || null},${nrps?.context_memberships_url ? null : "Canvas has not granted roster permission. Enable readonly Names and Roles access."}) ON CONFLICT(namespace) DO UPDATE SET membership_url=EXCLUDED.membership_url`;
    if (nrps?.context_memberships_url)
      await requestRosterSync(namespace).catch(() => {});
  }
}
export async function syncCanvasRoster(
  namespace: string,
  membershipUrl: string,
) {
  if (!sql || !process.env.LTI_PRIVATE_JWK)
    throw Error("Roster service not configured");
  const url = new URL(membershipUrl);
  const r = registrations().find(
    (x) => x.origin === url.origin && (namespace === "demo") === !!x.builtin,
  );
  if (!r) throw Error("Unregistered roster host");
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
        id: r.builtin
          ? String(m.user_id)
          : id(r.issuer + r.clientId + String(m.user_id)),
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
    // Keep what TeamTrack already knows (colour, email); take name and role from the roster.
    for (const u of members)
      users.set(u.id, {
        ...u,
        ...users.get(u.id),
        name: u.name,
        role: u.role,
        active: true,
      });
    s.users = [...users.values()];
    await tx`UPDATE teamtrack_state SET data=${tx.json(s)} WHERE id=${namespace}`;
  });
  return members.length;
}

async function courseMetadataTable() {
  if (!sql) throw Error("Database required");
  await sql`CREATE TABLE IF NOT EXISTS teamtrack_course (namespace text PRIMARY KEY, membership_url text, last_sync timestamptz, error text, syncing boolean NOT NULL DEFAULT false, started_at timestamptz)`;
}
export async function integrationStatus(namespace: string) {
  if (!sql) return undefined;
  await courseMetadataTable();
  if (!sql) throw Error("Database required");
  const rows =
    await sql`SELECT last_sync,error FROM teamtrack_course WHERE namespace=${namespace}`;
  // The demo workspace only shows an integration once the demo LMS has launched it.
  if (!rows[0] && namespace === "demo") return undefined;
  return {
    lastSync: rows[0]?.last_sync
      ? new Date(rows[0].last_sync).toISOString()
      : null,
    error: rows[0]?.error || null,
  };
}
export async function requestRosterSync(namespace: string) {
  await courseMetadataTable();
  if (!sql) throw Error("Database required");
  const known =
    await sql`SELECT 1 FROM teamtrack_course WHERE namespace=${namespace}`;
  if (!known.length)
    throw Error(
      "Launch TeamTrack from the course page once to connect the roster.",
    );
  const rows =
    await sql`UPDATE teamtrack_course SET syncing=true,started_at=now() WHERE namespace=${namespace} AND (syncing=false OR started_at<now()-interval '5 minutes') RETURNING membership_url`;
  if (!rows.length)
    throw Error("Roster sync is already running. Try again shortly.");
  try {
    if (!rows[0].membership_url)
      throw Error("Canvas has not granted roster permission.");
    const count = await syncCanvasRoster(namespace, rows[0].membership_url);
    await sql`UPDATE teamtrack_course SET last_sync=now(),error=null,syncing=false WHERE namespace=${namespace}`;
    return count;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Roster sync failed";
    await sql`UPDATE teamtrack_course SET error=${error},syncing=false WHERE namespace=${namespace}`;
    throw e;
  }
}

export function assertRegistration(
  r: Registration,
  issuer: string,
  clientId: string | undefined,
) {
  if (issuer !== r.issuer || (clientId && clientId !== r.clientId))
    throw Error("Unregistered Canvas platform");
}
