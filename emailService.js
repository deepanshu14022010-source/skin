import { config } from "../config.js";
import { apiError } from "../utils/http.js";
import { logError, logInfo } from "../utils/logger.js";

const brevoUrl = "https://api.brevo.com/v3/smtp/email";

export async function sendOtpEmail(email, otp, purpose = "login") {
  assertEmailConfigured();
  if (config.emailProvider === "console") {
    logInfo("dev_otp_generated", { email, purpose, code: otp });
    return { provider: "console", devOtp: otp };
  }

  const response = await fetch(brevoUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "api-key": config.brevoApiKey
    },
    body: JSON.stringify({
      sender: { name: config.brevoSenderName, email: config.brevoSenderEmail },
      to: [{ email }],
      subject: "Your AKRIVO Skin verification code",
      htmlContent: otpTemplate(otp, purpose)
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logError("brevo_send_failed", new Error(`Brevo returned ${response.status}`), {
      status: response.status,
      senderEmail: config.brevoSenderEmail,
      response: body.slice(0, 500)
    });
    const message = providerErrorMessage(response.status, body);
    throw apiError(message, 502);
  }
  return { provider: "brevo" };
}

function providerErrorMessage(status, body) {
  const text = String(body || "");
  if (status === 401 && /unrecognised IP address|authorised_ips|authorized_ips/i.test(text)) {
    return "Brevo rejected the email because this server IP is not authorised. Add the current public IP in Brevo Security > Authorised IPs, then try again.";
  }
  if (status === 401 || status === 403) return "Brevo rejected the email credentials or sender permissions. Check the API key, sender verification, and Brevo security settings.";
  return "Could not send verification email. Please check email settings and try again.";
}

export function assertEmailConfigured() {
  if (config.emailProvider === "console") {
    if (config.env === "production") throw apiError("Email verification is not configured.", 503);
    return;
  }
  if (config.emailProvider !== "brevo") throw apiError("Email provider is not supported.", 503);
  assertBrevoConfigured();
}

export function assertBrevoConfigured() {
  if (!config.brevoApiKey) throw apiError("Email verification is not configured.", 503);
  if (!config.brevoSenderEmail || config.brevoSenderEmail.endsWith(".example")) throw apiError("Email sender is not configured.", 503);
}

function otpTemplate(otp, purpose) {
  const copy = purpose === "password-reset"
    ? "Use this code to reset your AKRIVO Skin password. It expires in 10 minutes."
    : "Use this code to continue signing in. It expires in 10 minutes.";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#fffaf3;font-family:Arial,sans-serif;color:#2e3130;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffaf3;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #eee4d9;border-radius:14px;padding:28px;">
            <tr><td style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#d98984;">AKRIVO Skin</td></tr>
            <tr><td style="padding-top:10px;font-size:24px;font-weight:900;">Your verification code</td></tr>
            <tr><td style="padding-top:14px;font-size:15px;line-height:24px;color:#625a55;">${copy}</td></tr>
            <tr><td align="center" style="padding:26px 0;">
              <div style="display:inline-block;background:#e7f1eb;color:#245c52;border-radius:12px;padding:16px 24px;font-size:34px;font-weight:900;letter-spacing:8px;">${otp}</div>
            </td></tr>
            <tr><td style="font-size:13px;line-height:21px;color:#73716d;">If you did not request this code, you can safely ignore this email.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
