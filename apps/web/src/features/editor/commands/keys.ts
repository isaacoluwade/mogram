/**
 * Key combos as the command registry writes them ("mod+shift+z", "alt+shift+r", "shift+1", "?")
 * and how they match keyboard events (05-ui-shell-commands §4, §13.4). `mod` is ⌘ on Mac and
 * Ctrl elsewhere. A combo matches the typed character or, failing that, the physical key, so
 * Option combos on Mac (⌥⇧R types "‰") and shifted digits (⇧1 types "!") still match.
 */

export interface KeyCombo {
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
  /** Lower-case key: a character, or a name such as "arrowleft", "enter", "f2". */
  readonly key: string;
}

/** The parts of a keyboard event that matching needs (a plain object in tests). */
export interface KeyInput {
  readonly key: string;
  readonly code: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export function parseCombo(combo: string): KeyCombo {
  // "mod++" ends in an empty part after splitting: the key is "+".
  const parts = combo.endsWith("++") ? [...combo.slice(0, -2).split("+"), "+"] : combo.split("+");
  const key = parts[parts.length - 1] ?? "";
  const mods = new Set(parts.slice(0, -1));
  return { mod: mods.has("mod"), shift: mods.has("shift"), alt: mods.has("alt"), key };
}

/** Characters that need Shift on common layouts, so their combos don't also demand it. */
const SHIFTED = new Set([...'~!@#$%^&*()_+{}|:"<>?']);

const CODE_KEYS: Readonly<Record<string, string>> = {
  BracketLeft: "[",
  BracketRight: "]",
  Equal: "=",
  Minus: "-",
  Quote: "'",
  Slash: "/",
  Backslash: "\\",
  Comma: ",",
  Period: ".",
  Semicolon: ";",
  Backquote: "`",
  Space: "space",
};

/** The key a physical key code stands for on a US layout ("KeyA" → "a", "Digit1" → "1"). */
export function codeKey(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return CODE_KEYS[code] ?? code.toLowerCase();
}

function typedKey(key: string): string {
  return key === " " ? "space" : key.toLowerCase();
}

export function matchesCombo(event: KeyInput, combo: string | KeyCombo): boolean {
  const c = typeof combo === "string" ? parseCombo(combo) : combo;
  if (c.mod !== (event.metaKey || event.ctrlKey) || c.alt !== event.altKey) return false;
  const typed = typedKey(event.key);
  if (typed === c.key) return SHIFTED.has(c.key) || c.shift === event.shiftKey;
  // The physical key only stands in when a modifier changed the character typed: a bare "?"
  // is not "/" just because it shares the key.
  const modified = event.altKey || event.shiftKey || event.metaKey || event.ctrlKey;
  return modified && codeKey(event.code) === c.key && c.shift === event.shiftKey;
}

const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const KEY_NAMES: Readonly<Record<string, string>> = {
  backspace: "⌫",
  delete: "⌦",
  enter: "↵",
  escape: "Esc",
  tab: "Tab",
  space: "Space",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  arrows: "←↑→↓",
  drag: "Drag",
  dblclick: "Double-click",
};

/** "mod+shift+z" → "⇧⌘Z" on Mac, "Ctrl+Shift+Z" elsewhere. */
export function shortcutLabel(combo: string): string {
  const mac = isMac();
  const { key, ...mods } = parseCombo(combo);
  const keyLabel = KEY_NAMES[key] ?? key.toUpperCase();
  if (mac) {
    // Mac order: ⌥ ⇧ ⌘, then the key.
    return `${mods.alt ? "⌥" : ""}${mods.shift ? "⇧" : ""}${mods.mod ? "⌘" : ""}${keyLabel}`;
  }
  return [
    ...(mods.mod ? ["Ctrl"] : []),
    ...(mods.alt ? ["Alt"] : []),
    ...(mods.shift ? ["Shift"] : []),
    keyLabel,
  ].join("+");
}
