import "server-only";
import { Resend } from "resend";
import { env, isLocalDevelopment } from "../env";

export interface Email {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface DevMessage extends Email {
  readonly sentAt: string;
}

interface Mailbox {
  messages: DevMessage[];
}

// Development keeps recent messages in memory so the sign-in code can be read without an email
// provider (and by end-to-end tests). Never used in production.
const mailbox = ((globalThis as { __mogramMailbox?: Mailbox }).__mogramMailbox ??= {
  messages: [],
});

export function devMessages(): readonly DevMessage[] {
  return mailbox.messages;
}

export async function sendEmail(email: Email): Promise<void> {
  const config = env();
  if (config.RESEND_API_KEY !== undefined && config.RESEND_API_KEY.length > 0) {
    const resend = new Resend(config.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: config.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (error !== null) throw new Error(`Email could not be sent: ${error.message}`);
    return;
  }
  if (!isLocalDevelopment()) {
    throw new Error("RESEND_API_KEY is required to send email outside local development.");
  }
  mailbox.messages = [{ ...email, sentAt: new Date().toISOString() }, ...mailbox.messages].slice(
    0,
    50,
  );
  console.info(`\n[mogram dev mailbox] To: ${email.to}\n${email.text}\n`);
}
