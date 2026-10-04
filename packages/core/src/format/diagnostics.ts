import type { Diagnostic, DiagnosticSeverity } from "../model/types";

/** Collects diagnostics while parsing; messages are plain language (FI-16). */
export class DiagnosticSink {
  readonly items: Diagnostic[] = [];

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
    this.add("error", at.file, at.line, at.column, message);
  }

  warning(at: Position, message: string): void {
    this.add("warning", at.file, at.line, at.column, message);
  }
}

export interface Position {
  readonly file: string;
  readonly line: number;
  readonly column: number;
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
