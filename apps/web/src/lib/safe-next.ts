/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted link can't send
 * someone to another site after they sign in (open redirect).
 */
export function safeNext(value: unknown, fallback = "/diagrams"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
