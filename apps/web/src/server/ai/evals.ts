import "server-only";
import { findDiagramFolders, parseDiagram } from "@mogram/core/format";
import { lintDiagram } from "@mogram/core/lint";
import type { Diagram, ProjectFiles } from "@mogram/core/model";
import type { AssistantEvent, ModelChoice } from "@/lib/ai/protocol";
import type { ToolEnv } from "@/lib/ai/tools";
import { BLANK_FILES, WEB_APP_FILES } from "@/features/templates/files";
import { runTurn } from "./agent";
import type { ModelProvider, Usage } from "./providers/types";

/**
 * Evaluations for the assistant (A6): realistic requests with checks on what came out (does it
 * parse, pass review, use the right icons, nest and connect things as an architect would). Run
 * against any provider to choose models and catch regressions in the briefing or the tools:
 * `pnpm eval:ai` with a provider's key set. Without one, the scripted provider runs the cases it
 * knows, which keeps the harness itself tested.
 */

export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail?: string;
}

export interface TurnResult {
  readonly files: ProjectFiles;
  readonly before: ProjectFiles;
  readonly stop: string;
  readonly text: string;
  readonly events: readonly AssistantEvent[];
}

export interface EvalCase {
  readonly id: string;
  readonly prompt: string;
  readonly files: ProjectFiles;
  readonly model?: ModelChoice;
  /** The scripted provider can run it (its words match a script). */
  readonly scripted?: boolean;
  readonly checks: (result: TurnResult) => Check[];
}

export interface EvalResult {
  readonly id: string;
  readonly checks: readonly Check[];
  readonly passed: boolean;
  readonly usage: Usage;
  readonly steps: number;
  readonly ms: number;
}

const top = (files: ProjectFiles): Diagram => parseDiagram(files, "").diagram;

// --- Checks -----------------------------------------------------------------------------------

export function parses(result: TurnResult): Check {
  const errors = findDiagramFolders(result.files).flatMap((folder) =>
    parseDiagram(result.files, folder).diagnostics.filter((d) => d.severity === "error"),
  );
  return {
    name: "parses without errors",
    ok: errors.length === 0,
    ...(errors.length > 0 ? { detail: errors.map((e) => e.message).join("; ") } : {}),
  };
}

export function passesReview(result: TurnResult): Check {
  const warnings = lintDiagram(top(result.files)).filter((f) => f.severity === "warning");
  return {
    name: "no architecture warnings",
    ok: warnings.length === 0,
    ...(warnings.length > 0 ? { detail: warnings.map((f) => f.message).join("; ") } : {}),
  };
}

/** Some component's icon matches each pattern (e.g. /^aws\/lambda$/). */
export function hasIcons(...patterns: RegExp[]): (result: TurnResult) => Check {
  return (result) => {
    const types = [...top(result.files).components.values()].map((c) => c.type);
    const missing = patterns.filter((p) => !types.some((t) => p.test(t)));
    return {
      name: `uses ${patterns.map((p) => p.source).join(", ")}`,
      ok: missing.length === 0,
      ...(missing.length > 0
        ? { detail: `missing ${missing.map((p) => p.source).join(", ")}; has ${types.join(", ")}` }
        : {}),
    };
  };
}

export function connectedAll(result: TurnResult): Check {
  const unconnected = lintDiagram(top(result.files)).filter((f) => f.rule === "unconnected");
  return {
    name: "every component is connected",
    ok: unconnected.length === 0,
    ...(unconnected.length > 0 ? { detail: unconnected.map((f) => f.message).join("; ") } : {}),
  };
}

export function oneCloud(result: TurnResult): Check {
  const mixed = lintDiagram(top(result.files)).find((f) => f.rule === "mixed-clouds");
  return {
    name: "icons from one cloud",
    ok: mixed === undefined,
    ...(mixed ? { detail: mixed.message } : {}),
  };
}

/** A container of `type` holds a container of `inner` (e.g. network › subnet). */
export function nests(outer: string, inner: string): (result: TurnResult) => Check {
  return (result) => {
    const d = top(result.files);
    const ok = [...d.containers.values()].some(
      (c) =>
        c.type.endsWith(inner) &&
        c.parent !== null &&
        d.containers.get(c.parent)?.type.endsWith(outer) === true,
    );
    return { name: `${inner} inside ${outer}`, ok };
  };
}

export function atLeast(
  what: "components" | "connections" | "containers",
  count: number,
): (result: TurnResult) => Check {
  return (result) => {
    const d = top(result.files);
    const n = d[what].size;
    return { name: `at least ${count} ${what}`, ok: n >= count, detail: `${n}` };
  };
}

export function removedNothing(result: TurnResult): Check {
  const before = top(result.before);
  const after = top(result.files);
  const gone = [
    ...before.components.keys(),
    ...before.containers.keys(),
    ...before.connections.keys(),
  ].filter(
    (name) =>
      !after.components.has(name) && !after.containers.has(name) && !after.connections.has(name),
  );
  return {
    name: "removed nothing",
    ok: gone.length === 0,
    ...(gone.length > 0 ? { detail: gone.join(", ") } : {}),
  };
}

