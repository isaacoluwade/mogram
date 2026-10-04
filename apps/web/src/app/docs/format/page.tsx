import type { Metadata } from "next";
import { currentUser } from "@/server/auth/session";
import { Markdown } from "@/features/cards/markdown";
import { DocPage } from "@/features/marketing/doc-page";
import { FILE_FORMAT_MARKDOWN } from "@/generated/file-format";

export const metadata: Metadata = {
  title: "The Mogram file format",
  description:
    "Mogram diagrams are plain YAML that read like a description of the architecture. Here is the whole format.",
};

/** The specification, rendered from docs/file-format.md (generated at build time, never duplicated). */
const [, ...rest] = FILE_FORMAT_MARKDOWN.split(/\n(?=## )/);
const intro = (FILE_FORMAT_MARKDOWN.split(/\n(?=## )/)[0] ?? "").replace(/^#.*\n+/, "").trim();
const body = rest.join("\n");

export default async function FileFormatPage() {
  const user = await currentUser();
  return (
    <DocPage
      signedIn={user !== null}
      eyebrow="Documentation"
      title={
        <>
          The file format. <span className="headline-emphasis">Plain YAML, version 1.</span>
        </>
      }
      lead={intro.split(/`([^`]+)`/).map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="rounded-[5px] bg-fill-field px-1 py-0.5 font-mono text-[0.85em] text-fg-soft"
          >
            {part}
          </code>
        ) : (
          part
        ),
      )}
    >
      <div className="max-w-3xl py-14">
        <Markdown source={body} files={{}} folder="" variant="document" />
      </div>
    </DocPage>
  );
}
