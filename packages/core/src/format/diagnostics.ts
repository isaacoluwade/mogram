import type { Diagnostic, DiagnosticSeverity } from "../model/types";

/** Collects diagnostics while parsing; messages are plain language (FI-16). */
export class DiagnosticSink {
  readonly items: Diagnostic[] = [];
  /** Shared positions (inside a named style) already reported: once is enough. */
  private readonly sharedSeen = new Set<string>();

  add(
    severity: DiagnosticSeverity,
    file: string,
    line: number,
    column: number,
    message: string,
  ): void {
    this.items.push({ severity, file, line, column, message });
  }

  error(at: Position, message: string): void {
    if (this.repeated("error", at)) return;
    this.add("error", at.file, at.line, at.column, message);
  }

  warning(at: Position, message: string): void {
    if (this.repeated("warning", at)) return;
    this.add("warning", at.file, at.line, at.column, message);
  }

  private repeated(severity: DiagnosticSeverity, at: Position): boolean {
    if (at.shared !== true) return false;
    const key = `${severity}:${at.file}:${at.line}:${at.column}`;
    if (this.sharedSeen.has(key)) return true;
    this.sharedSeen.add(key);
    return false;
  }
}

export interface Position {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** In a named style, read with every element that takes it: reported once. */
  readonly shared?: boolean;
}

/** Sort for display: file, then line, errors first on the same line. */
export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1) ||
      a.column - b.column,
  );
}
