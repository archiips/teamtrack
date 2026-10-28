import { SignJWT, createRemoteJWKSet, importJWK, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { sessionKey } from "./auth";
import { claim, DEMO_LMS } from "./lti";
import { seed } from "./seed";
import type { User } from "./types";

/*
 * A small LTI 1.3 platform bundled with TeamTrack for live demos: a course page that
 * launches TeamTrack the way Canvas does (OIDC login, signed id_token, Names and Roles).
 * Its people are the synthetic demo accounts.
 */
export const COURSE = {
  id: DEMO_LMS.courseId,
  code: "CSS 474",
  title: "Product development lab",
  term: "Fall 2026",
};
export const app = () => process.env.APP_URL || "http://localhost:3000";
export const lmsIssuer = () => app() + "/lms";
const nrpsUrl = () => app() + "/lms/api/nrps";
const ROLE = {
  instructor: "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
  student: "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
};
const NRPS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

function privateJwk() {
  if (!process.env.LMS_PRIVATE_JWK) throw Error("Demo LMS is not configured");
  return JSON.parse(process.env.LMS_PRIVATE_JWK);
}
export function publicJwks() {
  const { n, e, kid, kty } = privateJwk();
  return { keys: [{ n, e, kid, kty, alg: "RS256", use: "sig" }] };
}
async function sign(payload: Record<string, unknown>) {
  const jwk = privateJwk();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(lmsIssuer())
    .setIssuedAt()
    .setJti(randomUUID());
}
function publicKey() {
  const { kty, n, e } = privateJwk();
  return importJWK({ kty, n, e }, "RS256");
}

/** Everyone enrolled in the demo course. */
export function roster(): User[] {
  return seed().users.filter((u) => u.email);
}

// LMS sign-in is separate from TeamTrack's own session, like a real LMS.
export async function startLmsSession(userId: string) {
  return new SignJWT({ lmsUser: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("demo-lms")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(sessionKey());
}
export async function lmsUser(): Promise<User | null> {
  const token = (await cookies()).get("lms_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), {
      algorithms: ["HS256"],
      audience: "demo-lms",
    });
    return roster().find((u) => u.id === payload.lmsUser) || null;
  } catch {
    return null;
  }
}

export async function idToken(user: User, nonce: string) {
  const [given, ...family] = user.name.replace("Dr. ", "").split(" ");
  return (
    await sign({
      nonce,
      azp: DEMO_LMS.clientId,
      name: user.name,
      given_name: given,
      family_name: family.join(" "),
      email: user.email,
      [claim + "deployment_id"]: DEMO_LMS.deploymentId,
      [claim + "message_type"]: "LtiResourceLinkRequest",
      [claim + "version"]: "1.3.0",
      [claim + "roles"]: [ROLE[user.role]],
      [claim + "context"]: {
        id: COURSE.id,
        label: COURSE.code,
        title: `${COURSE.code} · ${COURSE.title}`,
        type: ["http://purl.imsglobal.org/vocab/lis/v2/course#CourseOffering"],
      },
      [claim + "resource_link"]: { id: "teamtrack-nav", title: "TeamTrack" },
      [claim + "target_link_uri"]: app() + "/api/lti/launch",
      "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice": {
        context_memberships_url: nrpsUrl(),
        service_versions: ["2.0"],
      },
    })
  )
    .setSubject(user.id)
    .setAudience(DEMO_LMS.clientId)
    .setExpirationTime("5m")
    .sign(await importJWK(privateJwk(), "RS256"));
}

/** OAuth client_credentials: TeamTrack proves itself with a JWT signed by its own key. */
export async function issueAccessToken(assertion: string, scope: string) {
  if (!scope.split(" ").includes(NRPS_SCOPE)) throw Error("invalid_scope");
  await jwtVerify(
    assertion,
    createRemoteJWKSet(new URL(app() + "/api/lti/jwks")),
    {
      issuer: DEMO_LMS.clientId,
      subject: DEMO_LMS.clientId,
      audience: app() + "/lms/api/token",
      algorithms: ["RS256"],
      maxTokenAge: "5m",
    },
  );
  const token = await (
    await sign({ scope: NRPS_SCOPE })
  )
    .setSubject(DEMO_LMS.clientId)
    .setAudience(nrpsUrl())
    .setExpirationTime("1h")
    .sign(await importJWK(privateJwk(), "RS256"));
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: 3600,
    scope: NRPS_SCOPE,
  };
}

export async function memberships(authorization: string | null) {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Error("Unauthorized");
  const { payload } = await jwtVerify(token, await publicKey(), {
    issuer: lmsIssuer(),
    audience: nrpsUrl(),
    algorithms: ["RS256"],
  });
  if (payload.scope !== NRPS_SCOPE) throw Error("Unauthorized");
  return {
    id: nrpsUrl(),
    context: {
      id: COURSE.id,
      label: COURSE.code,
      title: `${COURSE.code} · ${COURSE.title}`,
    },
    members: roster().map((u) => ({
      status: "Active",
      user_id: u.id,
      name: u.name,
      email: u.email,
      roles: [ROLE[u.role]],
    })),
  };
}
