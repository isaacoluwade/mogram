"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import type { Template } from "@/features/templates";
import { CardFrame } from "./frames";

/** Eden's three-up card: a visual card, then a muted label, a title, a line and a link. Animates on hover. */
export function TemplatePreviewCard({ template }: { template: Template }) {
  const [hover, setHover] = useState(false);
  const href = `/draft/new?template=${template.id}` as Route;
  return (
    <article
      className="group flex flex-col"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <Link
        href={href}
        aria-label={`Open the ${template.name} template`}
        className="rounded-2xl outline-none focus-visible:ring-1 focus-visible:ring-border-emphasis"
      >
        <CardFrame className="aspect-[4/3] transition-colors group-hover:border-border-strong">
          <DiagramPreview
            files={template.files}
            className="absolute inset-0"
            padding={20}
            animate={hover}
          />
        </CardFrame>
      </Link>
      <div className="pt-6">
        <p className="text-eyebrow font-medium text-fg-secondary">
          {template.features.join(" · ")}
        </p>
        <h3 className="mt-3 font-display text-heading font-medium tracking-snug text-fg">
          {template.name}
        </h3>
        <p className="mt-2 text-body-lg text-fg-secondary">{template.description}</p>
        <Link
          href={href}
          className="mt-4 inline-flex min-h-8 items-center gap-1.5 text-body text-fg-soft transition-colors hover:text-fg"
        >
          Open template
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </article>
  );
}
