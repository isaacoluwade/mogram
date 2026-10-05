// Generated from content/ by scripts/build-catalog.ts. Do not edit: run `pnpm build:catalog`.
import { BODIES as T0 } from "./bodies/scaling.generated";
import { BODIES as T1 } from "./bodies/reliability.generated";
import { BODIES as T2 } from "./bodies/networking.generated";
import { BODIES as T3 } from "./bodies/messaging.generated";
import { BODIES as T4 } from "./bodies/delivery.generated";

/** Every concept's file, by id: for the server and tests (the editor loads them a topic at a time). */
export const ALL_CONCEPTS: Readonly<Record<string, string>> = { ...T0, ...T1, ...T2, ...T3, ...T4 };
