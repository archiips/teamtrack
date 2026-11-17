import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw Error("Local test app only");
const browser =
  process.env.BROWSER_ENGINE === "webkit"
    ? await webkit.launch()
    : await chromium.launch({ channel: "chrome" });
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 390, height: 500 },
  ]) {
    const p = await browser.newPage({ viewport });
    await p.goto(base);
    await p.request.post(base + "/api/auth/login", {
      headers: { Origin: base },
      data: { email: "alex@teamtrack.test", password: "local-chat-demo-only" },
    });
    await p.reload();
    await p.getByRole("button", { name: "Team chat", exact: true }).click();
    await p.waitForFunction(
      () =>
        !document.querySelector('[aria-label="Message your team"]')?.disabled,
    );
    for (const name of ["Send message", "Attach file"]) {
      const box = await p
        .getByRole("button", { name, exact: true })
        .boundingBox();
      assert.ok(
        box &&
          box.y >= 0 &&
          box.y + box.height <=
            viewport.height - (viewport.width <= 650 ? 62 : 0),
        `${name} must be entirely in viewport ${viewport.width}x${viewport.height}; got ${JSON.stringify(box)}`,
      );
    }
    await p
      .getByLabel("Message your team")
      .fill("The Send control stays visible.");
    const box = await p
      .getByRole("button", { name: "Send message", exact: true })
      .boundingBox();
    assert.ok(
      box.y + box.height <= viewport.height - (viewport.width <= 650 ? 62 : 0),
    );
    await p.getByRole("button", { name: "Send message", exact: true }).click();
    await p.getByText("Message sent", { exact: true }).waitFor();
    // A filename or a validation error must not push Send back below the screen.
    await p.getByLabel("Attach a file", { exact: true }).setInputFiles({
      name: "Very-long-team-document-".repeat(7) + ".txt",
      mimeType: "text/plain",
      buffer: Buffer.from("notes"),
    });
    await p.getByLabel("Attach a file", { exact: true }).setInputFiles({
      name: "too-big.zip",
      mimeType: "application/zip",
      buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
    });
    const errorBox = await p
      .getByRole("button", { name: "Send message", exact: true })
      .boundingBox();
    assert.ok(
      errorBox.y + errorBox.height <=
        viewport.height - (viewport.width <= 650 ? 62 : 0),
      `Send stays visible with a long filename and an error: ${JSON.stringify({ viewport, errorBox })}`,
    );
    await p.screenshot({
      path: `/private/tmp/send-after-${viewport.width}-${viewport.height}.png`,
    });
    if (viewport.width === 390 && viewport.height === 844) {
      await p
        .getByRole("button", { name: "Remove attachment", exact: true })
        .click();
      await p.evaluate(() => {
        Object.defineProperty(window.visualViewport, "height", {
          configurable: true,
          value: 500,
        });
        window.visualViewport.dispatchEvent(new Event("resize"));
      });
      await p.waitForFunction(
        () =>
          document.documentElement.style.getPropertyValue(
            "--chat-viewport-height",
          ) === "500px",
      );
      const keyboardBox = await p
        .getByRole("button", { name: "Send message", exact: true })
        .boundingBox();
      assert.ok(
        keyboardBox.y + keyboardBox.height <= 438,
        "Send remains in the visual viewport when a mobile keyboard opens",
      );
    }
    await p.close();
    console.log("PASS visible Send and Attach", viewport);
  }
} finally {
  await browser.close();
}
