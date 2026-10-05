import { chatRequestBody, encodeEvent, type AssistantEvent } from "@/lib/ai/protocol";
import { userFromRequest } from "@/server/auth/session";
import { apiError, readBody } from "@/server/http";
import { runTurn, tierFor } from "@/server/ai/agent";
import { aiConfig } from "@/server/ai/config";
import { mayStartTurn, providerFor, publicConfig, recordUsage, toolEnv } from "@/server/ai/service";

/** A turn can take a while: a build is several model calls. */
export const maxDuration = 300;

/**
 * One assistant turn (A3), streamed as server-sent events: text as it's written, each change as
 * it's made, then a question, a plan or the end. Closing the request stops the turn.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin !== null && origin !== new URL(request.url).origin)
  )
    return apiError(403, "cross_site", "Requests must come from Mogram itself.");
  const user = await userFromRequest(request);
  const status = publicConfig(user !== null);
  const { config } = aiConfig();
  if (!status.enabled || config === null)
    return apiError(
      user === null && config !== null ? 401 : 503,
      "assistant_unavailable",
      status.reason ?? "The assistant is off.",
    );
  const body = await readBody(request, chatRequestBody);
  if (body instanceof Response) return body;
  const refused = await mayStartTurn(config, user?.id ?? null, request);
  if (refused !== null) return apiError(429, "rate_limited", refused);

  const tier = tierFor(body.model, body);
  const model = config.models[tier];
  const provider = providerFor(config);
  const env = await toolEnv();
  const stop = new AbortController();
  request.signal.addEventListener("abort", () => stop.abort());
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AssistantEvent) => {
        if (stop.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        } catch {
          stop.abort();
        }
      };
      emit({ type: "start", tier, model });
      const outcome = await runTurn({
        provider,
        model,
        name: config.name,
        request: body,
        env,
        emit,
        signal: stop.signal,
      });
      await recordUsage({
        config,
        userId: user?.id ?? null,
        model,
        usage: outcome.usage,
        steps: outcome.steps,
        outcome: outcome.stop,
      });
      try {
        controller.close();
      } catch {
        // Already closed by the browser going away.
      }
    },
    cancel() {
      stop.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      // Proxies such as nginx otherwise hold the stream back.
      "X-Accel-Buffering": "no",
    },
  });
}
