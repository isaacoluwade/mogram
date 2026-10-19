import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { getDiagram } from "@/server/diagrams/service";
import { prompterChannel } from "@/features/prompter/channel";
import { parseDeepLink } from "@/features/share/deep-link";
import { ProjectViewer } from "@/features/deck/project-viewer";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** The owner's preview of a cloud diagram, exactly as viewers see it (with "what if" always on). */
export default async function CloudPreviewPage(props: PageProps<"/edit/[id]/view">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  const user = await currentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(`/edit/${id}/view`)}`);
  const diagram = await getDiagram(user.id, id);
  if (diagram === null) notFound();
  return (
    <ProjectViewer
      files={diagram.files}
      assetBase={`/api/diagrams/${id}`}
      initialLink={parseDeepLink(search)}
      present={search.present === "1"}
      record={search.record === "1"}
      allowViewerState
      homeHref={`/edit/${id}`}
      editHref={`/edit/${id}`}
      preview
      prompter={{ href: `/edit/${id}/prompter`, channel: prompterChannel(id) }}
    />
  );
}
