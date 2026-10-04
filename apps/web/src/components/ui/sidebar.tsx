import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Eden's floating app sidebar: #171717, white/10 border, 12px radius, soft shadow. */
export function Sidebar({ className, ...props }: ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "flex flex-col rounded-lg border border-white/10 bg-sidebar shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

/** A 30px sidebar row: muted until hovered, filled when it's the current page. */
export function SidebarItem({
  icon,
  active = false,
  aside,
  asChild = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & {
  icon?: ReactNode;
  active?: boolean;
  aside?: ReactNode;
  asChild?: boolean;
}) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      {...(asChild ? {} : { type: "button" as const })}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-[30px] w-full items-center gap-2 rounded-lg px-2 text-left text-body transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        active ? "bg-fill-hover text-fg" : "text-fg-soft hover:bg-fill-hover hover:text-fg",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon !== undefined ? (
            <span className={cn("flex", active ? "text-fg" : "text-fg-soft group-hover:text-fg")}>
              {icon}
            </span>
          ) : null}
          <span className="min-w-0 flex-1 truncate">{children}</span>
          {aside !== undefined ? (
            <span className="shrink-0 text-micro tabular-nums text-fg-ghost">{aside}</span>
          ) : null}
        </>
      )}
    </Component>
  );
}

export function SidebarLabel({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("px-2 pb-1 pt-4 text-label text-fg-faint", className)} {...props} />;
}

/** Eden's app page header: icon + 26px title, muted subtitle, actions on the right. */
export function PageHeader({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start gap-4", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="flex items-center gap-3 font-display text-title font-medium tracking-title text-fg-strong">
          {icon !== undefined ? (
            <span className="flex text-brand-bright [&_svg]:size-6">{icon}</span>
          ) : null}
          {title}
        </h1>
        {description !== undefined ? (
          <p className="mt-2 text-body-sm text-fg-dim">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
