import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDiagram } from "@mogram/core/format";
import { ICONS } from "@mogram/icons/catalog";
import { isCatalogIcon, isLibraryId, searchIcons } from "@mogram/icons";
import { CONCEPT_CATALOG, findConcepts } from "@mogram/concepts";
import { ALL_CONCEPTS } from "@mogram/concepts/all";
import { readEvents, type AssistantEvent, type ChatRequest } from "@/lib/ai/protocol";
import { applyOp, type ToolEnv } from "@/lib/ai/tools";
import { runTurn, tierFor } from "@/server/ai/agent";
import { parseAiConfig } from "@/server/ai/config";
import { mayStartTurn } from "@/server/ai/service";
import { anthropicRequest, parseAnthropicStream } from "@/server/ai/providers/anthropic";
import { openAiRequest, parseOpenAiStream } from "@/server/ai/providers/openai";
import { scriptedProvider } from "@/server/ai/providers/scripted";
import { ProviderError, type ModelProvider } from "@/server/ai/providers/types";

/** The assistant's server side (A3): configuration, providers, the turn loop and the route. */

const env: ToolEnv = {
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
};

const FILES = {
  "mogram.yaml": `mogram: 1
name: Shop
components:
  web: { type: azure/app-services, label: Web }
  api: { type: azure/function-apps, label: Orders API }
connections:
  web_to_api: { from: web, to: api }
`,
};

const request = (prompt: string, overrides: Partial<ChatRequest> = {}): ChatRequest => ({
  files: FILES,
  folder: "",
  selection: [],
  prompt,
  history: [],
  model: "auto",
  ...overrides,
});

async function turn(prompt: string, provider: ModelProvider = scriptedProvider({ delayMs: 0 })) {
  const events: AssistantEvent[] = [];
  const outcome = await runTurn({
    provider,
    model: "test",
    name: "Assistant",
    request: request(prompt),
    env,
    emit: (event) => events.push(event),
    signal: new AbortController().signal,
  });
  return { events, outcome };
}

const stream = (text: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      // In uneven pieces, as a network delivers them.
      const bytes = new TextEncoder().encode(text);
      for (let i = 0; i < bytes.length; i += 37) controller.enqueue(bytes.slice(i, i + 37));
      controller.close();
    },
  });

describe("configuration", () => {
  it("is off without a provider, and picks one from the key that's set", () => {
    expect(parseAiConfig({})).toBeNull();
    const claude = parseAiConfig({ ANTHROPIC_API_KEY: "k" });
    expect(claude?.kind).toBe("anthropic");
    expect(claude?.name).toBe("Claude");
    expect(claude?.models).toEqual({
      fast: "claude-haiku-4-5-20251001",
      strong: "claude-sonnet-5",
    });
    const deepseek = parseAiConfig({ DEEPSEEK_API_KEY: "k" });
    expect(deepseek?.kind).toBe("openai-compatible");
    expect(deepseek?.baseUrl).toBe("https://api.deepseek.com");
    expect(deepseek?.name).toBe("Assistant");
  });

  it("says what's missing from a half-finished setup", () => {
    expect(() => parseAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" })).toThrow(
      /AI_MODEL_FAST/,
    );
    expect(() => parseAiConfig({ AI_PROVIDER: "openai-compatible", AI_API_KEY: "k" })).toThrow(
      /AI_BASE_URL/,
    );
    const custom = parseAiConfig({
      AI_PROVIDER: "openai-compatible",
      AI_API_KEY: "k",
      AI_BASE_URL: "https://llm.example.com/v1",
      AI_MODEL_FAST: "small",
    });
    expect(custom?.models).toEqual({ fast: "small", strong: "small" });
    expect(custom?.provider).toBe("llm.example.com");
    expect(
      parseAiConfig({ AI_PROVIDER: "scripted", AI_ALLOW_ANONYMOUS: "1" })?.allowAnonymous,
    ).toBe(true);
  });
});

