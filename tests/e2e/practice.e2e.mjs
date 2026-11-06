import { chromium } from "playwright";
const BASE = "http://localhost:3100",
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
async function person(label, vp = { width: 1440, height: 900 }) {
  const p = await (await browser.newContext({ viewport: vp })).newPage();
  p.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  p.on("dialog", (d) => d.accept());
  await p.goto(BASE);
  return p;
}
const hide = (p) =>
  p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
const toast = (p, t) =>
  p.locator(".toast", { hasText: t }).waitFor({ timeout: 10000 });
const step = (p, label) => p.locator(".practice-steps li", { hasText: label });
const ticked = (p, label) =>
  step(p, label).and(p.locator("li.done")).waitFor({ timeout: 10000 });
const signup = async (p, n) => {
  await p.getByRole("tab", { name: "Create account" }).click();
  await p.getByLabel("Full name").fill(`${n} Test`);
  await p.getByLabel("Email").fill(`${n.toLowerCase()}-${run}@school.edu`);
  await p.getByLabel("Password").fill("password123");
  await p.getByRole("button", { name: "Create account" }).last().click();
  await p.getByText("New here? Practice first.").waitFor();
};

const S = await person("S");
await check(
  "new account sees the practice offer and opens it as a student",
  async () => {
    await signup(S, "Stu");
    await hide(S);
    await S.screenshot({ path: `${OUT}/pr-onboard.png` });
    await S.getByRole("button", { name: "As a student" }).click();
    await S.locator(".practice-guide").waitFor();
    await S.getByText("0 of 6 tried").waitFor();
  },
);
await hide(S);
await S.waitForTimeout(1500);
await S.screenshot({ path: `${OUT}/pr-start.png` });
await check("step 1: Show me → move my task to In progress", async () => {
  await step(S, "Move one of your tasks")
    .getByRole("button", { name: "Show me" })
    .click();
  await S.getByText("Draft the survey questions").click();
  await S.locator("dialog.drawer")
    .getByLabel("Status")
    .selectOption("in_progress");
  await toast(S, "Task status updated");
});
await check("step 2: share an update with a link", async () => {
  await S.getByLabel("Contribution or comment").fill("Drafted 8 questions.");
  await S.getByLabel("Evidence link").fill("https://example.com/questions");
  await S.getByRole("button", { name: "Share update" }).click();
  await toast(S, "Contribution recorded");
});
await check("step 3: raise a blocker", async () => {
  await S.getByLabel("Blocker explanation").fill("Need the class email list");
  await S.locator(".blocker-box").getByRole("button", { name: "Save" }).click();
  await toast(S, "Blocker recorded");
  await S.getByRole("button", { name: "Close task" }).click();
  await ticked(S, "Move one of your tasks");
  await ticked(S, "Share an update");
  await ticked(S, "Raise a blocker");
});
await check("step 4: give a teammate a new task", async () => {
  await step(S, "Give a teammate")
    .getByRole("button", { name: "Show me" })
    .click();
  await S.getByRole("button", { name: "New task" }).first().click();
  await S.getByLabel("Task name").fill("Order snacks for the interviews");
  await S.locator("dialog select[name=owner]").selectOption({
    label: "Leo Park",
  });
  await S.getByRole("button", { name: "Create task" }).click();
  await toast(S, "Task created");
  await ticked(S, "Give a teammate");
});
await check("step 5: vote, and the agreement is adopted", async () => {
  await step(S, "Vote on Maya")
    .getByRole("button", { name: "Show me" })
    .click();
  await S.getByRole("button", { name: "Approve" }).click();
  await toast(S, "Vote recorded");
  await S.locator(".version", { hasText: "Version 2" }).first().waitFor();
  await ticked(S, "Vote on Maya");
});
await check("step 6: My team, then all six done", async () => {
  await step(S, "See everyone")
    .getByRole("button", { name: "Show me" })
    .click();
  await ticked(S, "See everyone");
  await S.getByText("You’ve tried everything. You’re ready.").waitFor();
});
await hide(S);
await S.waitForTimeout(800);
await S.screenshot({ path: `${OUT}/pr-done.png` });
await check("progress survives a reload", async () => {
  await S.reload();
  await S.locator(".practice-guide").waitFor();
  await S.getByText("You’ve tried everything").waitFor();
});
await check(
  "finish practice with no real workspace → setup screen",
  async () => {
    await S.getByRole("button", { name: "Finish practice" }).click();
    await S.getByText("Create a workspace").waitFor();
    if (await S.getByText("New here? Practice first.").count())
      throw Error("offer shown while practice exists");
    await S.locator(".workspace-row", {
      hasText: "Practice workspace",
    }).waitFor();
  },
);
await check("switch to instructor practice; steps check off", async () => {
  await S.locator(".workspace-row", { hasText: "Practice workspace" }).click();
  await S.locator(".practice-guide").waitFor();
  await S.getByRole("button", { name: "Try it as an instructor" }).click();
  await S.getByText("Practice as an instructor").waitFor();
  await S.getByText("0 of 5 tried").waitFor();
  await S.locator(".progress-row", { hasText: "Team Nova" }).click();
  await ticked(S, "Open Team Nova");
  await S.locator(".task-row", { hasText: "Set up the repo" }).click();
  await S.getByRole("button", { name: "Comment", exact: true }).click();
  await S.getByLabel("Contribution or comment").fill(
    "I'll add you to the org today.",
  );
  await S.getByRole("button", { name: "Share update" }).click();
  await toast(S, "Comment added");
  await S.getByRole("button", { name: "Close task" }).click();
  await ticked(S, "Comment on Team Nova");
  await step(S, "Put Gus and Hal")
    .getByRole("button", { name: "Show me" })
    .click();
  await S.getByRole("button", { name: "Create team" }).first().click();
  await S.getByLabel("Team name").fill("Team Orbit");
  for (const n of ["Gus Lee", "Hal Diaz"])
    await S.locator("dialog label", { hasText: n }).locator("input").check();
  await S.locator("dialog")
    .getByRole("button", { name: "Create team" })
    .click();
  await toast(S, "Team created");
  await ticked(S, "Put Gus and Hal");
  await step(S, "Rename a checkpoint")
    .getByRole("button", { name: "Show me" })
    .click();
  const row = S.locator("form.checkpoint-row").first();
  await row.locator("input[name=title]").fill("Proposal");
  await row.getByRole("button", { name: "Save" }).click();
  await toast(S, "Checkpoint updated");
  await S.getByRole("button", { name: "Close dialog" }).click();
  await ticked(S, "Rename a checkpoint");
  await step(S, "Read a team").getByRole("button", { name: "Show me" }).click();
  await ticked(S, "Read a team");
});
await check(
  "a real workspace shows the tip, then hides it for good",
  async () => {
    const R = await person("R");
    await signup(R, "Rae");
    await R.getByLabel("Class").fill("CSS 360");
    await R.getByLabel("Project name").fill("Real project");
    await R.getByRole("button", { name: "Create workspace" }).click();
    await R.locator(".practice-tip").waitFor();
    await R.getByRole("button", { name: "Hide this tip" }).click();
    await R.reload();
    await R.locator(".stats").waitFor();
    await R.waitForTimeout(800);
    if (await R.locator(".practice-tip").count()) throw Error("tip came back");
    await R.getByRole("button", { name: "Account and workspaces" }).click();
    await R.getByRole("menuitem", {
      name: /Try the practice workspace/,
    }).click();
    await R.locator(".practice-guide").waitFor();
    await R.getByRole("button", { name: "Leave practice" }).click();
    await R.locator(".project-strip strong", {
      hasText: "Real project",
    }).waitFor();
  },
);
const P = await person("P", { width: 390, height: 844 });
await check("phone: practice guide fits", async () => {
  await signup(P, "Pho");
  await P.getByRole("button", { name: "As a student" }).click();
  await P.locator(".practice-guide").waitFor();
  await hide(P);
  await P.waitForTimeout(1200);
  await P.screenshot({ path: `${OUT}/pr-phone.png` });
  const w = await P.evaluate(() => document.documentElement.scrollWidth);
  if (w > 390) throw Error("overflow " + w);
});
for (const [s, n, e] of results) console.log(s, n, e ? "→ " + e : "");
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
