import "server-only";
import type { Email } from "./mailer";

const escape = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

/** The sign-in code email, in Eden's dark style. */
export function signInCodeEmail(to: string, code: string): Email {
  const safeCode = escape(code);
  return {
    to,
    subject: `${code} is your Mogram code`,
    text: `Your Mogram sign-in code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:Inter,-apple-system,Segoe UI,sans-serif;color:#f5f5f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 16px">
<table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #262626;border-radius:24px">
<tr><td style="padding:36px 36px 8px;font-size:22px;font-weight:500;letter-spacing:-0.02em">Your sign-in code</td></tr>
<tr><td style="padding:0 36px 24px;color:#a3a3a3;font-size:14px;line-height:21px">Enter this code in Mogram to continue. It expires in 10 minutes.</td></tr>
<tr><td style="padding:0 36px 32px"><div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:18px;text-align:center;font-size:32px;letter-spacing:0.3em;font-weight:600">${safeCode}</div></td></tr>
<tr><td style="padding:0 36px 32px;color:#737373;font-size:12px">If you didn't ask for this code, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
