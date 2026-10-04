"use client";

import { useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ProjectFiles } from "@mogram/core/model";
import type { DiagramSummary } from "@/lib/api/contracts";
import { api } from "@/lib/api/client";
import { renderThumbnail } from "@/features/export/export";
import { downloadProject } from "@/features/files/download";
import { nameOf, withName } from "@/features/files/project-name";
import {
  createDraft,
  deleteDraft,
  duplicateDraft,
  getDraft,
  listDrafts,
  saveDraft,
  setDraftThumbnail,
  type DraftSummary,
} from "@/features/drafts/drafts";
import { templateById } from "@/features/templates";

/** One row on the dashboard: a cloud diagram or a draft in this browser. */
export interface DashboardItem {
  readonly kind: "cloud" | "draft";
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
  readonly thumbnail: string | null;
  readonly visibility: "private" | "link" | null;
  readonly href: string;
  readonly previewHref: string;
}

const fromCloud = (d: DiagramSummary): DashboardItem => ({
  kind: "cloud",
  id: d.id,
  name: d.name,
  updatedAt: d.updatedAt,
  thumbnail: d.thumbnail,
  visibility: d.visibility,
  href: `/edit/${d.id}`,
  previewHref: `/edit/${d.id}/view`,
});

const fromDraft = (d: DraftSummary): DashboardItem => ({
  kind: "draft",
  id: d.id,
  name: d.name,
  updatedAt: d.updatedAt,
  thumbnail: d.thumbnail,
  visibility: null,
  href: `/draft/${d.id}`,
  previewHref: `/draft/${d.id}/view`,
});

const message = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/**
 * Everything the dashboard reads and does (AC-1 … AC-4). Signed in, new diagrams go to the
 * account; signed out, they stay in this browser.
 */
export function useDashboard(signedIn: boolean, initialCloud: readonly DiagramSummary[]) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const thumbnailsTried = useRef(new Set<string>());

  const cloud = useQuery({
    queryKey: ["diagrams"],
    queryFn: api.listDiagrams,
    enabled: signedIn,
    initialData: signedIn ? [...initialCloud] : [],
  });
  const drafts = useQuery({ queryKey: ["drafts"], queryFn: listDrafts, staleTime: 0 });

  const items = useMemo<DashboardItem[]>(
    () =>
      [...(cloud.data ?? []).map(fromCloud), ...(drafts.data ?? []).map(fromDraft)].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [cloud.data, drafts.data],
  );

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["diagrams"] }),
      queryClient.invalidateQueries({ queryKey: ["drafts"] }),
    ]);

  /** Creates a diagram (cloud when signed in, otherwise a browser draft) and opens it. */
  const create = useMutation({
    mutationFn: async (input: { name: string; files: ProjectFiles }) => {
      if (signedIn) {
        const thumbnail = await renderThumbnail(input.files).catch(() => null);
        const created = await api.createDiagram({
          name: input.name,
          files: input.files,
          thumbnail,
        });
        return `/edit/${created.id}`;
      }
      const draft = await createDraft(input.name, input.files);
      return `/draft/${draft.id}`;
    },
    onSuccess: (href) => router.push(href as Parameters<typeof router.push>[0]),
    onError: (error) => toast.error(message(error, "Couldn't create the diagram.")),
  });

  const createFromTemplate = (templateId: string) => {
    const template = templateById(templateId);
    const name = template.id === "blank" ? "Untitled diagram" : template.name;
    create.mutate({
      name,
      files: template.id === "blank" ? template.files : withName(template.files, name),
    });
  };

  const createFromFiles = (files: ProjectFiles) => create.mutate({ name: nameOf(files), files });

  const rename = useMutation({
    mutationFn: async ({ item, name }: { item: DashboardItem; name: string }) => {
      if (item.kind === "cloud") {
        await api.updateDiagram(item.id, { name });
        return;
      }
      const draft = await getDraft(item.id);
      if (draft !== null) await saveDraft(item.id, { name, files: withName(draft.files, name) });
    },
    onSuccess: refresh,
    onError: (error) => toast.error(message(error, "Couldn't rename it.")),
  });

  const duplicate = useMutation({
    mutationFn: async (item: DashboardItem) => {
      if (item.kind === "cloud") await api.duplicateDiagram(item.id);
      else await duplicateDraft(item.id);
    },
    onSuccess: async () => {
      await refresh();
      toast("Duplicated.");
    },
    onError: (error) => toast.error(message(error, "Couldn't duplicate it.")),
  });

  const remove = useMutation({
    mutationFn: async (item: DashboardItem) => {
      if (item.kind === "cloud") await api.deleteDiagram(item.id);
      else await deleteDraft(item.id);
    },
    onSuccess: async () => {
      await refresh();
      toast("Deleted.");
    },
    onError: (error) => toast.error(message(error, "Couldn't delete it.")),
  });

  const download = async (item: DashboardItem) => {
    try {
      const files =
        item.kind === "cloud"
          ? (await api.getDiagram(item.id)).files
          : (await getDraft(item.id))?.files;
      if (files === undefined) throw new Error("That draft isn't in this browser any more.");
      await downloadProject(files, item.name);
    } catch (error) {
      toast.error(message(error, "Couldn't download it."));
    }
  };

  /** A browser draft becomes a private diagram in the account (AC-3). */
  const moveToAccount = useMutation({
    mutationFn: async (item: DashboardItem) => {
      const draft = await getDraft(item.id);
      if (draft === null) throw new Error("That draft isn't in this browser any more.");
      const thumbnail = item.thumbnail ?? (await renderThumbnail(draft.files).catch(() => null));
      await api.createDiagram({ name: draft.name, files: draft.files, thumbnail });
      await deleteDraft(item.id);
    },
    onSuccess: async () => {
      await refresh();
      toast("Saved to your account. It stays private until you share it.");
    },
    onError: (error) => toast.error(message(error, "Couldn't save it to your account.")),
  });

  /** Drafts made before thumbnails existed get one the first time the dashboard shows them. */
  const backfillThumbnail = async (item: DashboardItem) => {
    if (item.kind !== "draft" || item.thumbnail !== null || thumbnailsTried.current.has(item.id))
      return;
    thumbnailsTried.current.add(item.id);
    try {
      const draft = await getDraft(item.id);
      if (draft === null) return;
      await setDraftThumbnail(item.id, await renderThumbnail(draft.files));
      await queryClient.invalidateQueries({ queryKey: ["drafts"] });
    } catch {
      // Best effort: the card keeps its placeholder, and the next save in the editor makes one.
    }
  };

  return {
    items,
    loading: drafts.isPending || (signedIn && cloud.isPending),
    cloudError: cloud.error,
    creating: create.isPending,
    createFromTemplate,
    createFromFiles,
    rename: (item: DashboardItem, name: string) => rename.mutate({ item, name }),
    duplicate: (item: DashboardItem) => duplicate.mutate(item),
    remove: (item: DashboardItem) => remove.mutate(item),
    download,
    moveToAccount: (item: DashboardItem) => moveToAccount.mutate(item),
    backfillThumbnail,
  };
}
