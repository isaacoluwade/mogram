import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once. Secrets never use the NEXT_PUBLIC_ prefix (AC-7).
 * On a developer's machine the app runs with no configuration: an embedded database, a fixed
 * local secret and a mailbox for sign-in codes. Those conveniences switch on only when the app
 * is truly local (not production, and served from localhost), so a misconfigured deploy fails
 * closed instead of exposing them.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3100"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  DATABASE_URL: z.string().optional(),
  PGLITE_DATA_DIR: z.string().default(".data/pglite"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Mogram <hello@mogram.app>"),
  /** Header carrying the client IP, set by the reverse proxy in front of Mogram (e.g. `x-real-ip`). */
  TRUSTED_IP_HEADER: z.string().optional(),
  /** Comma-separated CIDRs of proxies allowed to append to `x-forwarded-for`. */
  TRUSTED_PROXIES: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema> & {
  readonly BETTER_AUTH_SECRET: string;
  /** Development conveniences are allowed (see above). */
  readonly local: boolean;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

let cached: ServerEnv | null = null;

/** `KEY=` with nothing after it (as in .env.example) means "not set", not an empty value. */
function withoutEmpty(source: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[1].trim() !== "",
    ),
  );
}

/** Validates an environment (pure, for tests); `env()` is this applied once to process.env. */
export function parseEnv(source: NodeJS.ProcessEnv): ServerEnv {
  const parsed = schema.parse(withoutEmpty(source));
  const local =
    parsed.NODE_ENV !== "production" && LOCAL_HOSTS.has(new URL(parsed.APP_URL).hostname);
  const secret = parsed.BETTER_AUTH_SECRET;
  if (secret === undefined && !local) {
    throw new Error(
      "BETTER_AUTH_SECRET is required outside local development (32+ random characters).",
    );
  }
  // Sign-in codes are sent in the background (so responses don't reveal whether an address
  // exists), which means a missing email key would fail silently: refuse to start instead.
  if (parsed.RESEND_API_KEY === undefined && !local) {
    throw new Error(
      "RESEND_API_KEY is required outside local development: sign-in codes are sent by email.",
    );
  }
  return {
    ...parsed,
    local,
    BETTER_AUTH_SECRET: secret ?? "mogram-local-development-secret-not-for-production",
  };
}

export function env(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Development-only tools (dev mailbox, renderer check) are available. */
export const isLocalDevelopment = (): boolean => env().local;
