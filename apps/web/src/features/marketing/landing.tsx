import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Box,
  Check,
  Hand,
  MousePointer2,
  Spline,
  SquareDashed,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { DiagramPreview } from "@/features/canvas/diagram-preview";
import { TEMPLATES } from "@/features/templates";
import { AKS_FILES, FAILOVER_FILES, WEB_APP_FILES } from "@/features/templates/files";
import { Eyebrow, ProductFrame } from "./frames";
import { LiveDemo } from "./live-demo";
import { Reveal } from "./reveal";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { TemplatePreviewCard } from "./template-preview-card";
import { Typewriter } from "./typewriter";

const CHECKLIST: readonly [string, string][] = [
  ["Drag in official cloud icons", ", then connect them"],
  ["Watch traffic flow", " and parts go dark"],
  ["Flip between scenes", " like slides"],
  ["Click anything", " for its story, or take a tour"],
  ["Zoom inside a component", " to see its diagram"],
  ["Keep it in your repo", " as clean YAML"],
];

/** The marketing home page, built the way Eden builds theirs (D-9). */
export function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="min-h-dvh bg-page">
      <SiteHeader signedIn={signedIn} />
      <main>
        <Hero />
        <section id="features" className="scroll-mt-20">
          <Feature
            index="01"
            eyebrow="Draw it"
            title={
              <>
                Draw it like a design. <Emphasis>Not like a drawing tool.</Emphasis>
              </>
            }
            body="Search the official Azure, AWS, Google Cloud and Kubernetes icons, plus generic shapes and tool logos. Drop them into regions, networks and subnets. Connections find their own way around everything, on an 8px grid."
            link={{ href: "/draft/new?template=blank", label: "Open a blank canvas" }}
            visual={<EditorMock />}
          />
          <Feature
            index="02"
            eyebrow="Make it move"
            title={
              <>
                Make it move. <Emphasis>Then make it break.</Emphasis>
              </>
            }
            body="Traffic flows along every connection. Mark a region down and everything behind it stops, while the backup path takes over on its own. Save each moment as a scene and play them like slides."
            link={{ href: "/draft/new?template=failover", label: "Try the failover diagram" }}
            visual={
              <VisualFrame>
                <LiveDemo
                  files={FAILOVER_FILES}
                  className="aspect-[4/3]"
                  label="Failover scenes"
                  padding={36}
                  minZoom={0.5}
                />
              </VisualFrame>
            }
            reverse
          />
          <Feature
            index="03"
            eyebrow="Explain it"
            title={
              <>
                Explain it once. <Emphasis>Everyone gets it.</Emphasis>
              </>
            }
            body="Give any part a card with notes, links and code. Build a tour by clicking parts in order; the camera rides the traffic from step to step, and branches let people ask “what if?”."
            link={{ href: "/draft/new?template=web-app", label: "Take the tour" }}
            visual={<CardMock />}
          />
          <Feature
            index="04"
            eyebrow="Keep it"
            title={
              <>
                Lives in your repo. <Emphasis>Reads like English.</Emphasis>
              </>
            }
            body="Every diagram is plain YAML you can review in a pull request. Move something on the canvas and the diff is one line. Comments and order are kept exactly as you wrote them."
            link={{ href: "/docs/format", label: "Read the file format" }}
            visual={<CodeMock />}
            reverse
          />
        </section>
        <Templates />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Emphasis({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("headline-emphasis", className)}>{children}</span>;
}

