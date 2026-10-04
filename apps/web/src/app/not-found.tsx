import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This page isn't here"
      description="The link may be mistyped, or what it pointed to has moved or been deleted."
      actions={
        <>
          <Button variant="primary" asChild>
            <Link href="/diagrams">Your diagrams</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Home</Link>
          </Button>
        </>
      }
    />
  );
}
