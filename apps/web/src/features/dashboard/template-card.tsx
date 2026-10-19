"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import type { Template } from "@/features/templates";

/**
 * A template: a live preview that moves while pointed at, its name, what it shows, and "Use".
 * The preview is drawn once the card is near the screen, over a placeholder, so a page of
 * templates never shows empty boxes.
 */
export function TemplateCard({
  template,
  onUse,
  disabled,
}: {
  template: Template;
  onUse: () => void;
  disabled: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [seen, setSeen] = useState(false);
  const host = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = host.current;
    if (node === null || seen) return;
    // Where a browser can't say what's on screen, everything is drawn straight away.
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setSeen(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [seen]);
  return (
    <article
      ref={host}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-border-muted bg-fill-faint transition-colors hover:border-border-strong"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onUse}
        disabled={disabled}
        className="relative aspect-[16/10] overflow-hidden text-left"
        aria-label={`Use the ${template.name} template`}
      >
        <Skeleton className="absolute inset-0 rounded-none" />
        {seen ? (
          <DiagramPreview
            files={template.files}
            className="absolute inset-0"
            padding={20}
            animate={hover}
          />
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-3">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-sans text-body font-medium text-fg">
            {template.name}
          </h3>
          <Button
            variant="secondary"
            size="sm"
            className="hit-area -mt-0.5 h-7"
            onClick={onUse}
            disabled={disabled}
          >
            Use
          </Button>
        </div>
        <p className="line-clamp-2 text-caption text-fg-muted">{template.description}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {template.features.map((feature) => (
            <Badge key={feature} size="sm">
              {feature}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}
