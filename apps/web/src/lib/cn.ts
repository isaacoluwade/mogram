import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know our custom tokens (styles/tokens.css); otherwise it reads
 * `text-caption` as a colour and silently drops it (or the colour) when combined with `text-fg`.
 * `cn.test.ts` checks these lists against tokens.css.
 */
export const FONT_SIZE_TOKENS = [
  "micro",
  "caption",
  "label",
  "body-sm",
  "body",
  "body-lg",
  "lead",
  "heading",
  "title",
  "title-lg",
  "field-xl",
  "fine",
  "pill",
  "footnote",
  "footer",
  "eyebrow",
  "checklist",
  "checklist-sm",
  "checklist-xs",
  "feature",
  "summary",
  "display-sm",
  "display",
  "display-lg",
  "display-cta",
] as const;

export const TRACKING_TOKENS = [
  "tightest",
  "display",
  "title",
  "snug",
  "wordmark",
  "wide",
  "eyebrow",
  "heading",
  "field",
] as const;

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZE_TOKENS] }],
      tracking: [{ tracking: [...TRACKING_TOKENS] }],
    },
  },
});

/** Joins class names and resolves Tailwind conflicts (later classes win). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
