import { linear, radial, type Paint } from "./paint";

/**
 * Colour presets for the colour picker (ED-24). The default rows are a short, balanced set; the
 * full palette and the gradient groups open from "See all", so the picker stays small until
 * someone wants more.
 *
 * The full palette is Tailwind CSS's colour palette (MIT licence, © Tailwind Labs), seven shades
 * per hue from dark to light, because its shades are tuned to look even across hues.
 */

export interface NamedColor {
  readonly name: string;
  readonly color: string;
}

/** The picker's first rows: neutrals, then warm, cool and green hues (as Canva's defaults). */
export const DEFAULT_SOLIDS: readonly NamedColor[] = [
  { name: "Black", color: "#000000" },
  { name: "Charcoal", color: "#404040" },
  { name: "Dark grey", color: "#737373" },
  { name: "Grey", color: "#a3a3a3" },
  { name: "Silver", color: "#d4d4d4" },
  { name: "Light grey", color: "#f5f5f5" },
  { name: "White", color: "#ffffff" },
  { name: "Red", color: "#ef4444" },
  { name: "Coral", color: "#f87171" },
  { name: "Pink", color: "#ec4899" },
  { name: "Lavender", color: "#d8b4fe" },
  { name: "Purple", color: "#a855f7" },
  { name: "Violet", color: "#8b5cf6" },
  { name: "Indigo", color: "#4f46e5" },
  { name: "Teal", color: "#0d9488" },
  { name: "Turquoise", color: "#22d3ee" },
  { name: "Aqua", color: "#67e8f9" },
  { name: "Sky blue", color: "#38bdf8" },
  { name: "Blue", color: "#3b82f6" },
  { name: "Navy", color: "#1e3a8a" },
  { name: "Ultramarine", color: "#312e81" },
  { name: "Green", color: "#22c55e" },
  { name: "Grass", color: "#84cc16" },
  { name: "Lime", color: "#bef264" },
  { name: "Yellow", color: "#facc15" },
  { name: "Amber", color: "#f59e0b" },
  { name: "Orange", color: "#f97316" },
  { name: "Brown", color: "#92400e" },
];

