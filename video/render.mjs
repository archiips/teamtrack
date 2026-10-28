// Renders stage.html frame by frame. Usage:
//   node video/render.mjs --stills 1,5.5,12   -> work/stills/*.png
//   node video/render.mjs [--cut short|v2]     -> work/video-noaudio[-short|-v2].mp4
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const cutArg = process.argv.indexOf("--cut");
const CUT = cutArg > 0 ? process.argv[cutArg + 1] : "long";
const FPS = 30,
  DURATION = { long: 60, short: 19, v2: 20, v3: 14.5 }[CUT];
const SUFFIX = CUT === "long" ? "" : "-" + CUT;
const stillsArg = process.argv.indexOf("--stills");
// v2 is the violet-design pitch video with its own stage and captures.
const V2 = CUT === "v2" || CUT === "v3";
const rects = JSON.parse(
  readFileSync(
    DIR + (V2 ? "work/v2/shots/rects.json" : "work/shots/rects.json"),
    "utf8",
  ),
);

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.addInitScript(
  ([r, cut]) => ((window.RECTS = r), (window.CUT = cut)),
  [rects, CUT],
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(pathToFileURL(DIR + (V2 ? "stage2.html" : "stage.html")).href);
await page.evaluate(() => window.ready);
const frame = async (t) => {
  await page.evaluate((t) => {
    window.render(t);
    return new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }, t);
};

if (stillsArg > 0) {
  mkdirSync(DIR + "work/stills", { recursive: true });
  for (const t of process.argv[stillsArg + 1].split(",").map(Number)) {
    await frame(t);
    await page.screenshot({
      path: `${DIR}work/stills/${CUT}-t${t.toFixed(2)}.png`,
    });
  }
  console.log("stills done", errors.length ? errors : "no errors");
} else {
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      `${DIR}work/video-noaudio${SUFFIX}.mp4`,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const total = FPS * DURATION;
  for (let f = 0; f < total; f++) {
    await frame(f / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf))
      await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("render done", errors.length ? errors : "no errors");
}
await browser.close();
