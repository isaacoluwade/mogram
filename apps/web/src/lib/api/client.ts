import type { VersionSource } from "@/lib/history/rules";
import type {
  ApiErrorBody,
  DiagramDetail,
  DiagramSummary,
  RevisionSummary,
  SharedDiagram,
  Visibility,
} from "./contracts";

type Files = Readonly<Record<string, string>>;

/**
 * What runs before a project's files go to the server. The assets feature sets it (D-101): it
 * uploads the pictures and recordings the files point at that the account doesn't have yet.
 */
let prepareFiles: (files: Files) => Promise<void> = () => Promise.resolve();

export function beforeFilesSaved(prepare: (files: Files) => Promise<void>): void {
  prepareFiles = prepare;
}

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
  /** Make this save its own version: an assistant turn, or one given a name. */
  readonly checkpoint?: {
    readonly source: "ai" | "named";
    readonly label?: string;
    readonly name?: string;
  };
}

export const api = {
  listDiagrams: async (): Promise<DiagramSummary[]> =>
    (await request<{ diagrams: DiagramSummary[] }>("/api/diagrams")).diagrams,

  getDiagram: async (id: string): Promise<DiagramDetail> => {
    const path = `/api/diagrams/${encodeURIComponent(id)}`;
    const { diagram } = await request<{ diagram: DiagramDetail }>(path);
    return diagram;
  },

  createDiagram: async (input: {
    name: string;
    files: Record<string, string>;
    thumbnail?: string | null;
    source?: "create" | "import";
  }): Promise<DiagramDetail> => {
    await prepareFiles(input.files);
    return (
      await request<{ diagram: DiagramDetail }>("/api/diagrams", {
        method: "POST",
        body: json(input),
      })
    ).diagram;
  },

  /** Throws `ApiError` with code "conflict" and `currentVersion` when a newer version exists. */
  saveDiagram: async (
    id: string,
    input: SaveInput,
  ): Promise<{ version: number; updatedAt: string }> => {
    await prepareFiles(input.files);
    return request(`/api/diagrams/${encodeURIComponent(id)}`, { method: "PUT", body: json(input) });
  },

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

  duplicateDiagram: async (id: string, revisionId?: string): Promise<DiagramDetail> =>
    (
      await request<{ diagram: DiagramDetail }>(
        `/api/diagrams/${encodeURIComponent(id)}/duplicate`,
        revisionId === undefined
          ? { method: "POST" }
          : { method: "POST", body: json({ revisionId }) },
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

  getRevisionFiles: async (id: string, revisionId: string): Promise<Record<string, string>> => {
    const { files } = await request<{ files: Record<string, string> }>(
      `/api/diagrams/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`,
    );
    return files;
  },

  nameRevision: (id: string, revisionId: string, name: string | null): Promise<void> =>
    request(`/api/diagrams/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`, {
      method: "PATCH",
      body: json({ name }),
    }),

  nameCurrentVersion: (id: string, name: string): Promise<void> =>
    request(`/api/diagrams/${encodeURIComponent(id)}/revisions`, {
      method: "POST",
      body: json({ name }),
    }),

  importVersions: async (
    id: string,
    versions: readonly {
      files: Record<string, string>;
      createdAt: string;
      name: string | null;
      source: VersionSource;
      label: string | null;
      restoredFromAt: string | null;
    }[],
  ): Promise<{ imported: number }> => {
    for (const version of versions) await prepareFiles(version.files);
    return request(`/api/diagrams/${encodeURIComponent(id)}/revisions/import`, {
      method: "POST",
      body: json({ versions }),
    });
  },

  restoreRevision: (
    id: string,
    revisionId: string,
  ): Promise<{ version: number; updatedAt: string }> =>
    request(
      `/api/diagrams/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}/restore`,
      { method: "POST" },
    ),

  getShared: async (shareId: string): Promise<SharedDiagram> => {
    const path = `/api/share/${encodeURIComponent(shareId)}`;
    const { diagram } = await request<{ diagram: SharedDiagram }>(path);
    return diagram;
  },
};
