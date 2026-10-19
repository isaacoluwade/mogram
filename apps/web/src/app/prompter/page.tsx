import type { Metadata } from "next";
import { currentUser } from "@/server/auth/session";
import { ScriptPage } from "@/features/dashboard/script-page";

export const metadata: Metadata = {
  title: "Script",
  description:
    "Read what you're going to say, and record it. Nothing you say leaves your computer.",
};

/** Script: everything with words to say, and any text pasted, to read and record. */
export default async function PrompterPage() {
  const user = await currentUser();
  return <ScriptPage user={user === null ? null : { email: user.email, name: user.name }} />;
}
