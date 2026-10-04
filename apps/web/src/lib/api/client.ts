import type {
  ApiErrorBody,
  DiagramDetail,
  DiagramSummary,
  RevisionSummary,
  SharedDiagram,
  Visibility,
} from "./contracts";

/**
 * Typed browser client for the REST API (D-7). Every call either returns the documented body or
 * throws an `ApiError` carrying the server's code and human-readable message.
 */

export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly currentVersion: number | null = null,
  ) {
    super(message);
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody & { currentVersion?: number } {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "message" in error && "code" in error;
}

async function request<T>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: string } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers: init.body === undefined ? {} : { "Content-Type": "application/json" },
      ...(init.body === undefined ? {} : { body: init.body }),
    });
  } catch {
    throw new ApiError(0, "offline", "Mogram couldn't reach the server. Check your connection.");
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorBody(body))
      throw new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.currentVersion ?? null,
      );
    throw new ApiError(response.status, "unknown", "Something went wrong. Please try again.");
  }
  return body as T;
}

const json = (value: unknown): string => JSON.stringify(value);

export interface SaveInput {
  readonly files: Record<string, string>;
  readonly baseVersion: number;
  readonly name?: string;
  readonly thumbnail?: string | null;
}

export const api = {
  listDiagrams: async (): Promise<DiagramSummary[]> =>
    (await request<{ diagrams: DiagramSummary[] }>("/api/diagrams")).diagrams,

  getDiagram: async (id: string): Promise<DiagramDetail> =>
    (await request<{ diagram: DiagramDetail }>(`/api/diagrams/${encodeURIComponent(id)}`)).diagram,

  createDiagram: async (input: {
    name: string;
    files: Record<string, string>;
    thumbnail?: string | null;
  }): Promise<DiagramDetail> =>
    (
      await request<{ diagram: DiagramDetail }>("/api/diagrams", {
        method: "POST",
        body: json(input),
      })
    ).diagram,

  /** Throws `ApiError` with code "conflict" and `currentVersion` when a newer version exists. */
  saveDiagram: (id: string, input: SaveInput): Promise<{ version: number; updatedAt: string }> =>
    request(`/api/diagrams/${encodeURIComponent(id)}`, { method: "PUT", body: json(input) }),

  /** A rename writes the new name into the YAML too (new version); a thumbnail is metadata only. */
  updateDiagram: async (
    id: string,
    input: { name?: string; thumbnail?: string | null },
  ): Promise<DiagramSummary> =>
    (
      await request<{ diagram: DiagramSummary }>(`/api/diagrams/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: json(input),
      })
    ).diagram,

  deleteDiagram: (id: string): Promise<void> =>
    request(`/api/diagrams/${encodeURIComponent(id)}`, { method: "DELETE" }),

  duplicateDiagram: async (id: string): Promise<DiagramDetail> =>
    (
      await request<{ diagram: DiagramDetail }>(
        `/api/diagrams/${encodeURIComponent(id)}/duplicate`,
        { method: "POST" },
      )
    ).diagram,

  updateShare: async (
    id: string,
    input: { visibility: Visibility; allowViewerState: boolean; regenerateLink?: boolean },
  ): Promise<DiagramDetail> =>
    (
      await request<{ diagram: DiagramDetail }>(`/api/diagrams/${encodeURIComponent(id)}/share`, {
        method: "PUT",
        body: json(input),
      })
    ).diagram,

  listRevisions: async (id: string): Promise<RevisionSummary[]> =>
    (
      await request<{ revisions: RevisionSummary[] }>(
        `/api/diagrams/${encodeURIComponent(id)}/revisions`,
      )
    ).revisions,

  getRevisionFiles: async (id: string, revisionId: string): Promise<Record<string, string>> =>
    (
      await request<{ files: Record<string, string> }>(
        `/api/diagrams/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`,
      )
    ).files,

  restoreRevision: (
    id: string,
    revisionId: string,
  ): Promise<{ version: number; updatedAt: string }> =>
    request(
      `/api/diagrams/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/restore`,
      { method: "POST" },
    ),

  getShared: async (shareId: string): Promise<SharedDiagram> =>
    (await request<{ diagram: SharedDiagram }>(`/api/share/${encodeURIComponent(shareId)}`))
      .diagram,
};
