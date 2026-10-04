"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

/** Errors inside a page. Drafts are saved continuously, so trying again rarely loses anything. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      code={error.digest !== undefined ? `Error ${error.digest}` : undefined}
      title="Something went wrong"
      description="Mogram hit a problem showing this page. Your saved work is safe. Try again, or go back to your diagrams."
      actions={
        <>
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/diagrams">Your diagrams</Link>
          </Button>
        </>
      }
    />
  );
}
