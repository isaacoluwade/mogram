import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { getDiagram } from "@/server/diagrams/service";
import { parseDeepLink } from "@/features/share/deep-link";
import { Viewer } from "@/features/viewer/viewer";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** The owner's preview of a cloud diagram, exactly as viewers see it (with "what if" always on). */
export default async function CloudPreviewPage(props: PageProps<"/edit/[id]/view">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  const user = await currentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(`/edit/${id}/view`)}`);
  const diagram = await getDiagram(user.id, id);
  if (diagram === null) notFound();
  return (
    <Viewer
      files={diagram.files}
      initialLink={parseDeepLink(search)}
      present={search.present === "1"}
      allowViewerState
      homeHref={`/edit/${id}`}
      editHref={`/edit/${id}`}
      preview
    />
  );
}
