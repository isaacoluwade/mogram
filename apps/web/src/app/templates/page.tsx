import type { Metadata } from "next";
import { currentUser } from "@/server/auth/session";
import { TemplatesPage } from "@/features/dashboard/library-pages";

export const metadata: Metadata = { title: "Templates", robots: { index: false, follow: false } };

/** Templates to start from, in the app's shell. */
export default async function Page() {
  const user = await currentUser();
  return <TemplatesPage user={user === null ? null : { email: user.email, name: user.name }} />;
}
