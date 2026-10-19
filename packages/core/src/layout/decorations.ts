import type { Decoration, GridSize, TextStyle } from "../model/types";
import { estimateTextWidth } from "./geometry";

const TEXT_SIZES: Readonly<Record<TextStyle, number>> = {
  title: 28,
  heading: 20,
  body: 14,
  caption: 12,
};

export const TEXT_LINE_HEIGHT = 1.4;

export function textStyleSize(style: TextStyle): number {
  return TEXT_SIZES[style];
}

export function decorationSize(decoration: Decoration): GridSize {
  switch (decoration.variant) {
    case "zone":
    case "note":
      return decoration.size;
    case "label":
      return { w: Math.max(4, Math.ceil((estimateTextWidth(decoration.text, 12) + 24) / 8)), h: 3 };
    case "text": {
      const fontSize = decoration.look.fontSize ?? TEXT_SIZES[decoration.style];
      const lines = decoration.text.split("\n");
      const widest = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)));
      const width = decoration.width;
      let lineCount = lines.length;
      if (width !== null) {
        lineCount = 0;
        for (const line of lines) {
          let used = 0;
          lineCount += 1;
          for (const word of line.trim().split(/\s+/)) {
            const wordWidth = estimateTextWidth(word, fontSize);
            const space = used === 0 ? 0 : estimateTextWidth(" ", fontSize);
            if (used > 0 && used + space + wordWidth > width * 8) {
              lineCount += 1;
              used = wordWidth;
            } else used += space + wordWidth;
          }
        }
      }
      return {
        w: width ?? Math.max(2, Math.ceil(widest / 8)),
        h: Math.max(2, Math.ceil((fontSize * TEXT_LINE_HEIGHT * lineCount) / 8)),
      };
    }
  }
}
