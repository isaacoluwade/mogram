import type { VersionItem } from "./source";

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayInYear = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const fullDay = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const moment = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Yesterday", "Thu, Oct 2", or with the year when it's another year. */
export function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.getFullYear() === now.getFullYear() ? dayInYear.format(date) : fullDay.format(date);
}

/** "5:35 PM", or "5:01 – 5:40 PM" for a version that spans a working session. */
export function timeLabel(version: Pick<VersionItem, "createdAt" | "updatedAt">): string {
  const start = new Date(version.createdAt);
  const end = new Date(version.updatedAt);
  const from = time.format(start);
  const to = time.format(end);
  return end.getTime() - start.getTime() < 60_000 || from === to ? to : `${from} – ${to}`;
}

/** "Oct 4, 5:35 PM": when a version was last saved. */
export function momentLabel(iso: string): string {
  return moment.format(new Date(iso));
}

/** What a version is called in the list: its name, the prompt of an assistant turn, or what changed. */
export function versionTitle(version: VersionItem): string {
  if (version.name !== null) return version.name;
  switch (version.source) {
    case "ai":
      return version.label ?? "Change by the assistant";
    case "restore":
      return version.restoredFromAt === null
        ? "Restored an earlier version"
        : `Restored the version from ${momentLabel(version.restoredFromAt)}`;
    case "create":
      return "Created";
    case "import":
      return "Saved to your account";
    case "named":
      return "Named version";
    default:
      return version.changes?.line ?? "Saved";
  }
}

/** The change line under the title, when the title isn't already it. */
export function versionDetail(version: VersionItem): string | null {
  const line = version.changes?.line ?? null;
  if (line === null || line === "No changes" || line === "Created") return null;
  return versionTitle(version) === line ? null : line;
}
