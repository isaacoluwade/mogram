"use client";

import { CODE_METRICS } from "@mogram/core/presets";
import type { Token } from "@mogram/core/code";
import type { SceneCode, ScenePart } from "../scene";
import { fontStack } from "../fonts";
import { codeTokenColors } from "../theme";
import { PartLooks } from "./part-looks";
import { PresenceGroup } from "./presence";
import { FOCUS_DIM, useRender } from "./render-context";

/** A line's tokens cut to `columns` characters, the last of them `…` when it's cut. */
function cut(tokens: readonly Token[], columns: number): readonly Token[] {
  const length = tokens.reduce((sum, token) => sum + token.text.length, 0);
  if (length <= columns) return tokens;
  const kept: Token[] = [];
  let room = Math.max(0, columns - 1);
  for (const token of tokens) {
    if (room === 0) break;
    const text = token.text.slice(0, room);
    kept.push({ text, kind: token.kind });
    room -= text.length;
  }
  if (columns > 0) kept.push({ text: "…", kind: "plain" });
  return kept;
}

/**
 * A code listing (D-103): every line kept exactly, never wrapped, coloured by its language, cut
 * with `…` where the element is too narrow. A part's lines can be washed, marked, faded,
 * hidden (they go blank; nothing below moves) and focused (the other lines dim).
 */
export function CodeNode({
  code,
  name,
  parts,
  width,
  height,
}: {
  code: SceneCode;
  name: string;
  parts: readonly ScenePart[];
  width: number;
  height: number;
}) {
  const { theme, focus } = useRender();
  const colors = codeTokenColors(theme);
  const { padding, header: headerHeight, lineHeight, advance } = CODE_METRICS;
  const size = code.fontSize;
  const header = code.title === null ? 0 : headerHeight;
  const step = size * lineHeight;
  const last = code.first + code.lines.length - 1;
  const gutter = code.numbers ? (String(Math.max(1, last)).length + 2) * size * advance : 0;
  const columns = Math.max(0, Math.floor((width - padding * 2 - gutter) / (size * advance)));
  const rows = Math.max(0, Math.floor((height - padding * 2 - header) / step));

  // While something inside this listing is in focus, the lines that aren't dim.
  const focused = parts.filter((part) => focus?.has(part.target) === true);
  const dimmed = focus !== null && focused.length > 0 && !focus.has(name);
  const inFocus = (line: number) =>
    focused.some((part) => part.kind === "lines" && part.first <= line && part.last >= line);
  const covering = (line: number) =>
    parts.filter((part) => part.kind === "lines" && part.first <= line && part.last >= line);
  // How strongly a line is there: as its weakest part, before and after the change.
  const presence = (line: number) => {
    const over = covering(line);
    const strength = (end: "from" | "to") =>
      over.reduce((least, part) => Math.min(least, part.show[end]), 1);
    return { from: strength("from"), to: strength("to") };
  };

  return (
    <g data-part="code" fontFamily={fontStack("mono")}>
      {code.title !== null ? (
        <text
          data-part="code-title"
          x={padding}
          y={padding + 14}
          fontSize={14}
          fill={theme.textMuted}
          opacity={dimmed ? FOCUS_DIM : 1}
          xmlSpace="preserve"
        >
          {code.title}
        </text>
      ) : null}
      {code.missing ? (
        <text
          x={padding}
          y={padding + header + size}
          fontSize={Math.min(size, 16)}
          fill={theme.textMuted}
        >
          {"This listing's text isn't there."}
        </text>
      ) : (
        code.lines.slice(0, rows).map((tokens, index) => {
          const line = code.first + index;
          const y = padding + header + index * step + size;
          return (
            <PresenceGroup key={line} pair={presence(line)}>
              <g data-code-line={line} opacity={dimmed && !inFocus(line) ? FOCUS_DIM : 1}>
                {code.numbers ? (
                  <text
                    x={padding + gutter - size * advance * 1.5}
                    y={y}
                    fontSize={size}
                    textAnchor="end"
                    fill={theme.textMuted}
                  >
                    {line}
                  </text>
                ) : null}
                <text x={padding + gutter} y={y} fontSize={size} xmlSpace="preserve">
                  {cut(tokens, columns).map((token, at) => (
                    <tspan key={at} fill={colors[token.kind]}>
                      {token.text}
                    </tspan>
                  ))}
                </text>
              </g>
            </PresenceGroup>
          );
        })
      )}
      {parts.map((part) => (
        <PartLooks key={part.target} part={part} markAt={{ x: 2, y: part.box.y + size * 0.75 }} />
      ))}
    </g>
  );
}
