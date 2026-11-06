import { createHmac, createPrivateKey, timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { sql } from "./store";

/*
 * GitHub through a GitHub App: a team leader installs it on their repo (public or
 * private) and TeamTrack reads that repo's commit list and merged pull requests.
 * It never fetches file contents. Linking is verified with the leader's own GitHub
 * sign-in, so nobody can attach a repo they can't access.
 */
const env = () => ({
  appId: process.env.GITHUB_APP_ID,
  slug: process.env.GITHUB_APP_SLUG,
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  key: process.env.GITHUB_APP_PRIVATE_KEY,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  // Overridable so tests can point at a local stand-in for GitHub.
  api: process.env.GITHUB_API_URL || "https://api.github.com",
  web: process.env.GITHUB_WEB_URL || "https://github.com",
});
export function githubEnabled() {
  const e = env();
  return !!(e.appId && e.slug && e.clientId && e.clientSecret && e.key);
}
export const installUrl = (state: string) =>
  `${env().web}/apps/${env().slug}/installations/new?state=${encodeURIComponent(state)}`;
export const authorizeUrl = (state: string, redirect: string) =>
  `${env().web}/login/oauth/authorize?${new URLSearchParams({
    client_id: env().clientId || "",
    redirect_uri: redirect,
    state,
  })}`;

const headers = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "TeamTrack",
});
async function gh<T>(path: string, token: string, init?: RequestInit) {
  const r = await fetch(env().api + path, {
    ...init,
    headers: { ...headers(token), ...init?.headers },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw Error(`GitHub ${r.status} on ${path.split("?")[0]}`);
  return (await r.json()) as T;
}

// The private key may be stored as PEM or base64 of the PEM (easier in some env UIs).
function privateKey() {
  const raw = env().key || "";
  const pem = raw.includes("-----BEGIN")
    ? raw.replace(/\\n/g, "\n")
    : Buffer.from(raw, "base64").toString("utf8");
  return createPrivateKey(pem);
}
async function appJwt() {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 540)
    .setIssuer(String(env().appId))
    .sign(privateKey());
}
const tokens = new Map<number, { token: string; until: number }>();
async function installationToken(installationId: number) {
  const hit = tokens.get(installationId);
  if (hit && hit.until > Date.now() + 60000) return hit.token;
  const t = await gh<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    await appJwt(),
    { method: "POST" },
  );
  tokens.set(installationId, {
    token: t.token,
    until: Date.parse(t.expires_at),
  });
  return t.token;
}

/** Exchanges the OAuth code for the person's GitHub login and the repos they can link. */
export async function linkableRepos(code: string) {
  const e = env();
  const r = await fetch(`${e.web}/login/oauth/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: e.clientId,
      client_secret: e.clientSecret,
      code,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const { access_token: token } = (await r.json()) as { access_token?: string };
  if (!token) throw Error("GitHub sign-in was not completed");
  const me = await gh<{ login: string }>("/user", token);
  const { installations } = await gh<{ installations: { id: number }[] }>(
    "/user/installations?per_page=100",
    token,
  );
  const repos: { installationId: number; repo: string; private: boolean }[] =
    [];
  for (const i of installations) {
    const { repositories } = await gh<{
      repositories: { full_name: string; private: boolean }[];
    }>(`/user/installations/${i.id}/repositories?per_page=100`, token);
    for (const x of repositories)
      repos.push({
        installationId: i.id,
        repo: x.full_name,
        private: x.private,
      });
  }
  return { login: me.login, repos };
}

export type RepoActivity = {
  repo: string;
  url: string;
  commits: {
    sha: string;
    message: string;
    login: string | null;
    name: string;
    at: string;
    url: string;
  }[];
  pulls: {
    number: number;
    title: string;
    login: string;
    at: string;
    url: string;
  }[];
  fetchedAt: string;
};
type Commit = {
  sha: string;
  html_url: string;
  author: { login: string } | null;
  commit: { message: string; author: { name: string; date: string } };
};
type Pull = {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  user: { login: string } | null;
};
let cacheReady: Promise<unknown> | undefined;
async function cache() {
  if (!sql) return null;
  cacheReady ??= sql`CREATE TABLE IF NOT EXISTS teamtrack_github_cache (repo text PRIMARY KEY, fetched_at timestamptz NOT NULL, data jsonb NOT NULL)`;
  await cacheReady;
  return sql;
}
// Pushes clear the cache through the webhook; this bounds staleness without one.
const FRESH_MS = 10 * 60 * 1000;

/** The repo's last 100 commits on its default branch and recently merged pull requests. */
export async function repoActivity(
  installationId: number,
  repo: string,
): Promise<RepoActivity> {
  const key = repo.toLowerCase();
  const db = await cache();
  if (db) {
    const rows =
      await db`SELECT data, fetched_at FROM teamtrack_github_cache WHERE repo=${key}`;
    if (rows[0] && Date.now() - Date.parse(rows[0].fetched_at) < FRESH_MS)
      return rows[0].data as RepoActivity;
  }
  const token = await installationToken(installationId);
  const [commits, pulls] = await Promise.all([
    gh<Commit[]>(`/repos/${repo}/commits?per_page=100`, token),
    gh<Pull[]>(
      `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
      token,
    ),
  ]);
  const data: RepoActivity = {
    repo,
    url: `${env().web}/${repo}`,
    commits: commits.map((c) => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0].slice(0, 200),
      login: c.author?.login ?? null,
      name: c.commit.author.name,
      at: c.commit.author.date,
      url: c.html_url,
    })),
    pulls: pulls
      .filter((p) => p.merged_at)
      .map((p) => ({
        number: p.number,
        title: p.title.slice(0, 200),
        login: p.user?.login ?? "",
        at: p.merged_at!,
        url: p.html_url,
      })),
    fetchedAt: new Date().toISOString(),
  };
  if (db)
    await db`INSERT INTO teamtrack_github_cache (repo, fetched_at, data) VALUES (${key}, now(), ${db.json(data)}) ON CONFLICT (repo) DO UPDATE SET fetched_at=EXCLUDED.fetched_at, data=EXCLUDED.data`;
  return data;
}

/** Checks GitHub's signature on a webhook delivery. */
export function validWebhook(body: string, signature: string | null) {
  const secret = env().webhookSecret;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
  );
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function forgetRepo(repo: string) {
  const db = await cache();
  if (db)
    await db`DELETE FROM teamtrack_github_cache WHERE repo=${repo.toLowerCase()}`;
}
