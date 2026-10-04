// Template files are imported as their text (`turbopack.rules` in next.config.ts, and the
// raw-text plugin in vitest.config.mts).
declare module "*.yaml" {
  const text: string;
  export default text;
}

declare module "*.md" {
  const text: string;
  export default text;
}
