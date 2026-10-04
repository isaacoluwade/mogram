import type { Metadata } from "next";
import { currentUser } from "@/server/auth/session";
import { listDiagrams } from "@/server/diagrams/service";
import { Dashboard } from "@/features/dashboard/dashboard";

export const metadata: Metadata = { title: "Diagrams", robots: { index: false, follow: false } };

/** The dashboard. Cloud diagrams are read on the server so the first paint already shows them. */
export default async function DiagramsPage() {
  const user = await currentUser();
  const cloud = user === null ? [] : await listDiagrams(user.id);
  return (
    <Dashboard
      user={user === null ? null : { email: user.email, name: user.name }}
      initialCloud={cloud}
    />
  );
}
