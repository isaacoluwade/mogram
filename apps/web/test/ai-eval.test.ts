import { afterAll, describe, expect, it } from "vitest";
import { aiConfig } from "@/server/ai/config";
import { EVAL_CASES, runEval, type EvalResult } from "@/server/ai/evals";
import { scriptedProvider } from "@/server/ai/providers/scripted";
import { providerFor, toolEnv } from "@/server/ai/service";

/**
 * The assistant's evaluations (A6). `pnpm eval:ai` runs every case against the provider the
 * environment sets up (ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, …) and prints a report; a case
 * passes when all its checks do. In the normal test run (no AI_EVAL), the scripted provider runs
 * the cases it has scripts for, so the harness stays honest.
 */

const live = process.env.AI_EVAL === "1";
const { config } = live ? aiConfig() : { config: null };
const results: EvalResult[] = [];

describe.skipIf(live && config === null)("assistant evaluations", () => {
  const cases = live ? EVAL_CASES : EVAL_CASES.filter((c) => c.scripted === true);
  for (const evalCase of cases) {
    it(evalCase.id, { timeout: 300_000 }, async () => {
      const provider =
        live && config !== null ? providerFor(config) : scriptedProvider({ delayMs: 0 });
      const tier = evalCase.model === "fast" ? "fast" : "strong";
      const result = await runEval({
        provider,
        model: config?.models[tier] ?? "scripted",
        env: await toolEnv(),
        name: config?.name ?? "Assistant",
        case: evalCase,
      });
      results.push(result);
      const failed = result.checks.filter((c) => !c.ok);
      expect(
        failed.map((c) => `${c.name}${c.detail === undefined ? "" : ` (${c.detail})`}`),
      ).toEqual([]);
    });
  }

  afterAll(() => {
    if (!live) return;
    const rows = results.map(
      (r) =>
        `${r.passed ? "PASS" : "FAIL"}  ${r.id.padEnd(24)} ${String(r.steps).padStart(2)} steps  ${String(Math.round(r.ms / 1000)).padStart(3)}s  in ${r.usage.input} (+${r.usage.cacheRead} cached)  out ${r.usage.output}`,
    );
    const passed = results.filter((r) => r.passed).length;
    console.info(
      [
        `\nAssistant evaluations: ${config?.provider ?? ""} (${config?.models.fast} / ${config?.models.strong})`,
        ...rows,
        `${passed} of ${results.length} passed\n`,
      ].join("\n"),
    );
  });
});
