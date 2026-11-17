/** Server-only delivery. Provider responses may contain personal data; never log them. */
export function mailConfigured() {
  return Boolean(
    (process.env.BREVO_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim()) &&
    process.env.EMAIL_FROM?.trim(),
  );
}
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
}) {
  if (!mailConfigured()) throw Error("Email delivery is not configured");
  const brevo = !!process.env.BREVO_API_KEY?.trim();
  const sender = process.env.EMAIL_FROM!.trim();
  const email = sender.match(/<([^<>]+)>$/)?.[1] || sender;
  const response = await fetch(
    brevo
      ? "https://api.brevo.com/v3/smtp/email"
      : "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        ...(brevo
          ? { "api-key": process.env.BREVO_API_KEY! }
          : { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        brevo
          ? {
              sender: { email, name: "TeamTrack" },
              to: [{ email: message.to }],
              subject: message.subject,
              textContent: message.text,
            }
          : { from: process.env.EMAIL_FROM, ...message },
      ),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) throw Error("Email delivery is temporarily unavailable");
}
