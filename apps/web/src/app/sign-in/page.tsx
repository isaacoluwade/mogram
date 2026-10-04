import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { isLocalDevelopment } from "@/server/env";
import { safeNext } from "@/lib/safe-next";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a Mogram account with a one-time code. No password.",
};

/** Email, then a one-time code (D-6). Signed-in visitors go straight on. */
export default async function SignInPage(props: PageProps<"/sign-in">) {
  const search = await props.searchParams;
  const next = safeNext(search.next);
  if ((await currentUser()) !== null) redirect(next);
  return <SignInForm next={next} showDevMailbox={isLocalDevelopment()} />;
}