/** Tailwind shades 900, 700, 600, 500, 400, 300 and 100 for each hue, dark to light. */
const PALETTE_HUES: readonly (readonly [name: string, shades: readonly string[]])[] = [
  ["Slate", ["#0f172a", "#334155", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#f1f5f9"]],
  ["Grey", ["#171717", "#404040", "#525252", "#737373", "#a3a3a3", "#d4d4d4", "#f5f5f5"]],
  ["Stone", ["#1c1917", "#44403c", "#57534e", "#78716c", "#a8a29e", "#d6d3d1", "#f5f5f4"]],
  ["Red", ["#7f1d1d", "#b91c1c", "#dc2626", "#ef4444", "#f87171", "#fca5a5", "#fee2e2"]],
  ["Orange", ["#7c2d12", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fdba74", "#ffedd5"]],
  ["Amber", ["#78350f", "#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fef3c7"]],
  ["Yellow", ["#713f12", "#a16207", "#ca8a04", "#eab308", "#facc15", "#fde047", "#fef9c3"]],
  ["Lime", ["#365314", "#4d7c0f", "#65a30d", "#84cc16", "#a3e635", "#bef264", "#ecfccb"]],
  ["Green", ["#14532d", "#15803d", "#16a34a", "#22c55e", "#4ade80", "#86efac", "#dcfce7"]],
  ["Emerald", ["#064e3b", "#047857", "#059669", "#10b981", "#34d399", "#6ee7b7", "#d1fae5"]],
  ["Teal", ["#134e4a", "#0f766e", "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#ccfbf1"]],
  ["Cyan", ["#164e63", "#0e7490", "#0891b2", "#06b6d4", "#22d3ee", "#67e8f9", "#cffafe"]],
  ["Sky", ["#0c4a6e", "#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc", "#e0f2fe"]],
  ["Blue", ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe"]],
  ["Indigo", ["#312e81", "#4338ca", "#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#e0e7ff"]],
  ["Violet", ["#4c1d95", "#6d28d9", "#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd", "#ede9fe"]],
  ["Purple", ["#581c87", "#7e22ce", "#9333ea", "#a855f7", "#c084fc", "#d8b4fe", "#f3e8ff"]],
  ["Fuchsia", ["#701a75", "#a21caf", "#c026d3", "#d946ef", "#e879f9", "#f0abfc", "#fae8ff"]],
  ["Pink", ["#831843", "#be185d", "#db2777", "#ec4899", "#f472b6", "#f9a8d4", "#fce7f3"]],
  ["Rose", ["#881337", "#be123c", "#e11d48", "#f43f5e", "#fb7185", "#fda4af", "#ffe4e6"]],
];

const SHADE_NAMES = ["darkest", "dark", "deep", "", "light", "pale", "palest"] as const;

/** The full palette, a row per hue, dark to light. */
export const PALETTE: readonly (readonly NamedColor[])[] = PALETTE_HUES.map(([hue, shades]) =>
  shades.map((color, index) => ({
    name: SHADE_NAMES[index] === "" ? hue : `${hue} ${SHADE_NAMES[index] ?? ""}`.trim(),
    color,
  })),
);

export interface NamedPaint {
  readonly name: string;
  readonly paint: Paint;
}

const named = (name: string, paint: Paint): NamedPaint => ({ name, paint });

/** Gradients in groups, as the picker's "See all" shows them. The first group's first row is the default row. */
export const GRADIENT_GROUPS: readonly {
  readonly name: string;
  readonly gradients: readonly NamedPaint[];
}[] = [
  {
    name: "Cool tones",
    gradients: [
      named("Ocean", linear(135, "#0ea5e9", "#6366f1")),
      named("Deep sea", linear(180, "#1e3a8a", "#0f172a")),
      named("Lagoon", linear(135, "#14b8a6", "#0e7490")),
      named("Mint", linear(135, "#a7f3d0", "#5eead4")),
      named("Frost", linear(180, "#e0f2fe", "#c7d2fe")),
      named("Glacier", linear(135, "#bae6fd", "#818cf8")),
      named("Aurora", linear(135, "#22d3ee", "#a855f7")),
      named("Midnight blue", radial({ x: 0.5, y: 0 }, ["#1e3a8a", "#020617"], { x: 1.2, y: 0.8 })),
    ],
  },
  {
    name: "Warm tones",
    gradients: [
      named("Sunset", linear(135, "#f97316", "#db2777")),
      named("Peach", linear(135, "#fecaca", "#fed7aa")),
      named("Berry", linear(135, "#431043", "#d34681")),
      named("Ember", linear(160, "#7c2d12", "#1c0a05")),
      named("Honey", linear(180, "#fde68a", "#f59e0b")),
      named("Rose gold", linear(135, "#fda4af", "#d6a77a")),
      named("Flamingo", linear(135, "#f472b6", "#fb923c")),
      named("Wine", radial({ x: 0.5, y: 0.5 }, ["#9f1239", "#2a0612"])),
    ],
  },
  {
    name: "Monochromatic",
    gradients: [
      named("Graphite", linear(180, "#404040", "#0a0a0a")),
      named("Silver", linear(180, "#f5f5f5", "#a3a3a3")),
      named("Paper", linear(180, "#ffffff", "#e7e5e4")),
      named("Night red", linear(180, "#7f1d1d", "#2a0808")),
      named("Copper", linear(180, "#9a3412", "#431407")),
      named("Gold", linear(180, "#ca8a04", "#713f12")),
      named("Forest", linear(160, "#1f3528", "#0a140e")),
      named("Lagoon deep", linear(180, "#115e59", "#042f2e")),
      named("Indigo night", linear(180, "#3730a3", "#1e1b4b")),
      named("Plum", linear(180, "#6b21a8", "#2e1065")),
      named("Blush", linear(180, "#ffe4e6", "#fda4af")),
      named("Sand", linear(180, "#f4ebe1", "#eadec9")),
      named("Pistachio", linear(180, "#ecfccb", "#bef264")),
      named("Lilac", linear(180, "#f3e8ff", "#d8b4fe")),
    ],
  },
  {
    name: "Vivid",
    gradients: [
      named("Neon", linear(135, "#a855f7", "#ec4899", "#f97316")),
      named("Electric", linear(135, "#06b6d4", "#3b82f6", "#8b5cf6")),
      named("Citrus", linear(135, "#facc15", "#84cc16")),
      named("Tropical", linear(135, "#22c55e", "#06b6d4")),
      named("Candy", linear(90, "#f9a8d4", "#a5b4fc")),
      named("Dusk", linear(160, "#211b33", "#121019", "#0c0b10")),
      named(
        "Spotlight",
        radial({ x: 0.5, y: 0 }, ["#3a3a3a", "#151515", "#0c0c0c"], { x: 1.2, y: 0.8 }),
      ),
      named("Halo", radial({ x: 0.5, y: 0.5 }, ["#4f46e5", "#0f0a2e"])),
      named("Prism", linear(135, "#f43f5e", "#f59e0b", "#10b981", "#3b82f6")),
      named("Lagoon glow", radial({ x: 0, y: 0 }, ["#5eead4", "#0f172a"])),
    ],
  },
];

/** The two rows of gradients the picker shows before "See all". */
export const DEFAULT_GRADIENTS: readonly NamedPaint[] = [
  ...(GRADIENT_GROUPS[0]?.gradients.slice(0, 4) ?? []),
  ...(GRADIENT_GROUPS[1]?.gradients.slice(0, 4) ?? []),
  ...(GRADIENT_GROUPS[3]?.gradients.slice(0, 6) ?? []),
];

/** Sticky note fills, in the order the toolbar offers them; the first is the default. */
export const NOTE_COLORS: readonly NamedColor[] = [
  { name: "Yellow", color: "#fef3a0" },
  { name: "Orange", color: "#fed7aa" },
  { name: "Pink", color: "#fbcfe8" },
  { name: "Red", color: "#fecaca" },
  { name: "Purple", color: "#ddd6fe" },
  { name: "Blue", color: "#bfdbfe" },
  { name: "Teal", color: "#a7f3d0" },
  { name: "Green", color: "#bbf7d0" },
  { name: "Grey", color: "#e5e7eb" },
  { name: "White", color: "#ffffff" },
];

/** Every named solid colour, for searching the picker by name ("blue"). */
export function namedColors(): readonly NamedColor[] {
  const seen = new Set<string>();
  const all: NamedColor[] = [];
  for (const entry of [...DEFAULT_SOLIDS, ...PALETTE.flat(), ...NOTE_COLORS]) {
    if (seen.has(entry.color)) continue;
    seen.add(entry.color);
    all.push(entry);
  }
  return all;
}
