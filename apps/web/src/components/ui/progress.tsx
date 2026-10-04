import { cn } from "@/lib/cn";

/** A thin determinate progress bar (0…1), announced as a progressbar. */
export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label: string;
  className?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-fill-strong", className)}
    >
      <div
        className="h-full rounded-full bg-fg transition-[width] duration-150"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