function Hero() {
  return (
    <section className="light-hero">
      <div className="mx-auto max-w-hero px-6 pb-20 pt-20 md:px-8 md:pt-28">
        <div className="animate-reveal">
          <Eyebrow>Draw. Animate. Explain. Share.</Eyebrow>
          <h1 className="mt-5 font-display text-display-lg font-medium tracking-display text-fg-secondary">
            Architecture diagrams{" "}
            <Typewriter
              phrases={["that move.", "that explain themselves.", "that live in your repo."]}
            />
          </h1>
          <ul className="mt-5 flex max-w-[620px] flex-col gap-2 text-checklist max-[480px]:gap-1.5 max-[480px]:text-checklist-sm max-[400px]:text-checklist-xs lg:grid lg:max-w-[1040px] lg:auto-cols-fr lg:grid-flow-col lg:grid-rows-3 lg:gap-x-8">
            {CHECKLIST.map(([lead, rest]) => (
              <li key={lead} className="flex items-start gap-2.5">
                <Check
                  aria-hidden
                  className="mt-[0.22em] size-[0.95em] shrink-0 text-fg"
                  strokeWidth={2.5}
                />
                <span className="text-fg-secondary">
                  <span className="text-fg">{lead}</span>
                  {rest}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button variant="primary" size="xl" asChild>
              <Link href="/diagrams">
                Start free
                <ArrowRight />
              </Link>
            </Button>
            <p className="text-body-sm text-fg-muted">
              No account needed. <span className="text-fg-soft">Drafts stay in your browser</span>{" "}
              until you choose to save them.
            </p>
          </div>
        </div>
        <Reveal className="mt-16 md:mt-20" delay={150}>
          <ProductFrame glow>
            <LiveDemo
              files={WEB_APP_FILES}
              className="aspect-[4/5] sm:aspect-[16/9]"
              label="Checkout scenes"
              padding={48}
              minZoom={0.55}
            />
          </ProductFrame>
        </Reveal>
      </div>
    </section>
  );
}

function Feature({
  index,
  eyebrow,
  title,
  body,
  link,
  visual,
  reverse = false,
}: {
  index: string;
  eyebrow: string;
  title: ReactNode;
  body: string;
  link: { href: string; label: string };
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="light-section border-t border-hairline">
      <Reveal
        className={cn(
          "mx-auto grid max-w-content items-center gap-12 px-6 py-20 md:px-8 lg:gap-16 lg:py-28",
          // The visual always gets the wider column, whichever side it is on.
          reverse
            ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
            : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
        )}
      >
        <div className={cn("max-w-[560px]", reverse && "lg:order-2")}>
          <Eyebrow>
            {index} · {eyebrow}
          </Eyebrow>
          <h2 className="mt-5 font-display text-display font-medium tracking-display text-fg-secondary">
            {title}
          </h2>
          <p className="mt-5 text-balance text-feature text-fg-secondary">{body}</p>
          <Button variant="primary" size="xl" asChild className="mt-8">
            <Link href={link.href as Route}>
              {link.label}
              <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className={cn("min-w-0", reverse && "lg:order-1")}>{visual}</div>
      </Reveal>
    </div>
  );
}

/** Feature visuals use the product-shot frame, without the hero's glow. */
function VisualFrame({ children }: { children: ReactNode }) {
  return <ProductFrame>{children}</ProductFrame>;
}

const LIBRARY_PREVIEW = [
  "azure/kubernetes-services",
  "aws/lambda",
  "gcp/bigquery",
  "azure/sql-database",
  "aws/s3",
  "gcp/cloud-run",
  "k8s/pod",
  "azure/key-vaults",
  "aws/dynamodb",
];

/** A still of the editor's floating chrome around a live diagram. */
function EditorMock() {
  return (
    <VisualFrame>
      <div className="relative aspect-[4/3]">
        <DiagramPreview
          files={AKS_FILES}
          className="absolute inset-y-0 left-0 right-0 sm:left-40"
          padding={28}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <Panel
            shape="pill"
            className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-0.5 p-1 [&_svg]:size-4"
          >
            {[MousePointer2, Hand, Spline, Box, SquareDashed, Type].map((Icon, i) => (
              <span
                key={i}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-fg-soft",
                  i === 0 && "bg-fill-active text-fg",
                )}
              >
                <Icon />
              </span>
            ))}
          </Panel>
          <Panel className="absolute bottom-3 left-3 top-3 hidden w-36 flex-col gap-2 p-2.5 sm:flex">
            <span className="text-caption font-medium text-fg-strong">Library</span>
            <span className="rounded-full bg-fill-field px-2.5 py-1 text-micro text-fg-ghost">
              Search icons
            </span>
            <div className="grid grid-cols-3 gap-1">
              {LIBRARY_PREVIEW.map((id) => (
                <span
                  key={id}
                  className="flex aspect-square items-center justify-center rounded-sm bg-fill-faint"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG icons */}
                  <img src={`/icons/${id}.svg`} alt="" className="size-5" />
                </span>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </VisualFrame>
  );
}

/** A still of a card beside the camera, mid-tour. */
function CardMock() {
  return (
    <VisualFrame>
      <div className="relative aspect-[4/3]">
        <DiagramPreview
          files={WEB_APP_FILES}
          className="absolute inset-y-0 left-0 right-[min(276px,58%)] opacity-80"
          padding={20}
        />
        <Panel
          aria-hidden
          className="absolute bottom-4 right-4 top-4 flex w-[min(260px,55%)] flex-col overflow-hidden"
        >
          <div className="px-3.5 pb-2 pt-3.5">
            <p className="text-micro text-fg-muted">SQL database</p>
            <p className="font-display text-body-lg font-medium tracking-snug text-fg">
              Orders database
            </p>
          </div>
          <p className="px-3.5 text-caption leading-relaxed text-fg-secondary">
            The primary <span className="font-semibold text-fg">Azure SQL</span> database. Writes go
            here; reads fail over to the{" "}
            <span className="text-fg underline decoration-border-emphasis underline-offset-2">
              replica
            </span>{" "}
            during an outage.
          </p>
          <div className="mt-auto flex flex-col gap-2 border-t border-border-muted bg-fill-faint px-3.5 py-3">
            <div className="flex items-center justify-between text-micro text-fg-muted">
              <span>How a request flows</span>
              <span className="tabular-nums">3 / 5</span>
            </div>
            <div className="h-0.5 rounded-full bg-fill-strong">
              <div className="h-full w-3/5 rounded-full bg-fg" />
            </div>
            <span className="rounded-md border border-border bg-raised px-2.5 py-1.5 text-micro text-fg-soft">
              ↳ Normal write
            </span>
            <span className="rounded-md border border-border bg-raised px-2.5 py-1.5 text-micro text-fg-soft">
              ↳ Region outage
            </span>
          </div>
        </Panel>
      </div>
    </VisualFrame>
  );
}

const YAML_LINES: readonly { text: string; change?: "removed" | "added" }[] = [
  { text: "components:" },
  { text: "  web_vm:" },
  { text: "    type: azure/virtual-machine" },
  { text: "    in: web_subnet" },
  { text: "    card: docs/web-vm.md" },
  { text: "" },
  { text: "scenes:" },
  { text: "  region_outage:" },
  { text: "    db_primary: down" },
  { text: "    web_to_primary: blocked" },
  { text: "" },
  { text: "layout:" },
  { text: "  web_vm: [4, 6]", change: "removed" },
  { text: "  web_vm: [4, 10]", change: "added" },
];

/** The diff a canvas move produces: one line. */
function CodeMock() {
  return (
    <VisualFrame>
      <div className="bg-page">
        <div className="flex items-center gap-2 border-b border-border-muted px-4 py-3">
          <span className="font-mono text-caption text-fg-soft">checkout.mogram.yaml</span>
          <Badge tone="green" size="sm" className="ml-auto">
            1 line changed
          </Badge>
        </div>
        <pre
          className="overflow-x-auto py-3 font-mono text-caption leading-6"
          aria-label="Example Mogram YAML with a one-line change"
        >
          {YAML_LINES.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex px-4",
                line.change === "removed" && "bg-rose-fill text-rose",
                line.change === "added" && "bg-green-fill text-green",
                line.change === undefined && "text-fg-secondary",
              )}
            >
              <span aria-hidden className="w-6 shrink-0 select-none text-fg-ghost">
                {line.change === "removed" ? "−" : line.change === "added" ? "+" : ""}
              </span>
              <span
                className={cn(
                  line.change === undefined && /^\s*[a-z_]+:/.test(line.text) && "text-fg-soft",
                )}
              >
                {line.text || " "}
              </span>
            </div>
          ))}
        </pre>
      </div>
    </VisualFrame>
  );
}

