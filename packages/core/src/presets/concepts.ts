/**
 * How concepts are grouped (D-85): by what they're about (a topic) and where they apply (a
 * platform). Fixed lists, so a library of hundreds stays navigable; tags add the rest for search.
 */
export const CONCEPT_TOPICS = [
  { id: "fundamentals", label: "Cloud fundamentals" },
  { id: "scaling", label: "Scaling & performance" },
  { id: "reliability", label: "Reliability" },
  { id: "networking", label: "Networking" },
  { id: "security", label: "Security & identity" },
  { id: "data", label: "Data & storage" },
  { id: "messaging", label: "Messaging & events" },
  { id: "containers", label: "Containers & Kubernetes" },
  { id: "delivery", label: "Delivery" },
  { id: "git", label: "Git" },
  { id: "architecture", label: "Architecture patterns" },
  { id: "observability", label: "Observability" },
  { id: "ai", label: "AI systems" },
] as const;

export type ConceptTopic = (typeof CONCEPT_TOPICS)[number]["id"];

export const CONCEPT_PLATFORMS = [
  { id: "any", label: "Any platform" },
  { id: "azure", label: "Azure" },
  { id: "aws", label: "AWS" },
  { id: "gcp", label: "Google Cloud" },
  { id: "kubernetes", label: "Kubernetes" },
] as const;

export type ConceptPlatform = (typeof CONCEPT_PLATFORMS)[number]["id"];

export const isConceptTopic = (value: string): value is ConceptTopic =>
  CONCEPT_TOPICS.some((topic) => topic.id === value);

export const isConceptPlatform = (value: string): value is ConceptPlatform =>
  CONCEPT_PLATFORMS.some((platform) => platform.id === value);

export const conceptTopicLabel = (topic: ConceptTopic): string =>
  CONCEPT_TOPICS.find((t) => t.id === topic)?.label ?? topic;

export const conceptPlatformLabel = (platform: ConceptPlatform): string =>
  CONCEPT_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
