// A stand-in for GitHub: OAuth, app install, installation tokens, commits, pulls.
import http from "node:http";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { jwtVerify } from "jose";
// Run: node tests/e2e/github-mock.mjs <key-file>  (see tests/e2e/README.md)
const APP = "http://localhost:3100",
  PORT = 3999;
let privateKey;
if (existsSync(process.argv[2]))
  privateKey = createPrivateKey(
    Buffer.from(readFileSync(process.argv[2], "utf8"), "base64").toString(
      "utf8",
    ),
  );
else {
  privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  writeFileSync(
    process.argv[2],
    Buffer.from(privateKey.export({ type: "pkcs1", format: "pem" })).toString(
      "base64",
    ),
  );
}
const publicKey = createPublicKey(privateKey);
let as = "olive"; // who is "signed in to GitHub"
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();
const installs = {
  101: { owner: "olive", repos: ["olive/food-app"], users: ["olive", "milo"] },
  202: { owner: "stranger", repos: ["stranger/secret"], users: ["stranger"] },
};
const commits = {
  "olive/food-app": [
    ["olive", "Add menu page", 1],
    ["milo", "Fix login bug", 2],
    ["olive", "Set up CI", 3],
    [null, "WIP from laptop", 4],
    ["milo", "Add dining hall API", 9],
  ],
  "olive/second-repo": [["olive", "Init", 20]],
  "stranger/secret": [["stranger", "secret stuff", 1]],
};
const log = [];
const json = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
http
  .createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`);
    const auth = (req.headers.authorization || "").replace("Bearer ", "");
    log.push(`${req.method} ${u.pathname}`);
    let body = "";
    for await (const c of req) body += c;
    if (u.pathname === "/_mock/as") {
      as = u.searchParams.get("login");
      return json(res, 200, { as });
    }
    if (u.pathname === "/_mock/addrepo") {
      installs[101].repos.push(u.searchParams.get("repo"));
      return json(res, 200, {});
    }
    if (u.pathname === "/_mock/log") return json(res, 200, log);
    if (u.pathname === "/login/oauth/authorize") {
      const back = new URL(u.searchParams.get("redirect_uri"));
      back.searchParams.set("code", "code_" + as);
      back.searchParams.set("state", u.searchParams.get("state"));
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    const inst = u.pathname.match(/^\/apps\/[^/]+\/installations\/new$/);
    if (inst) {
      // "installs" on Olive's repo, then GitHub asks for sign-in and returns to the callback
      const back = new URL(APP + "/api/github/callback");
      back.searchParams.set("code", "code_" + as);
      back.searchParams.set("installation_id", "101");
      back.searchParams.set("setup_action", "install");
      back.searchParams.set("state", u.searchParams.get("state"));
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }
    if (u.pathname === "/login/oauth/access_token") {
      const b = JSON.parse(body);
      if (b.client_secret !== "test-secret") return json(res, 401, {});
      return json(res, 200, {
        access_token: "utok_" + b.code.replace("code_", ""),
      });
    }
    if (u.pathname === "/user")
      return json(res, 200, { login: auth.replace("utok_", "") });
    if (u.pathname === "/user/installations") {
      const who = auth.replace("utok_", "");
      return json(res, 200, {
        installations: Object.entries(installs)
          .filter(([, i]) => i.users.includes(who))
          .map(([id]) => ({ id: +id })),
      });
    }
    const ur = u.pathname.match(/^\/user\/installations\/(\d+)\/repositories$/);
    if (ur) {
      const who = auth.replace("utok_", ""),
        i = installs[ur[1]];
      if (!i?.users.includes(who)) return json(res, 404, {});
      return json(res, 200, {
        repositories: i.repos.map((r) => ({ full_name: r, private: true })),
      });
    }
    const at = u.pathname.match(/^\/app\/installations\/(\d+)\/access_tokens$/);
    if (at) {
      try {
        const { payload } = await jwtVerify(auth, publicKey, {
          algorithms: ["RS256"],
        });
        if (payload.iss !== "12345") throw Error("iss");
      } catch (e) {
        console.log("jwt reject:", e.code, e.message);
        return json(res, 401, { message: "bad app jwt" });
      }
      return json(res, 201, {
        token: "itok_" + at[1],
        expires_at: new Date(Date.now() + 3600e3).toISOString(),
      });
    }
    const rp = u.pathname.match(/^\/repos\/([^/]+\/[^/]+)\/(commits|pulls)$/);
    if (rp) {
      const id = auth.replace("itok_", "");
      if (!installs[id]?.repos.includes(rp[1]))
        return json(res, 404, { message: "Not Found" });
      if (rp[2] === "pulls")
        return json(res, 200, [
          {
            number: 7,
            title: "Menu page",
            html_url: "x",
            merged_at: day(1),
            user: { login: "olive" },
          },
          {
            number: 6,
            title: "Draft",
            html_url: "x",
            merged_at: null,
            user: { login: "milo" },
          },
        ]);
      return json(
        res,
        200,
        (commits[rp[1]] || []).map(([login, msg, d], k) => ({
          sha: "abc" + k + "def0000",
          html_url: `https://example.test/c/${k}`,
          author: login ? { login } : null,
          commit: {
            message: msg + "\n\nbody",
            author: {
              name: login ? login + " name" : "Laptop User",
              date: day(d),
            },
          },
        })),
      );
    }
    json(res, 404, { message: "mock: no route " + u.pathname });
  })
  .listen(PORT, () => console.log("ghmock on", PORT));
