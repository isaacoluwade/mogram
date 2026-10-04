import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/server/auth/session";
import { DocPage, DocSection, FactList, Strong } from "@/features/marketing/doc-page";

export const metadata: Metadata = {
  title: "Security and storage",
  description: "Where Mogram keeps your diagrams, who can see them, and how they're protected.",
};

/** Where diagrams are stored and who can see them (AC-6), and how Mogram protects them (AC-7). */
export default async function SecurityPage() {
  const user = await currentUser();
  return (
    <DocPage
      signedIn={user !== null}
      eyebrow="Security and storage"
      title={
        <>
          Your diagrams are yours.{" "}
          <span className="headline-emphasis">Private until you share them.</span>
        </>
      }
      lead="This page explains, in plain words, where Mogram keeps what you make, who can open it, and what we do to keep it safe."
      summary={
        <>
          Without an account,{" "}
          <span className="headline-emphasis">diagrams never leave your browser.</span> With one,
          they&apos;re stored in Mogram&apos;s database,{" "}
          <span className="headline-emphasis">visible only to you</span> until you turn on a share
          link, which you can turn off or replace at any time.
        </>
      }
    >
      <DocSection id="drafts" label="Without an account">
        <p>
          Everything you make is a <Strong>draft in this browser</Strong>, stored on your device (in
          the browser&apos;s IndexedDB). Mogram&apos;s servers never receive it. Nobody else can see
          it, and it isn&apos;t on your other devices.
        </p>
        <p>
          Clearing your browser&apos;s site data deletes drafts, so download the files when you want
          a copy: one <code className="font-mono text-body text-fg-soft">.mogram.yaml</code>, or a
          zip of the folder for diagrams with several files.
        </p>
      </DocSection>

      <DocSection id="account" label="With an account">
        <p>
          Diagrams you save to your account are stored in Mogram&apos;s database with their version
          history. Every request checks that the diagram is yours; a diagram that isn&apos;t yours
          looks exactly like one that doesn&apos;t exist.
        </p>
        <FactList
          facts={[
            ["Who can open it", "Only you, until you turn on link sharing."],
            [
              "Share links",
              "An unguessable 128-bit random id, not derived from anything about you or the diagram.",
            ],
            [
              "What viewers see",
              "The latest saved version, read-only. They can pan, zoom, open cards, play scenes and take tours.",
            ],
            [
              "“What if” changes",
              "Off unless you allow them. When allowed, viewers' changes stay in their browser and are never saved.",
            ],
            [
              "Turning it off",
              "Set the diagram back to private and the link stops working immediately. Resetting the link makes a new one.",
            ],
            [
              "Version history",
              "Saves within five minutes of each other are kept as one version. You can restore any version.",
            ],
            ["Deleting", "Deleting a diagram removes it, its versions and its share link."],
          ]}
        />
      </DocSection>

      <DocSection id="sign-in" label="Signing in">
        <p>
          There are no passwords. You enter your email and we send a <Strong>six-digit code</Strong>
          . Codes expire after ten minutes, allow five attempts, are stored only as a hash, and
          sending them is rate limited. Your session lives in an <Strong>httpOnly cookie</Strong>{" "}
          that page scripts can&apos;t read.
        </p>
      </DocSection>

      <DocSection id="protection" label="How it's protected">
        <FactList
          facts={[
            [
              "Uploaded icons",
              "SVGs are cleaned when you upload them and again on the server, and are only ever drawn as images, where scripts can't run.",
            ],
            [
              "Card text",
              "Markdown is shown without any raw HTML; only web, email and in-diagram links are allowed.",
            ],
            [
              "Opening files",
              "YAML is read with strict limits on size and aliases, so a crafted file can't exhaust memory.",
            ],
            [
              "Every request",
              "Inputs are validated against size and shape limits before anything is stored.",
            ],
            [
              "The page itself",
              "A Content Security Policy with a fresh nonce per request, no framing by other sites, and strict referrer rules.",
            ],
            [
              "Exports",
              "PNG, JPEG, SVG, GIF and WebP files are made in your browser. Nothing is uploaded to export.",
            ],
          ]}
        />
      </DocSection>

      <DocSection id="your-files" label="Your files">
        <p>
          Mogram&apos;s format is plain YAML that you can keep in a git repository, review in pull
          requests and edit by hand. You can download any diagram at any time; nothing locks you in.
          The format is documented in full on the{" "}
          <Link
            href="/docs/format"
            className="text-fg underline decoration-border-emphasis underline-offset-4 hover:decoration-fg"
          >
            file format page
          </Link>
          .
        </p>
      </DocSection>
    </DocPage>
  );
}
