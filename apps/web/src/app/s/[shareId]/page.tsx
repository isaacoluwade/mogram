import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { deckInfo } from "@mogram/core/deck";
import { parseDiagram } from "@mogram/core/format";
import { DiagramLoader } from "@mogram/core/nested";
import { getSharedDiagram } from "@/server/diagrams/service";
import { parseDeepLink } from "@/features/share/deep-link";
import { ProjectViewer } from "@/features/deck/project-viewer";

/** One database read per request, shared by the metadata and the page. */
const loadShared = cache(getSharedDiagram);

export async function generateMetadata(props: PageProps<"/s/[shareId]">): Promise<Metadata> {
  const { shareId } = await props.params;
  const shared = await loadShared(shareId);
  // A deck says it's one, and how long: what someone deciding to open a talk wants to know.
  const deck = shared === null ? null : deckInfo(shared.files, new DiagramLoader(shared.files));
  const description =
    shared === null
      ? undefined
      : deck !== null
        ? `A deck of ${deck.slides} ${deck.slides === 1 ? "slide" : "slides"} on Mogram.`
        : (parseDiagram(shared.files).diagram.settings.description ?? undefined);
  return {
    title: shared?.name ?? "Diagram not found",
    ...(description === undefined ? {} : { description }),
    // Share links are unlisted: never in search results, never sending the URL onward.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

/** A share link (SH-1, SH-5): the latest saved version, interactive, no sign-up. */
export default async function SharedDiagramPage(props: PageProps<"/s/[shareId]">) {
  const [{ shareId }, search] = await Promise.all([props.params, props.searchParams]);
  const shared = await loadShared(shareId);
  if (shared === null) notFound();
  return (
    <ProjectViewer
      files={shared.files}
      assetBase={`/api/share/${shareId}`}
      initialLink={parseDeepLink(search)}
      present={search.present === "1"}
      record={search.record === "1"}
      allowViewerState={shared.allowViewerState}
      homeHref="/"
      editHref={null}
    />
  );
}
