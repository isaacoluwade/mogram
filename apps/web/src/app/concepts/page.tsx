import type { Metadata } from "next";
import { currentUser } from "@/server/auth/session";
import { ConceptsPage } from "@/features/dashboard/library-pages";

export const metadata: Metadata = { title: "Concepts", robots: { index: false, follow: false } };

/** Concepts to start from, in the app's shell. */
export default async function Page() {
  const user = await currentUser();
  return <ConceptsPage user={user === null ? null : { email: user.email, name: user.name }} />;
}
