import { devMessages } from "@/server/email/mailer";
import { isLocalDevelopment } from "@/server/env";

/** Development only: the latest emails, so sign-in works without an email provider. */
export function GET(request: Request): Response {
  if (!isLocalDevelopment()) return new Response("Not found", { status: 404 });
  const to = new URL(request.url).searchParams.get("to");
  const messages = devMessages().filter(
    (message) => to === null || message.to === to.toLowerCase(),
  );
  return Response.json({ messages });
}
