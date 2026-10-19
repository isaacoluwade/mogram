import {
  Activity,
  Blocks,
  Cloud,
  Container,
  Database,
  Gauge,
  GitBranch,
  Inbox,
  Lightbulb,
  LifeBuoy,
  Network,
  Rocket,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ConceptTopic } from "@mogram/core/presets";

const TOPIC_ICONS: Readonly<Record<ConceptTopic, LucideIcon>> = {
  fundamentals: Cloud,
  scaling: Gauge,
  reliability: LifeBuoy,
  networking: Network,
  security: ShieldCheck,
  data: Database,
  messaging: Inbox,
  containers: Container,
  delivery: Rocket,
  git: GitBranch,
  architecture: Blocks,
  observability: Activity,
  ai: Sparkles,
};

/** A concept topic's icon; a lightbulb for a concept without one. */
export function TopicIcon({
  topic,
  className,
}: {
  topic: ConceptTopic | null;
  className?: string;
}) {
  const Icon = topic === null ? Lightbulb : TOPIC_ICONS[topic];
  return <Icon aria-hidden className={className} />;
}
