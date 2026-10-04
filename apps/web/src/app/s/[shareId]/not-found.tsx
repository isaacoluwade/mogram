import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

/** A share link that doesn't open anything: never says whether a private diagram exists (AC-5). */
export default function SharedNotFound() {
  return (
    <StatusPage
      code="404"
      title="This link doesn't open a diagram"
      description="Its owner may have made the diagram private, reset the link, or deleted it. Ask them for a new link."
      actions={
        <Button variant="primary" asChild>
          <Link href="/">What is Mogram?</Link>
        </Button>
      }
    />
  );
}
