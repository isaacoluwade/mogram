import type { Metadata } from "next";
import { parseDeepLink } from "@/features/share/deep-link";
import { LocalViewer } from "@/features/viewer/local-viewer";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Preview of a browser draft, exactly as viewers would see it once shared. */
export default async function DraftPreviewPage(props: PageProps<"/draft/[id]/view">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  return (
    <LocalViewer
      id={id}
      initialLink={parseDeepLink(search)}
      present={search.present === "1"}
      record={search.record === "1"}
    />
  );
}
