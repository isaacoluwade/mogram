import "server-only";
import { createHash } from "node:crypto";
import { isCatalogIcon, isLibraryId, searchIcons } from "@mogram/icons";
import { CONCEPT_CATALOG, findConcepts } from "@mogram/concepts";
import type { AssistantConfig } from "@/lib/ai/protocol";
import type { ToolEnv } from "@/lib/ai/tools";
import { getDb } from "../db/client";
import { aiUsage } from "../db/schema";
import { env } from "../env";
import { withinLimit } from "../auth/throttle";
import { aiConfig, type AiConfig } from "./config";
import { anthropicProvider } from "./providers/anthropic";
import { openAiProvider } from "./providers/openai";
import { scriptedProvider } from "./providers/scripted";
import type { ModelProvider, Usage } from "./providers/types";

export function providerFor(config: AiConfig): ModelProvider {
  switch (config.kind) {
    case "anthropic":
      return anthropicProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl });
    case "openai-compatible":
      return openAiProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl });
    case "scripted":
      return scriptedProvider();
  }
}

let catalog: Promise<ToolEnv> | null = null;

/**
 * The icon catalogue and the concepts' files, loaded once per server (they're large, and only the
 * assistant needs them here).
 */
export function toolEnv(): Promise<ToolEnv> {
  catalog ??= Promise.all([import("@mogram/icons/catalog"), import("@mogram/concepts/all")]).then(
    ([{ ICONS }, { ALL_CONCEPTS }]) => ({
      searchIcons: (query, options) =>
        searchIcons(ICONS, query, {
          limit: options.limit,
          ...(options.library !== undefined && isLibraryId(options.library)
            ? { library: options.library }
            : {}),
        }),
      isIcon: isCatalogIcon,
      findConcepts: (query, limit) => findConcepts(CONCEPT_CATALOG, query).slice(0, limit),
      conceptFile: (id) => ALL_CONCEPTS[id] ?? null,
    }),
  );
  return catalog;
}

/** What the panel shows: whether it's on, why not, and what it's called. */
export function publicConfig(signedIn: boolean): AssistantConfig {
  const { config, error } = aiConfig();
  if (config === null)
    return {
      enabled: false,
      reason:
        error ??
        "The assistant isn't set up on this server. Set ANTHROPIC_API_KEY, DEEPSEEK_API_KEY or another provider to turn it on.",
      name: "Assistant",
      models: null,
    };
  if (!signedIn && !config.allowAnonymous)
    return {
      enabled: false,
      reason: "Sign in to use the assistant.",
      name: config.name,
      models: config.models,
    };
  return { enabled: true, reason: null, name: config.name, models: config.models };
}

/** The address a request came from, when a trusted proxy says (else one shared bucket). */
function clientKey(request: Request): string {
  const header = env().TRUSTED_IP_HEADER;
  const ip = header === undefined ? null : request.headers.get(header);
  return createHash("sha256")
    .update(ip ?? "anonymous")
    .digest("hex")
    .slice(0, 32);
}

/**
 * Whether this person (or, without an account, this address) may start another turn: a burst
 * limit per minute and a daily allowance.
 */
export async function mayStartTurn(
  config: AiConfig,
  userId: string | null,
  request: Request,
): Promise<string | null> {
  // Scripts cost nothing to run: tests and demos aren't limited.
  if (config.kind === "scripted") return null;
  const who = userId === null ? `anon:${clientKey(request)}` : `user:${userId}`;
  if (!(await withinLimit(`ai-minute:${who}`, 12, 60)))
    return "That's a lot of requests at once. Wait a minute, then try again.";
  const daily = userId === null ? config.anonymousDailyTurns : config.dailyTurns;
  if (!(await withinLimit(`ai-day:${who}`, daily, 24 * 60 * 60)))
    return `You've used today's ${daily} assistant turns. They reset within a day.`;
  return null;
}

/** One row per turn: tokens and how it ended (never the prompt or the diagram). */
export async function recordUsage(args: {
  readonly config: AiConfig;
  readonly userId: string | null;
  readonly model: string;
  readonly usage: Usage;
  readonly steps: number;
  readonly outcome: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(aiUsage).values({
      userId: args.userId,
      provider: args.config.provider,
      model: args.model,
      inputTokens: args.usage.input,
      outputTokens: args.usage.output,
      cacheReadTokens: args.usage.cacheRead,
      cacheWriteTokens: args.usage.cacheWrite,
      steps: args.steps,
      outcome: args.outcome,
    });
  } catch (error) {
    // Usage is bookkeeping: a failed write mustn't fail the person's turn.
    console.error("couldn't record assistant usage", error);
  }
}
