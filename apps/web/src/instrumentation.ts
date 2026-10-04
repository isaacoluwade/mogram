/**
 * Runs once when a server starts, before it handles requests: a deployment missing required
 * configuration fails here, loudly, instead of on someone's first sign-in.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("./server/env");
  env();
}
