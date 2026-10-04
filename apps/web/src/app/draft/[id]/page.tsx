import type { Metadata } from "next";
import { LocalEditor } from "@/features/editor/persistence/local-editor";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

/** The editor for a draft kept in this browser (AC-1). The draft itself is read on the client. */
export default async function DraftEditorPage(props: PageProps<"/draft/[id]">) {
  const { id } = await props.params;
  return <LocalEditor id={id} />;
}
