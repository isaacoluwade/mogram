import type { Metadata } from "next";
import { parseDeepLink } from "@/features/share/deep-link";
import { LocalEditor } from "@/features/editor/persistence/local-editor";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

/** The editor for a draft kept in this browser (AC-1). The draft itself is read on the client. */
export default async function DraftEditorPage(props: PageProps<"/draft/[id]">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  const link = parseDeepLink(search);
  return <LocalEditor id={id} root={link.root ?? ""} slide={link.slide} />;
}
