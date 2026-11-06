import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
const BASE = "http://localhost:3100",
  MOCK = "http://localhost:3999",
  OUT = process.argv[2],
  run = Date.now().toString(36);
const browser = await chromium.launch({ channel: "chrome" });
const results = [],
  errors = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push([
      "FAIL",
      name,
      String(e.message).split("\n")[0].slice(0, 220),
    ]);
  }
}
async function person(label) {
  const p = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage();
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  p.on("dialog", (d) => d.accept());
  await p.goto(BASE);
  return p;
}
const api = (p, path, body) =>
  p.evaluate(
    async ([path, body]) => {
      const me = await (await fetch("/api/workspace")).json().catch(() => ({}));
      const r = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": me.csrf || "",
        },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json().catch(() => ({})) };
    },
    [path, body],
  );
const signup = (p, n) =>
  api(p, "/api/auth/signup", {
    name: `${n} Test`,
    email: `${n.toLowerCase()}-${run}@school.edu`,
    password: "password123",
  });
const as = (login) => fetch(`${MOCK}/_mock/as?login=${login}`);
const toast = (p, t) =>
  p.locator(".toast", { hasText: t }).waitFor({ timeout: 10000 });
const nav = (p, t) => p.locator(`nav button[title="${t}"]`).click();
const hide = (p) =>
  p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const ready = async (p) => {
  await p.reload();
  await p.locator(".stats").waitFor();
  await hide(p);
};
const st = (p) =>
  p.evaluate(async () => (await (await fetch("/api/workspace")).json()).state);

const O = await person("O"),
  M = await person("M");
await signup(O, "Olive");
await api(O, "/api/workspaces", {
  action: "create",
  role: "student",
  course: "CSS 360",
  project: "Food app",
  team: "Alpha",
  due: "2030-01-15",
});
const code = (await st(O)).inviteCode;
await signup(M, "Milo");
await api(M, "/api/workspaces", { action: "join", code });
await ready(O);
await ready(M);

