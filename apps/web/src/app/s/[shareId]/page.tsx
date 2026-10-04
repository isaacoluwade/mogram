import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getSharedDiagram } from "@/server/diagrams/service";
import { parseDeepLink } from "@/features/share/deep-link";
import { Viewer } from "@/features/viewer/viewer";

/** One database read per request, shared by the metadata and the page. */
const loadShared = cache(getSharedDiagram);

export async function generateMetadata(props: PageProps<"/s/[shareId]">): Promise<Metadata> {
  const { shareId } = await props.params;
  const shared = await loadShared(shareId);
  return {
    title: shared?.name ?? "Diagram not found",
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
    <Viewer
      files={shared.files}
      initialLink={parseDeepLink(search)}
      present={search.present === "1"}
      allowViewerState={shared.allowViewerState}
      homeHref="/"
      editHref={null}
    />
  );
}
