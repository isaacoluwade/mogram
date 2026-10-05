// Generated from content/ by scripts/build-catalog.ts. Do not edit: run `pnpm build:catalog`.
/** Each topic's concept files, loaded the first time one of them is opened. */
export const TOPIC_LOADERS: Readonly<Record<string, () => Promise<{ readonly BODIES: Readonly<Record<string, string>> }>>> = {
  "scaling": () => import("./bodies/scaling.generated"),
  "reliability": () => import("./bodies/reliability.generated"),
  "networking": () => import("./bodies/networking.generated"),
  "messaging": () => import("./bodies/messaging.generated"),
  "delivery": () => import("./bodies/delivery.generated"),
};