export function stoppedWith(...stops: string[]): (result: TurnResult) => Check {
  return (result) => ({
    name: `ends with ${stops.join(" or ")}`,
    ok: stops.includes(result.stop),
    detail: result.stop,
  });
}

export function unchanged(result: TurnResult): Check {
  return {
    name: "didn't change the diagram",
    ok: JSON.stringify(result.files) === JSON.stringify(result.before),
  };
}

// --- Cases ------------------------------------------------------------------------------------

const AWS_START: ProjectFiles = {
  "mogram.yaml": `mogram: 1
name: Web tier
libraries: [aws]
components:
  alb: { type: aws/application-load-balancer, label: Load balancer }
  web_1: { type: aws/ec2, label: Web 1 }
  web_2: { type: aws/ec2, label: Web 2 }
connections:
  alb_to_web_1: { from: alb, to: web_1 }
  alb_to_web_2: { from: alb, to: web_2 }
`,
};

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: "build-azure-three-tier",
    prompt:
      "Build it: a three-tier web app on Azure with Front Door, an App Service web front end, a Functions API, Azure SQL and a Redis cache, in a virtual network with a web subnet and a data subnet. Don't ask, just build it.",
    files: BLANK_FILES,
    scripted: true,
    checks: (r) => [
      parses(r),
      passesReview(r),
      oneCloud(r),
      connectedAll(r),
      hasIcons(/^azure\/front-door/, /^azure\/app-services?$/, /^azure\/sql-database$/)(r),
      nests("network", "subnet")(r),
      atLeast("connections", 4)(r),
    ],
  },
  {
    id: "build-aws-serverless",
    prompt:
      "Draw a serverless image upload API on AWS: API Gateway, a Lambda that writes to S3 and DynamoDB, and an SQS queue feeding a thumbnail Lambda. Just build it.",
    files: BLANK_FILES,
    checks: (r) => [
      parses(r),
      passesReview(r),
      oneCloud(r),
      connectedAll(r),
      hasIcons(
        /^aws\/api-gateway$/,
        /^aws\/lambda$/,
        /^aws\/s3$/,
        /^aws\/dynamodb$/,
        /^aws\/sqs$/,
      )(r),
      atLeast("connections", 5)(r),
    ],
  },
  {
    id: "edit-add-cache",
    prompt: "Add a Redis cache that the web VMs read from before going to the database.",
    files: WEB_APP_FILES,
    checks: (r) => [parses(r), removedNothing(r), hasIcons(/redis|cache/)(r), passesReview(r)],
  },
  {
    id: "edit-label",
    prompt: "Call the database Orders DB.",
    files: WEB_APP_FILES,
    model: "fast",
    checks: (r) => [
      parses(r),
      removedNothing(r),
      {
        name: "a database is labelled Orders DB",
        ok: [...top(r.files).components.values()].some((c) => c.label === "Orders DB"),
      },
    ],
  },
  {
    id: "scene-outage",
    prompt: "Add a scene where the primary database is down.",
    files: WEB_APP_FILES,
    checks: (r) => [
      parses(r),
      removedNothing(r),
      {
        name: "a new scene has something down",
        ok: top(r.files).scenes.some(
          (s) =>
            !top(r.before).scenes.some((b) => b.name === s.name) &&
            s.entries.some((e) => e.state === "down"),
        ),
      },
    ],
  },
  {
    id: "aws-zones",
    prompt:
      "Put the two web servers in private subnets in two Availability Zones inside a VPC, with the load balancer in the VPC.",
    files: AWS_START,
    checks: (r) => [
      parses(r),
      passesReview(r),
      removedNothing(r),
      nests("availability-zone", "private-subnet")(r),
    ],
  },
  {
    id: "vague-asks-first",
    prompt: "Make me a data platform.",
    files: BLANK_FILES,
    checks: (r) => [stoppedWith("question", "plan")(r), unchanged(r)],
  },
];

/** Runs one case through a real turn. */
export async function runEval(args: {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly env: ToolEnv;
  readonly name: string;
  readonly case: EvalCase;
}): Promise<EvalResult> {
  const events: AssistantEvent[] = [];
  const started = Date.now();
  const outcome = await runTurn({
    provider: args.provider,
    model: args.model,
    name: args.name,
    request: {
      files: args.case.files,
      folder: "",
      selection: [],
      prompt: args.case.prompt,
      history: [],
      model: args.case.model ?? "auto",
    },
    env: args.env,
    emit: (event) => events.push(event),
    signal: AbortSignal.timeout(240_000),
  });
  const done = events.findLast((e) => e.type === "done");
  const files = done?.type === "done" && done.files !== null ? done.files : args.case.files;
  const text = events.flatMap((e) => (e.type === "text" ? [e.text] : [])).join("");
  const checks = args.case.checks({
    files,
    before: args.case.files,
    stop: outcome.stop,
    text,
    events,
  });
  return {
    id: args.case.id,
    checks,
    passed: checks.every((c) => c.ok),
    usage: outcome.usage,
    steps: outcome.steps,
    ms: Date.now() - started,
  };
}
