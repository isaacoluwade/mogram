import { currentUser } from "@/server/auth/session";
import { Landing } from "@/features/marketing/landing";

/** The home page. Signed-in visitors see "Your diagrams" instead of "Sign in". */
export default async function Home() {
  const user = await currentUser();
  return <Landing signedIn={user !== null} />;
}
