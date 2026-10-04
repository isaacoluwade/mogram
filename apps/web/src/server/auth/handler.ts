import "server-only";
import { readText } from "../http";
import { getAuth } from "./auth";
import { emailKey, withinLimit } from "./throttle";

const SEND_CODE = "/email-otp/send-verification-otp";
const SIGN_IN = "/sign-in/email-otp";

/**
 * The only Better Auth endpoints Mogram uses. Everything else (password, social, account and
 * email-change routes, and the code-check endpoint, whose attempt counting isn't atomic) answers
 * 404, so it can't be used as an attack surface.
 */
const ALLOWED = new Set([SEND_CODE, SIGN_IN, "/get-session", "/sign-out", "/ok"]);

/** Per email address, whatever IP the requests come from (AC-7). */
const LIMITS: Readonly<Record<string, { readonly limit: number; readonly windowSeconds: number }>> =
  {
    [SEND_CODE]: { limit: 5, windowSeconds: 15 * 60 },
    [SIGN_IN]: { limit: 10, windowSeconds: 15 * 60 },
  };

const tooMany = (): Response =>
  Response.json(
    {
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Wait a few minutes, then try again.",
    },
    { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } },
  );

export async function handleAuthRequest(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api\/auth/, "") || "/";
  if (!ALLOWED.has(path)) return new Response("Not Found", { status: 404 });
  const auth = await getAuth();
  if (request.method !== "POST") return auth.handler(request);
  // Auth bodies are tiny: read once (size-limited), check the throttle, then hand the same text on.
  const text = await readText(request, 16_000);
  if (text instanceof Response) return text;
  const limit = LIMITS[path];
  if (limit !== undefined) {
    const email = emailOf(text);
    if (
      email !== null &&
      !(await withinLimit(emailKey(path, email), limit.limit, limit.windowSeconds))
    )
      return tooMany();
  }
  return auth.handler(
    new Request(request.url, { method: "POST", headers: request.headers, body: text }),
  );
}

function emailOf(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text);
    const email = typeof body === "object" && body !== null && "email" in body ? body.email : null;
    return typeof email === "string" && email.length > 0 ? email : null;
  } catch {
    return null;
  }
}
