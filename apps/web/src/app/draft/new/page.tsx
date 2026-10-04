import type { Metadata } from "next";
import { NewDraft } from "@/features/dashboard/new-draft";

export const metadata: Metadata = { title: "New diagram", robots: { index: false, follow: false } };

/** `/draft/new?template=aks` makes a browser draft from a template and opens it. */
export default async function NewDraftPage(props: PageProps<"/draft/new">) {
  const search = await props.searchParams;
  const template = typeof search.template === "string" ? search.template : null;
  return <NewDraft template={template} />;
}
