import "server-only";
import { z } from "zod";
import type { ModelTier } from "@/lib/ai/protocol";

/**
 * Which model provider the assistant uses, read from the environment (A3). Mogram doesn't depend
 * on one vendor: Claude through Anthropic's API, any OpenAI-compatible API (DeepSeek, OpenAI and
 * the many that copy its shape), or a scripted provider for tests. With nothing set up, the
 * assistant is off and the editor says so.
 *
 *   AI_PROVIDER        anthropic | deepseek | openai | openai-compatible | scripted | off
 *                      (default: whichever key below is set, else off)
 *   ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, or AI_API_KEY for any of them
 *   AI_BASE_URL        the API's address (required for openai-compatible)
 *   AI_MODEL_FAST      the model for small edits and questions
 *   AI_MODEL_STRONG    the model for builds, plans and reviews (default: the fast one)
 *   AI_ALLOW_ANONYMOUS 1 lets people without an account use it (drafts); default: sign in first
 *   AI_DAILY_TURNS     turns per person per day (default 200; 30 without an account)
 */

export type ProviderKind = "anthropic" | "openai-compatible" | "scripted";

export interface AiConfig {
  readonly kind: ProviderKind;
  /** For usage records: anthropic, deepseek, openai, the host of another API, scripted. */
  readonly provider: string;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly models: Readonly<Record<ModelTier, string>>;
  /** What people see it called. */
  readonly name: string;
  readonly allowAnonymous: boolean;
  readonly dailyTurns: number;
  readonly anonymousDailyTurns: number;
}

const schema = z.object({
  AI_PROVIDER: z
    .enum(["anthropic", "deepseek", "openai", "openai-compatible", "scripted", "off"])
    .optional(),
  AI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.url().optional(),
  AI_MODEL_FAST: z.string().optional(),
  AI_MODEL_STRONG: z.string().optional(),
  AI_ALLOW_ANONYMOUS: z.enum(["0", "1", "true", "false"]).optional(),
  AI_DAILY_TURNS: z.coerce.number().int().min(1).max(100_000).optional(),
});

/** Claude's current models (fast for edits, strong for building). */
const CLAUDE = { fast: "claude-haiku-4-5-20251001", strong: "claude-sonnet-5" } as const;
/** DeepSeek's chat model; set AI_MODEL_* for others. */
const DEEPSEEK = { fast: "deepseek-chat", strong: "deepseek-chat" } as const;

/** Why the assistant is off, when it is: shown in the panel. */
export class AiUnavailable extends Error {
  override readonly name = "AiUnavailable";
}

/** Reads the configuration (pure, for tests); null when the assistant is off. */
export function parseAiConfig(
  source: Readonly<Record<string, string | undefined>>,
): AiConfig | null {
  const env = schema.parse(
    Object.fromEntries(
      Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""),
    ),
  );
  const chosen =
    env.AI_PROVIDER ??
    (env.ANTHROPIC_API_KEY !== undefined
      ? "anthropic"
      : env.DEEPSEEK_API_KEY !== undefined
        ? "deepseek"
        : env.OPENAI_API_KEY !== undefined
          ? "openai"
          : "off");
  if (chosen === "off") return null;
  const allowAnonymous = env.AI_ALLOW_ANONYMOUS === "1" || env.AI_ALLOW_ANONYMOUS === "true";
  const limits = {
    allowAnonymous,
    dailyTurns: env.AI_DAILY_TURNS ?? 200,
    anonymousDailyTurns: Math.min(env.AI_DAILY_TURNS ?? 30, 30),
  };
  const models = (defaults: { fast: string; strong: string } | null) => {
    const fast = env.AI_MODEL_FAST ?? defaults?.fast;
    if (fast === undefined)
      throw new AiUnavailable("Set AI_MODEL_FAST (and AI_MODEL_STRONG) for this provider.");
    return { fast, strong: env.AI_MODEL_STRONG ?? defaults?.strong ?? fast };
  };
  const key = (specific: string | undefined, what: string) => {
    const value = env.AI_API_KEY ?? specific;
    if (value === undefined) throw new AiUnavailable(`Set ${what} (or AI_API_KEY).`);
    return value;
  };

  switch (chosen) {
    case "scripted":
      return {
        kind: "scripted",
        provider: "scripted",
        apiKey: "",
        baseUrl: "",
        models: { fast: "scripted-fast", strong: "scripted-strong" },
        name: "Assistant",
        ...limits,
      };
    case "anthropic":
      return {
        kind: "anthropic",
        provider: "anthropic",
        apiKey: key(env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY"),
        baseUrl: env.AI_BASE_URL ?? "https://api.anthropic.com",
        models: models(CLAUDE),
        name: "Claude",
        ...limits,
      };
    case "deepseek":
      return {
        kind: "openai-compatible",
        provider: "deepseek",
        apiKey: key(env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY"),
        baseUrl: env.AI_BASE_URL ?? "https://api.deepseek.com",
        models: models(DEEPSEEK),
        name: "Assistant",
        ...limits,
      };
    case "openai":
      return {
        kind: "openai-compatible",
        provider: "openai",
        apiKey: key(env.OPENAI_API_KEY, "OPENAI_API_KEY"),
        baseUrl: env.AI_BASE_URL ?? "https://api.openai.com/v1",
        models: models(null),
        name: "Assistant",
        ...limits,
      };
    case "openai-compatible": {
      if (env.AI_BASE_URL === undefined)
        throw new AiUnavailable("Set AI_BASE_URL for an OpenAI-compatible provider.");
      return {
        kind: "openai-compatible",
        provider: new URL(env.AI_BASE_URL).hostname,
        apiKey: key(undefined, "AI_API_KEY"),
        baseUrl: env.AI_BASE_URL,
        models: models(null),
        name: "Assistant",
        ...limits,
      };
    }
  }
}

let cached: { config: AiConfig | null; error: string | null } | null = null;

/** The configuration, or why there's none (a half-finished setup says what's missing). */
export function aiConfig(): { config: AiConfig | null; error: string | null } {
  if (cached !== null) return cached;
  try {
    cached = { config: parseAiConfig(process.env), error: null };
  } catch (error) {
    cached = {
      config: null,
      error:
        error instanceof AiUnavailable
          ? error.message
          : "The assistant's settings on this server aren't valid.",
    };
  }
  return cached;
}
