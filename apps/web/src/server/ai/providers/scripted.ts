import "server-only";
import type { ModelEvent, ModelMessage, ModelProvider, ModelToolCall } from "./types";

/**
 * A provider that follows scripts instead of a model, for tests and demos without an API key
 * (AI_PROVIDER=scripted). Each script reacts to words in the request and to how far the turn has
 * got, so the whole loop runs for real: tools, checks, questions, plans and streaming.
 */

interface Step {
  readonly text?: string;
  readonly calls?: readonly Omit<ModelToolCall, "id">[];
}

type Script = (step: number, lastResults: string) => Step | null;

const BUILD = `containers:
  shop_vnet: { type: network, label: Shop network }
  web_subnet: { type: subnet, label: Web subnet, in: shop_vnet }
  data_subnet: { type: subnet, label: Data subnet, in: shop_vnet }
components:
  customers: { type: generic/users, label: Customers }
  front_door: { type: azure/front-door-and-cdn-profiles, label: Front Door }
  storefront: { type: azure/app-services, label: Storefront, in: web_subnet }
  orders_api: { type: azure/function-apps, label: Orders API, in: web_subnet }
  orders_db: { type: azure/sql-database, label: Orders DB, in: data_subnet }
connections:
  customers_to_front_door: { from: customers, to: front_door, label: HTTPS }
  front_door_to_storefront: { from: front_door, to: storefront }
  storefront_to_orders_api: { from: storefront, to: orders_api }
  orders_api_to_orders_db: { from: orders_api, to: orders_db, label: SQL }
`;

const DATABASES: Readonly<Record<string, string>> = {
  "azure sql": "azure/sql-database",
  "cosmos db": "azure/cosmos-db",
  postgresql: "azure/azure-database-postgresql-server",
};

/** The scripts, tried in order; the first whose words match the request runs. */
const SCRIPTS: readonly { readonly match: RegExp; readonly script: Script }[] = [
  {
    // A deck (D-107): a slide for a diagram already in the project, and words for its beat.
    match: /\bslides?\b/i,
    script: (step) =>
      step === 0
        ? {
            text: "I'll add a slide for the flow, with words to say over its first beat.",
            calls: [
              {
                name: "add_slide",
                input: { diagram: "flow", title: "How it flows" },
              },
              {
                name: "set_beat_words",
                input: {
                  folder: "flow",
                  beat: 1,
                  caption: "A request arrives.",
                  script: "Everything starts when a request arrives at the front door.",
                },
              },
            ],
          }
        : step === 1
          ? { text: "Added a slide, How it flows, with a script for its first beat." }
          : null,
  },
  {
    match: /\bscal(e|es|ing)\b/i,
    script: (step) =>
      step === 0
        ? {
            text: "I'll make the API scale out, with traffic into it that rises and falls.",
            calls: [
              {
                name: "apply_concept",
                input: { concept: "horizontal-scaling", roles: { app: "api" } },
              },
            ],
          }
        : step === 1
          ? {
              text: "The API now scales out from 1 to 8 copies, and the traffic into it comes in waves, so you'll see copies start and stop on their own.",
            }
          : null,
  },
  {
    match: /\b(build it|go ahead)\b/i,
    script: (step) =>
      step === 0
        ? {
            text: "Building it now.",
            calls: [
              { name: "add_elements", input: { yaml: BUILD } },
              { name: "arrange", input: { container: null } },
              {
                name: "update_settings",
                input: { name: "Online shop", description: "A three-tier shop on Azure." },
              },
            ],
          }
        : step === 1
          ? {
              text: "Built the shop: Front Door in front, the app and API in the web subnet, the database in its own subnet.",
            }
          : null,
  },
  {
    match: /\bcache\b/i,
    script: (step) =>
      step === 0
        ? {
            text: "I'll put a cache next to the API, so reads don't all go to the database.",
            calls: [
              {
                name: "add_elements",
                input: {
                  yaml: "components:\n  cache: { type: generic/cache, label: Cache }\nconnections:\n  api_to_cache: { from: api, to: cache, label: reads }\n",
                },
              },
            ],
          }
        : step === 1
          ? { text: "Added a cache: the API reads from it first." }
          : null,
  },
  {
    match: /\b(which database|ask me)\b/i,
    script: (step) =>
      step === 0
        ? {
            text: "One question first.",
            calls: [
              {
                name: "ask_user",
                input: {
                  question: "Which database should orders use?",
                  options: [
                    {
                      label: "Azure SQL",
                      description: "Relational and fully managed",
                      preview:
                        "mogram: 1\nname: Azure SQL\ncomponents:\n  api: { type: azure/function-apps, label: API }\n  db: { type: azure/sql-database, label: Azure SQL }\nconnections:\n  api_to_db: { from: api, to: db }\n",
                    },
                    { label: "Cosmos DB", description: "Global, many models" },
                    { label: "PostgreSQL", description: "Open source, managed" },
                  ],
                },
              },
            ],
          }
        : null,
  },
  {
    match: /\b(plan|build)\b/i,
    script: (step) =>
      step === 0
        ? {
            calls: [
              {
                name: "propose_plan",
                input: {
                  summary: "A three-tier shop on Azure, behind Front Door.",
                  steps: [
                    "A virtual network with a web subnet and a data subnet",
                    "Front Door in front of the storefront",
                    "The storefront and Orders API in the web subnet",
                    "Orders DB (Azure SQL) in the data subnet",
                  ],
                },
              },
            ],
          }
        : null,
  },
  {
    match: /\bredis\b/i,
    // A wrong icon first: the check refuses it and names real ones, and the script uses one.
    script: (step, results) =>
      step === 0
        ? {
            calls: [
              {
                name: "add_elements",
                input: {
                  yaml: "components:\n  redis: { type: azure/redis-cache-service, label: Redis }\n",
                },
              },
            ],
          }
        : step === 1 && results.includes("isn't an icon")
          ? {
              calls: [
                {
                  name: "add_elements",
                  input: {
                    yaml: "components:\n  redis: { type: azure/cache-redis, label: Redis }\n",
                  },
                },
              ],
            }
          : step <= 2
            ? { text: "Added Redis (Azure Cache for Redis)." }
            : null,
  },
  {
    match: /\boutage\b/i,
    script: (step) =>
      step === 0
        ? {
            calls: [{ name: "update_scene", input: { scene: "outage", entries: { api: "down" } } }],
          }
        : step === 1
          ? { text: "Added an Outage scene where the API is down." }
          : null,
  },
  {
    match: /\bwhere\b/i,
    script: (step) =>
      step === 0
        ? { calls: [{ name: "show_elements", input: { names: ["api"] } }] }
        : step === 1
          ? { text: "That's the API, selected on the canvas." }
          : null,
  },
  {
    match: /\b(slowly|long answer)\b/i,
    script: (step) =>
      step === 0
        ? {
            text: Array.from(
              { length: 40 },
              (_, i) =>
                `Point ${i + 1}: diagrams read best left to right, sources to destinations.`,
            ).join(" "),
          }
        : null,
  },
];