await check(
  "non-leader can't connect, leader sees the connect button",
  async () => {
    await nav(M, "My team");
    await M.getByText(
      "Your team leader can connect the team’s repo.",
    ).waitFor();
    if (await M.getByText("Connect GitHub repo").count())
      throw Error("member sees connect");
    await nav(O, "My team");
    await O.getByRole("link", { name: "Connect GitHub repo" }).waitFor();
  },
);
await check(
  "leader installs on a private repo and it links in one go",
  async () => {
    await as("olive");
    await O.getByRole("link", { name: "Connect GitHub repo" }).click();
    await toast(O, "GitHub repo connected");
    await O.locator(".github-panel").getByText("olive/food-app").waitFor();
    const me = (await st(O)).users.find((u) => u.name === "Olive Test");
    if (me.github !== "olive")
      throw Error("leader username not auto-set: " + me.github);
  },
);
await check(
  "commits are matched per member; unmatched authors are listed",
  async () => {
    await hide(O);
    const row = (n) => O.locator(".github-panel .member-row", { hasText: n });
    await row("Olive Test")
      .locator(".commit-count", { hasText: "2" })
      .waitFor();
    await row("Milo Test").getByText("No GitHub username yet").waitFor();
    await O.getByText(
      /Not matched to anyone: milo \(2\), Laptop User \(1\)/,
    ).waitFor();
  },
);
await O.waitForTimeout(500);
await O.screenshot({ path: `${OUT}/gh-team.png`, fullPage: true });
await check(
  "a member adds their GitHub username and their commits count",
  async () => {
    await M.reload();
    await M.locator(".stats").waitFor();
    await nav(M, "My team");
    await M.getByLabel("Your GitHub username").fill("@milo");
    await M.locator(".github-login")
      .getByRole("button", { name: "Save" })
      .click();
    await toast(M, "GitHub username saved");
    await M.locator(".github-panel .member-row", { hasText: "Milo Test" })
      .locator(".commit-count", { hasText: "2" })
      .waitFor();
  },
);
await check(
  "Activity shows the repo with recent commits and only merged PRs",
  async () => {
    await nav(M, "Activity");
    await M.locator(".activity-grid .github-panel")
      .getByText("Add menu page")
      .waitFor();
    await M.getByText("#7 Menu page").waitFor();
    if (await M.getByText("#6 Draft").count()) throw Error("unmerged PR shown");
  },
);
await M.waitForTimeout(400);
await hide(M);
await M.screenshot({ path: `${OUT}/gh-activity.png` });
await check(
  "browsers can't link a repo directly, and can't reuse someone's pick",
  async () => {
    const t = (await st(M)).teams[0].id;
    const r = await api(M, "/api/workspace", {
      type: "team.github.link",
      teamId: t,
      installationId: 202,
      repo: "stranger/secret",
    });
    if (r.status === 200) throw Error("direct link accepted");
    const r2 = await api(M, "/api/github/link", {
      pick: "x.eyJ9.y",
      repo: "stranger/secret",
    });
    if (r2.status === 200) throw Error("forged pick accepted");
  },
);
await check(
  "leader disconnects, then picks between several installed repos",
  async () => {
    await fetch(`${MOCK}/_mock/addrepo?repo=olive/second-repo`);
    await O.reload();
    await O.locator(".stats").waitFor();
    await nav(O, "My team");
    await O.getByRole("button", { name: "Disconnect" }).click();
    await toast(O, "Repo disconnected");
    await as("olive");
    await O.getByRole("link", {
      name: "Already installed? Pick the repo",
    }).click();
    await O.getByText("Choose your team’s repo").waitFor();
    await O.locator("dialog").getByText("olive/food-app").waitFor();
    await O.locator("dialog").getByText("olive/second-repo").click();
    await toast(O, "GitHub repo connected");
    await O.locator(".github-panel").getByText("olive/second-repo").waitFor();
  },
);
await check(
  "another team connects its own repo independently (same steps)",
  async () => {
    const T = await person("T");
    await signup(T, "Tara");
    await api(T, "/api/workspaces", {
      action: "create",
      role: "student",
      course: "INFO 340",
      project: "Study app",
      team: "Beta",
      due: "2030-01-15",
    });
    await ready(T);
    await nav(T, "My team");
    await as("stranger");
    await T.getByRole("link", { name: "Connect GitHub repo" }).click();
    await toast(T, "GitHub repo connected");
    await T.locator(".github-panel").getByText("stranger/secret").waitFor();
    await O.reload();
    await O.locator(".stats").waitFor();
    await nav(O, "My team");
    await O.locator(".github-panel").getByText("olive/second-repo").waitFor();
    if (await O.getByText("stranger/secret").count())
      throw Error("leaked across teams");
  },
);
await check(
  "instructor sees repo status per team and a stalled-repo flag",
  async () => {
    const P = await person("P"),
      S = await person("S");
    await signup(P, "Prof");
    await api(P, "/api/workspaces", {
      action: "create",
      role: "instructor",
      course: "CSS 474",
      project: "Studio",
      due: "2030-01-15",
    });
    const pcode = (await st(P)).inviteCode;
    await signup(S, "Sam");
    await api(S, "/api/workspaces", { action: "join", code: pcode });
    const sid = (await st(S)).users.find((u) => u.name === "Sam Test").id;
    await api(P, "/api/workspace", {
      type: "team.create",
      name: "Gamma",
      memberIds: [sid],
    });
    await ready(S);
    await nav(S, "My team");
    await as("olive");
    await S.getByRole("link", {
      name: "Already installed? Pick the repo",
    }).click();
    await S.locator("dialog").getByText("olive/second-repo").click();
    await toast(S, "GitHub repo connected");
    await ready(P);
    await P.locator(".progress-chart .attention-tag", {
      hasText: "No commits in 20d",
    }).waitFor();
    await P.waitForTimeout(2500);
    await P.screenshot({ path: `${OUT}/gh-prof.png` });
    await nav(P, "Teams & people");
    await P.getByText(
      /GitHub: olive\/second-repo · 1 commits · last 20d ago/,
    ).waitFor();
  },
);
await check(
  "webhook: bad signature refused, good one clears the cache",
  async () => {
    const bad = await fetch(BASE + "/api/github/webhook", {
      method: "POST",
      body: "{}",
      headers: { "x-hub-signature-256": "sha256=00" },
    });
    if (bad.status !== 401) throw Error("bad sig " + bad.status);
    const body = JSON.stringify({
      repository: { full_name: "olive/food-app" },
    });
    const sig =
      "sha256=" +
      createHmac("sha256", "hook-secret").update(body).digest("hex");
    const before = execFileSync("/opt/homebrew/opt/postgresql@15/bin/psql", [
      "-h",
      "localhost",
      "-p",
      "54329",
      "-U",
      "tt",
      "teamtrack",
      "-tAc",
      "select count(*) from teamtrack_github_cache where repo='olive/food-app'",
    ])
      .toString()
      .trim();
    const good = await fetch(BASE + "/api/github/webhook", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": sig },
    });
    const after = execFileSync("/opt/homebrew/opt/postgresql@15/bin/psql", [
      "-h",
      "localhost",
      "-p",
      "54329",
      "-U",
      "tt",
      "teamtrack",
      "-tAc",
      "select count(*) from teamtrack_github_cache where repo='olive/food-app'",
    ])
      .toString()
      .trim();
    if (good.status !== 200 || before !== "1" || after !== "0")
      throw Error(`status ${good.status} cache ${before}->${after}`);
  },
);
await check("a forged or expired GitHub callback is refused", async () => {
  await O.goto(BASE + "/api/github/callback?code=code_stranger&state=forged");
  await O.locator(".error-banner").waitFor();
});
for (const [s, n, e] of results) console.log(s, n, e ? "→ " + e : "");
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
