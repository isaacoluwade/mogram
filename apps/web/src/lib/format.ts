const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const yearFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Just now", "5m ago", "3h ago", "Yesterday", "4d ago", "Oct 3", "Oct 3, 2025" (Eden's meta style). */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 2 * DAY) return "Yesterday";
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  const date = new Date(time);
  return date.getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(date)
    : yearFormat.format(date);
}

/** "Edited just now", "Edited 5m ago", "Edited yesterday", "Edited Oct 3". */
export function editedLabel(iso: string, now: number = Date.now()): string {
  const when = relativeTime(iso, now);
  if (when.length === 0) return "";
  return /^(Just now|Yesterday)$/.test(when) ? `Edited ${when.toLowerCase()}` : `Edited ${when}`;
}