/** The words of the request in the latest user message (the context around it is skipped). */
function requestOf(messages: readonly ModelMessage[]): {
  text: string;
  step: number;
  results: string;
} {
  let step = 0;
  let results = "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message === undefined) continue;
    if (message.role === "assistant") step++;
    if (message.role === "tool" && results === "")
      results = message.results.map((r) => r.content).join("\n");
    if (message.role === "user") {
      const match = /<request>\n?([\s\S]*?)\n?<\/request>/.exec(message.text);
      return { text: (match?.[1] ?? message.text).trim(), step, results };
    }
  }
  return { text: "", step, results };
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

export function scriptedProvider(options: { readonly delayMs?: number } = {}): ModelProvider {
  const delay = options.delayMs ?? 25;
  return {
    async *stream(request): AsyncGenerator<ModelEvent> {
      const { text, step, results } = requestOf(request.messages);
      let reply: Step | null;
      const answer = /^(azure sql|cosmos db|postgresql)\b/i.exec(text)?.[1]?.toLowerCase();
      if (answer !== undefined) {
        // The answer to "Which database?".
        const type = DATABASES[answer] ?? "generic/database";
        reply =
          step === 0
            ? {
                calls: [
                  {
                    name: "add_elements",
                    input: {
                      yaml: `components:\n  orders_db: { type: ${type}, label: Orders DB }\n`,
                    },
                  },
                ],
              }
            : step === 1
              ? { text: `Added Orders DB on ${text}.` }
              : null;
      } else {
        const script = SCRIPTS.find((s) => s.match.test(text))?.script;
        reply =
          script === undefined
            ? step === 0
              ? {
                  text: "I'm the scripted assistant used for tests and demos. Ask me for a cache, a plan, a question, or an outage scene.",
                }
              : null
            : script(step, results);
      }
      reply ??= { text: "Done." };

      const words = (reply.text ?? "").split(/(?<= )/);
      for (const word of words) {
        if (request.signal.aborted) return;
        if (word !== "") yield { type: "text", text: word };
        if (delay > 0 && words.length > 1) await pause(delay / 4, request.signal);
      }
      const calls = reply.calls ?? [];
      for (const [index, call] of calls.entries()) {
        if (delay > 0) await pause(delay, request.signal);
        yield { type: "call", id: `call_${step}_${index}`, name: call.name, input: call.input };
      }
      yield {
        type: "end",
        stop: calls.length > 0 ? "tools" : "end",
        usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0 },
      };
    },
  };
}
