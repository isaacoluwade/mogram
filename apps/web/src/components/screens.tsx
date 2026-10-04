import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LogoMark } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/skeleton";

/** Shown while a diagram loads: the canvas colour with a quiet spinner, no layout shift. */
export function EditorLoading({ label = "Opening diagram" }: { label?: string }) {
  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center gap-4 bg-page">
      <LogoMark />
      <div className="flex items-center gap-2 text-label text-fg-muted">
        <Spinner label={label} />
        {label}…
      </div>
    </div>
  );
}

export function EditorUnavailable({ title, description }: { title: string; description: string }) {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-page p-6">
      <EmptyState
        icon={<FileQuestion />}
        title={title}
        description={description}
        action={
          <Button variant="primary" asChild>
            <Link href="/diagrams">Go to your diagrams</Link>
          </Button>
        }
      />
    </main>
  );
}
