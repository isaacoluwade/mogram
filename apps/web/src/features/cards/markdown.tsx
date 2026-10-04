"use client";

import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ProjectFiles } from "@mogram/core/model";
import { resolveFromFolder } from "@mogram/core/model";
import { cn } from "@/lib/cn";

/**
 * Card markdown (CA-2): formatting, links, code and images. Raw HTML is never rendered (AC-7).
 * `[text](#element)` links to another element's card (CA-4); images can be https URLs or files
 * in the diagram folder (stored as data URLs).
 */
export function Markdown({
  source,
  files,
  folder,
  onElementLink,
  className,
  variant = "card",
}: {
  source: string;
  files: ProjectFiles;
  folder: string;
  onElementLink?: (name: string) => void;
  className?: string;
  /** "document" sets long-form pages (the file format docs) at reading size. */
  variant?: "card" | "document";
}) {
  const doc = variant === "document";
  const components: Components = {
    a: ({ href, children }) => {
      if (href?.startsWith("#") === true && onElementLink !== undefined) {
        const target = href.slice(1);
        return (
          <button
            type="button"
            onClick={() => onElementLink(target)}
            className="font-medium text-fg underline decoration-border-emphasis underline-offset-2 hover:decoration-fg"
          >
            {children}
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-medium text-fg underline decoration-border-emphasis underline-offset-2 hover:decoration-fg"
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt }) => {
      const resolved = resolveImage(typeof src === "string" ? src : "", files, folder);
      if (resolved === null)
        return <span className="text-caption text-fg-muted">[image: {alt}]</span>;
      return (
        // eslint-disable-next-line @next/next/no-img-element -- user content from the diagram; sizes unknown
        <img
          src={resolved}
          alt={alt ?? ""}
          className="my-3 max-w-full rounded-md border border-border"
          loading="lazy"
        />
      );
    },
    code: ({ className: codeClass, children }) => {
      const block = typeof codeClass === "string" && codeClass.startsWith("language-");
      return block ? (
        <code className="font-mono text-caption">{children}</code>
      ) : (
        <code className="rounded-[5px] bg-fill-field px-1 py-0.5 font-mono text-[0.9em] text-fg">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre
        className={cn(
          "overflow-x-auto rounded-md border border-border bg-page leading-relaxed text-fg-soft",
          doc ? "my-5 rounded-lg p-4" : "my-3 p-3",
        )}
      >
        {children}
      </pre>
    ),
    h1: ({ children }) =>
      doc ? (
        <h2 className="mb-4 mt-14 font-display text-title font-medium tracking-title text-fg first:mt-0">
          {children}
        </h2>
      ) : (
        <h3 className="mb-2 mt-4 font-display text-heading tracking-snug text-fg first:mt-0">
          {children}
        </h3>
      ),
    h2: ({ children }) =>
      doc ? (
        <h2 className="mb-4 mt-14 scroll-mt-24 border-t border-hairline pt-10 font-display text-title font-medium tracking-title text-fg first:mt-0 first:border-t-0 first:pt-0">
          {children}
        </h2>
      ) : (
        <h4 className="mb-2 mt-4 font-display text-body-lg tracking-snug text-fg first:mt-0">
          {children}
        </h4>
      ),
    h3: ({ children }) => (
      <h5 className="mb-1.5 mt-3 font-display text-body font-medium text-fg first:mt-0">
        {children}
      </h5>
    ),
    p: ({ children }) => (
      <p className={cn(doc ? "my-4" : "my-2", "first:mt-0 last:mb-0")}>{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-disc space-y-1 pl-5 marker:text-fg-ghost">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-fg-ghost">{children}</ol>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l border-border-emphasis pl-3 text-fg-secondary">
        {children}
      </blockquote>
    ),
    // Documents read their tables at body size, like Eden's; cards keep them compact.
    table: ({ children }) => (
      <div
        className={cn(
          "overflow-x-auto border border-border",
          doc ? "my-6 rounded-xl" : "my-3 rounded-md",
        )}
      >
        <table className={cn("w-full text-left", doc ? "text-body" : "text-caption")}>
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th
        className={cn(
          "border-b border-border bg-fill-faint font-medium text-fg-soft",
          doc ? "px-4 py-3" : "px-2.5 py-1.5",
        )}
      >
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td
        className={cn(
          "border-b border-border-subtle text-fg-secondary",
          doc ? "px-4 py-3" : "px-2.5 py-1.5",
        )}
      >
        {children}
      </td>
    ),
    hr: () => <hr className="my-4 border-border-muted" />,
    strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  };
  return (
    <div
      className={cn(
        doc
          ? "text-body-lg leading-relaxed text-fg-secondary"
          : "text-body-sm leading-relaxed text-fg-secondary",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        skipHtml
        urlTransform={safeUrl}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

/** Only http(s), mailto, in-page anchors and relative project paths survive. */
function safeUrl(url: string): string {
  if (url.startsWith("#")) return url;
  const transformed = defaultUrlTransform(url);
  if (/^(https?:|mailto:)/i.test(transformed) || /^[\w./-]+$/.test(transformed)) return transformed;
  return "";
}

function resolveImage(src: string, files: ProjectFiles, folder: string): string | null {
  if (/^https:\/\//i.test(src)) return src;
  const path = resolveFromFolder(folder, src);
  if (path === null) return null;
  const content = files[path];
  if (content === undefined) return null;
  if (content.startsWith("data:image/")) return content;
  if (path.toLowerCase().endsWith(".svg"))
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
  return null;
}

/** Title and body for a card, reading markdown files from the project (CA-3). */
export function cardContent(
  card:
    | { kind: "inline"; title: string | null; body: string }
    | { kind: "file"; title: string | null; path: string },
  files: ProjectFiles,
  fallbackTitle: string,
): { title: string; body: string; missing: boolean } {
  if (card.kind === "inline")
    return { title: card.title ?? fallbackTitle, body: card.body, missing: false };
  const text = files[card.path];
  if (text === undefined)
    return {
      title: card.title ?? fallbackTitle,
      body: `This card points to \`${card.path}\`, which isn't in the diagram yet.`,
      missing: true,
    };
  const heading = /^#\s+(.+)\s*$/m.exec(text);
  if (card.title === null && heading?.[1] !== undefined && text.trimStart().startsWith("#")) {
    return {
      title: heading[1].trim(),
      body: text.replace(/^\s*#\s+.+\n?/, "").trimStart(),
      missing: false,
    };
  }
  return { title: card.title ?? fallbackTitle, body: text, missing: false };
}
