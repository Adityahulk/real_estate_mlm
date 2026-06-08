/**
 * Email sender — supports two providers, chosen by env vars:
 *
 *  SMTP (Gmail or any SMTP):   set SMTP_HOST, SMTP_USER, SMTP_PASS
 *  Resend:                      set RESEND_API_KEY
 *
 * SMTP takes priority if both are set. Falls back to console log in dev.
 */

const APP_NAME = "Shree Shyam Villa – 2";

function buildHtml(heading: string, body: string, otp: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;background:#f9f9f9;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:28px 32px;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">${APP_NAME}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 8px;font-size:18px;color:#111;">${heading}</h2>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">${body}</p>
            <div style="background:#f3f0ff;border-radius:8px;padding:20px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#7c3aed;font-weight:600;letter-spacing:0.05em;">YOUR OTP</p>
              <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.15em;color:#111;">${otp}</p>
            </div>
            <p style="margin:20px 0 0;font-size:12px;color:#999;">This OTP expires in 15 minutes. Do not share it with anyone.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              © ${new Date().getFullYear()} ${APP_NAME} · Surat, Gujarat
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendEmailOtp(to: string, otp: string, purpose: "VERIFY" | "RESET") {
  const subject =
    purpose === "VERIFY"
      ? `${APP_NAME} — Verify Your Email`
      : `${APP_NAME} — Password Reset OTP`;
  const heading =
    purpose === "VERIFY" ? "Verify your email address" : "Reset your password";
  const body =
    purpose === "VERIFY"
      ? "Use the OTP below to verify your email and complete registration."
      : "Use the OTP below to reset your password. It expires in 15 minutes.";
  const html = buildHtml(heading, body, otp);
  const text = `${heading}\n\nYour OTP: ${otp}\n\nExpires in 15 minutes.`;

  // ── SMTP (Gmail / any SMTP) ───────────────────────────────
  if (process.env.SMTP_HOST || process.env.SMTP_USER) {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) === 465 : true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const from = process.env.SMTP_FROM || `${APP_NAME} <${process.env.SMTP_USER}>`;
    await transporter.sendMail({ from, to, subject, html, text });
    return;
  }

  // ── Resend ────────────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM_EMAIL || `${APP_NAME} <onboarding@resend.dev>`;
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return;
  }

  // ── Dev fallback ──────────────────────────────────────────
  console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject} | OTP: ${otp}`);
}
