import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { getDiagram } from "@/server/diagrams/service";
import { parseDeepLink } from "@/features/share/deep-link";
import { prompterChannel } from "@/features/prompter/channel";
import { ProjectPrompter } from "@/features/prompter/project-prompter";

export const metadata: Metadata = { title: "Script", robots: { index: false, follow: false } };

/** The Script window of a cloud diagram, for its owner to read and record (D-96, D-105). */
export default async function CloudPrompterPage(props: PageProps<"/edit/[id]/prompter">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  const user = await currentUser();
  if (user === null) redirect(`/sign-in?next=${encodeURIComponent(`/edit/${id}/prompter`)}`);
  const diagram = await getDiagram(user.id, id);
  if (diagram === null) notFound();
  return (
    <ProjectPrompter
      files={diagram.files}
      channel={prompterChannel(id)}
      cloudId={id}
      root={parseDeepLink(search).root ?? ""}
    />
  );
}