describe("providers", () => {
  it("sends Claude the briefing and tools cached, and the conversation alternating", () => {
    const body = anthropicRequest({
      model: "claude-sonnet-5",
      system: "Briefing",
      messages: [
        { role: "user", text: "Add a cache" },
        {
          role: "assistant",
          text: "",
          calls: [{ id: "t1", name: "add_elements", input: { yaml: "x" } }],
        },
        { role: "tool", results: [{ id: "t1", content: "Done", isError: false }] },
      ],
      tools: [{ name: "add_elements", description: "Adds", inputSchema: { type: "object" } }],
      maxTokens: 100,
      signal: new AbortController().signal,
    });
    expect(body.system).toEqual([
      { type: "text", text: "Briefing", cache_control: { type: "ephemeral" } },
    ]);
    const messages = body.messages as { role: string; content: Record<string, unknown>[] }[];
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[2]?.content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "t1",
      cache_control: { type: "ephemeral" },
    });
  });

  it("reads Claude's stream: text, tool calls in pieces, and tokens", async () => {
    const sse = [
      `event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":120,"cache_read_input_tokens":3000,"cache_creation_input_tokens":0,"output_tokens":1}}}`,
      `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Adding "}}`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"a cache."}}`,
      `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}`,
      `event: content_block_start\ndata: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_1","name":"add_elements","input":{}}}`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"yaml\\": \\"comp"}}`,
      `event: content_block_delta\ndata: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"onents: {}\\"}"}}`,
      `event: content_block_stop\ndata: {"type":"content_block_stop","index":1}`,
      `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":42}}`,
      `event: message_stop\ndata: {"type":"message_stop"}`,
    ].join("\n\n");
    const events = [];
    for await (const event of parseAnthropicStream(stream(`${sse}\n\n`))) events.push(event);
    expect(events).toEqual([
      { type: "text", text: "Adding " },
      { type: "text", text: "a cache." },
      { type: "call", id: "toolu_1", name: "add_elements", input: { yaml: "components: {}" } },
      {
        type: "end",
        stop: "tools",
        usage: { input: 120, output: 42, cacheRead: 3000, cacheWrite: 0 },
      },
    ]);
  });

  it("speaks the OpenAI shape for DeepSeek and others, tool calls included", async () => {
    const body = openAiRequest({
      model: "deepseek-chat",
      system: "Briefing",
      messages: [
        { role: "user", text: "Hi" },
        {
          role: "assistant",
          text: "",
          calls: [{ id: "c1", name: "arrange", input: { container: null } }],
        },
        { role: "tool", results: [{ id: "c1", content: "Not applied", isError: true }] },
      ],
      tools: [{ name: "arrange", description: "Arranges", inputSchema: { type: "object" } }],
      maxTokens: 100,
      signal: new AbortController().signal,
    });
    expect(body.messages).toEqual([
      { role: "system", content: "Briefing" },
      { role: "user", content: "Hi" },
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "arrange", arguments: '{"container":null}' },
          },
        ],
      },
      { role: "tool", tool_call_id: "c1", content: "Error: Not applied" },
    ]);
    const sse = [
      `data: {"choices":[{"delta":{"content":"Arranging."}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"arrange","arguments":"{\\"cont"}}]}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ainer\\": null}"}}]},"finish_reason":"tool_calls"}]}`,
      `data: {"choices":[],"usage":{"prompt_tokens":5000,"completion_tokens":30,"prompt_cache_hit_tokens":4800}}`,
      `data: [DONE]`,
    ].join("\n\n");
    const events = [];
    for await (const event of parseOpenAiStream(stream(`${sse}\n\n`))) events.push(event);
    expect(events).toEqual([
      { type: "text", text: "Arranging." },
      { type: "call", id: "call_9", name: "arrange", input: { container: null } },
      {
        type: "end",
        stop: "tools",
        usage: { input: 200, output: 30, cacheRead: 4800, cacheWrite: 0 },
      },
    ]);
  });
});

