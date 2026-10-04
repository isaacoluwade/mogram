import "server-only";
import type { z } from "zod";
import { userFromRequest, type SessionUser } from "./auth/session";
import { env } from "./env";

/** Consistent JSON errors: `{ error: { code, message } }`. */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json(
    { error: { code, message }, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export const notFound = (): Response =>
  apiError(404, "not_found", "That diagram doesn't exist, or you don't have access to it.");

const MAX_BODY_BYTES = 6_000_000;

const tooLarge = (): Response => apiError(413, "too_large", "That request is too large.");

/**
 * Reads a request body as text, counting the bytes actually received: `Content-Length` is only a
 * hint (a chunked request has none), so the limit is enforced while streaming.
 */
export async function readText(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<string | Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return tooLarge();
  const reader = request.body?.getReader();
  if (reader === undefined) return "";
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return tooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** A size-limited JSON body (see `readText`), or a Response explaining why it was refused. */
export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<unknown> {
  const text = await readText(request, maxBytes);
  if (text instanceof Response) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return apiError(400, "invalid_json", "The request body isn't valid JSON.");
  }
}

/** Reads and validates a JSON body; returns a Response on failure. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const json = await readJson(request);
  if (json instanceof Response) return json;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(
      400,
      "invalid_request",
      issue === undefined
        ? "The request is invalid."
        : `${issue.path.join(".") || "body"}: ${issue.message}`,
    );
  }
  return parsed.data;
}

/**
 * Changes must come from Mogram's own pages (defence in depth beside SameSite cookies): a browser
 * always sends `Origin` on these methods, and it must be this site. Non-browser clients that
 * send no `Origin` aren't a cross-site risk.
 */
function fromThisSite(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  return origin === new URL(env().APP_URL).origin || origin === new URL(request.url).origin;
}

/** Runs `handler` with the signed-in user, or answers 401. */
export async function withUser(
  request: Request,
  handler: (user: SessionUser) => Promise<Response>,
): Promise<Response> {
  if (!fromThisSite(request))
    return apiError(403, "cross_site", "Requests must come from Mogram itself.");
  const user = await userFromRequest(request);
  if (user === null) return apiError(401, "unauthorized", "Sign in to save diagrams to the cloud.");
  return handler(user);
}

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