function Templates() {
  return (
    <section id="templates" className="light-section scroll-mt-20 border-t border-hairline">
      <Reveal className="mx-auto max-w-content px-6 py-20 md:px-8 md:py-28">
        <h2 className="font-display text-display-sm font-medium tracking-display text-fg-secondary">
          Start with <Emphasis>a real architecture.</Emphasis>
        </h2>
        <p className="mt-4 max-w-2xl text-balance text-feature text-fg-secondary">
          Open one, play its scenes, take its tour, then make it yours. No account needed.
        </p>
        <div className="mt-12 grid gap-x-6 gap-y-12 md:grid-cols-3">
          {TEMPLATES.filter((t) => t.id !== "blank").map((template) => (
            <TemplatePreviewCard key={template.id} template={template} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="light-cta border-t border-hairline">
      <Reveal className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center md:px-8 md:py-32">
        <LogoMark size="lg" />
        <h2 className="mt-8 text-balance font-display text-display-cta font-medium tracking-display text-fg-secondary">
          Your architecture, <Emphasis className="whitespace-nowrap">in motion.</Emphasis>
        </h2>
        <p className="mt-5 text-feature text-fg-secondary">
          Free to start. Sign in only when you want to share.
        </p>
        <Button variant="primary" size="xl" asChild className="mt-10">
          <Link href="/diagrams">
            Start free
            <ArrowRight />
          </Link>
        </Button>
      </Reveal>
    </section>
  );
}