describe("a turn", () => {
  it("uses the strong model for building and the fast one for small edits", () => {
    expect(tierFor("auto", request("Make the API label shorter"))).toBe("fast");
    expect(tierFor("auto", request("Design a multi-region setup"))).toBe("strong");
    expect(
      tierFor("auto", request("Add a label", { files: { "mogram.yaml": "mogram: 1\n" } })),
    ).toBe("strong");
    expect(tierFor("fast", request("Design everything"))).toBe("fast");
  });

  it("changes the diagram as it goes, and the browser's replay matches", async () => {
    const { events, outcome } = await turn("Add a cache for the API");
    expect(outcome.stop).toBe("end");
    const ops = events.filter((e) => e.type === "op");
    expect(ops).toHaveLength(1);
    const done = events.at(-1);
    expect(done?.type).toBe("done");
    if (done?.type !== "done" || done.files === null) throw new Error("no files");
    expect(done.changes?.line).toBe("Added Cache and reads");
    let replayed: Record<string, string> = FILES;
    for (const event of ops) if (event.type === "op") replayed = applyOp(replayed, event.op).files;
    expect(replayed).toEqual(done.files);
    expect(parseDiagram(done.files).diagram.connections.get("api_to_cache")?.to.element).toBe(
      "cache",
    );
    const text = events.flatMap((e) => (e.type === "text" ? [e.text] : [])).join("");
    expect(text).toContain("Added a cache");
  });

  it("learns from a refused change and fixes it", async () => {
    const { events } = await turn("Add Redis");
    const ops = events.filter((e) => e.type === "op");
    expect(ops).toHaveLength(1);
    const done = events.at(-1);
    if (done?.type !== "done" || done.files === null) throw new Error("no files");
    expect(parseDiagram(done.files).diagram.components.get("redis")?.type).toBe(
      "azure/cache-redis",
    );
  });

  it("stops at a question, and at a plan", async () => {
    const asked = await turn("Ask me which database to use");
    expect(asked.outcome.stop).toBe("question");
    const question = asked.events.find((e) => e.type === "question");
    expect(question).toMatchObject({ question: "Which database should orders use?" });
    expect(asked.events.at(-1)).toMatchObject({ type: "done", files: null, stop: "question" });

    const planned = await turn("Plan a shop");
    expect(planned.outcome.stop).toBe("plan");
    expect(planned.events.find((e) => e.type === "plan")).toMatchObject({
      summary: "A three-tier shop on Azure, behind Front Door.",
    });
  });

  it("builds a whole design that passes review", async () => {
    const { events } = await turn("Build it");
    const done = events.at(-1);
    if (done?.type !== "done" || done.files === null) throw new Error("no files");
    const { diagram, diagnostics } = parseDiagram(done.files);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(diagram.components.get("orders_db")?.parent).toBe("data_subnet");
    // Arranged: everything has a place.
    expect(diagram.layout.get("customers")?.at).not.toBeNull();
  });

  it("stops when asked to", async () => {
    const stop = new AbortController();
    const events: AssistantEvent[] = [];
    const outcome = await runTurn({
      provider: scriptedProvider({ delayMs: 40 }),
      model: "test",
      name: "Assistant",
      request: request("Give me a long answer"),
      env,
      emit: (event) => {
        events.push(event);
        if (events.length === 5) stop.abort();
      },
      signal: stop.signal,
    });
    expect(outcome.stop).toBe("stopped");
    expect(events.at(-1)).toMatchObject({ type: "done", stop: "stopped" });
  });

  it("says plainly when the provider fails", async () => {
    const failing: ModelProvider = {
      stream: () => ({
        [Symbol.asyncIterator]: () => ({
          next: () =>
            Promise.reject(
              new ProviderError("The model provider is overloaded. Try again in a minute.", true),
            ),
        }),
      }),
    };
    const { events, outcome } = await turn("Hello", failing);
    expect(outcome.stop).toBe("error");
    expect(events).toContainEqual({
      type: "error",
      message: "The model provider is overloaded. Try again in a minute.",
    });
  });
});

describe("the route", { timeout: 60_000 }, () => {
  const saved = { ...process.env };
  beforeAll(() => {
    process.env.AI_PROVIDER = "scripted";
    process.env.AI_ALLOW_ANONYMOUS = "1";
  });
  afterAll(() => {
    process.env = saved;
  });

  it("streams a turn as server-sent events", async () => {
    const route = await import("@/app/api/ai/chat/route");
    const config = await import("@/app/api/ai/config/route");
    const status = await config.GET(new Request("http://localhost:3100/api/ai/config"));
    expect(await status.json()).toMatchObject({ assistant: { enabled: true, name: "Assistant" } });

    const response = await route.POST(
      new Request("http://localhost:3100/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" },
        body: JSON.stringify(request("Add a cache")),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const events: AssistantEvent[] = [];
    if (response.body === null) throw new Error("no body");
    for await (const event of readEvents(response.body)) events.push(event);
    expect(events[0]).toMatchObject({ type: "start", tier: "fast" });
    expect(events.some((e) => e.type === "op")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "done", stop: "end" });
  });

  it("refuses requests from other sites and bad bodies", async () => {
    const route = await import("@/app/api/ai/chat/route");
    const cross = await route.POST(
      new Request("http://localhost:3100/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
        body: JSON.stringify(request("Add a cache")),
      }),
    );
    expect(cross.status).toBe(403);
    const bad = await route.POST(
      new Request("http://localhost:3100/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" },
        body: JSON.stringify({ prompt: "" }),
      }),
    );
    expect(bad.status).toBe(400);
  });
});

describe("limits", { timeout: 60_000 }, () => {
  it("allows a daily number of turns with a real provider, and none for scripts", async () => {
    const config = parseAiConfig({ ANTHROPIC_API_KEY: "k", AI_DAILY_TURNS: "3" });
    if (config === null) throw new Error("no config");
    const call = new Request("http://localhost:3100/api/ai/chat", { method: "POST" });
    const user = `limits-${Date.now()}`;
    for (let i = 0; i < 3; i++) expect(await mayStartTurn(config, user, call)).toBeNull();
    expect(await mayStartTurn(config, user, call)).toMatch(/today's 3 assistant turns/);
    // Someone else still has theirs.
    expect(await mayStartTurn(config, `${user}-other`, call)).toBeNull();
    expect(await mayStartTurn({ ...config, kind: "scripted" }, user, call)).toBeNull();
  });
});
