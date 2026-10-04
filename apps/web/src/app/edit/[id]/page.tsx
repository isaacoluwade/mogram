import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { getDiagram } from "@/server/diagrams/service";
import { CloudEditor } from "@/features/editor/persistence/cloud-editor";

export const metadata: Metadata = { title: "Editor", robots: { index: false, follow: false } };

/** The editor for a diagram in the signed-in person's account (owner only, AC-5). */
export default async function CloudEditorPage(props: PageProps<"/edit/[id]">) {
  const { id } = await props.params;
  const user = await currentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(`/edit/${id}`)}`);
  const diagram = await getDiagram(user.id, id);
  if (diagram === null) notFound();
  return <CloudEditor initial={diagram} />;
}
