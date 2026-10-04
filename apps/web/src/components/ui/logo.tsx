import { cn } from "@/lib/cn";

/**
 * Mogram mark: two nodes joined by a flowing path with a traffic dot — "motion + diagram".
 * Drawn as a white glyph in Eden's squircle logo tile.
 */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-4", className)}>
      <rect x="2.5" y="4" width="7" height="7" rx="2.2" fill="currentColor" />
      <rect x="14.5" y="13" width="7" height="7" rx="2.2" fill="currentColor" />
      <path
        d="M9.5 7.5h3.25a2.5 2.5 0 0 1 2.5 2.5v3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12.4" cy="7.5" r="1.55" fill="currentColor" />
    </svg>
  );
}

export function LogoMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "size-6 [&_svg]:size-3.5",
    md: "size-7 [&_svg]:size-4",
    lg: "size-10 [&_svg]:size-5",
    xl: "size-14 [&_svg]:size-7",
  } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-squircle bg-linear-to-b from-[#2c2c2c] to-[#1d1d1d] text-white shadow-logo",
        sizes[size],
        className,
      )}
    >
      <LogoGlyph />
    </span>
  );
}

/** "Mogram". The app uses the wordmark face; the marketing site sets it in Geist, like Eden's. */
export function Wordmark({
  variant = "app",
  className,
}: {
  variant?: "app" | "site";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-medium leading-none text-white",
        variant === "app"
          ? "font-wordmark text-[18px] tracking-wordmark"
          : "font-display text-[1.15rem] tracking-display",
        className,
      )}
    >
      Mogram
    </span>
  );
}
