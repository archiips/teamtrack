import { afterEach, expect, it, vi } from "vitest";
import { sendMail, mailConfigured } from "../src/lib/mail";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("sends plain-text recovery and reminder mail through the configured Brevo sender", async () => {
  vi.stubEnv("BREVO_API_KEY", "local-test-key");
  vi.stubEnv("EMAIL_FROM", "sender@example.edu");
  vi.stubEnv("RESEND_API_KEY", "");
  const fetcher = vi.fn(async () => new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetcher);
  expect(mailConfigured()).toBe(true);
  await sendMail({
    to: "recipient@example.edu",
    subject: "TeamTrack reminder",
    text: "Review the agreement",
  });
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, options] = fetcher.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("https://api.brevo.com/v3/smtp/email");
  const body = JSON.parse(options.body as string);
  expect(body.sender.email).toBe("sender@example.edu");
  expect(body.to[0].email).toBe("recipient@example.edu");
  expect(body.textContent).toBe("Review the agreement");
});
