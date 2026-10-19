import type { Metadata } from "next";
import { parseDeepLink } from "@/features/share/deep-link";
import { Prompter } from "@/features/prompter/project-prompter";

export const metadata: Metadata = { title: "Script", robots: { index: false, follow: false } };

/** The Script window of a browser draft: its deck's or story's words, to read and record. */
export default async function DraftPrompterPage(props: PageProps<"/draft/[id]/prompter">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams]);
  return <Prompter id={id} root={parseDeepLink(search).root ?? ""} />;
}
