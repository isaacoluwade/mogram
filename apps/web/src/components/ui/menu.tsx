"use client";

import { ContextMenu as ContextPrimitive, DropdownMenu as MenuPrimitive } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Kbd } from "./kbd";

/**
 * Menus follow Eden's action menu: 12px radius surface, rows with icon + title (+ description),
 * active row filled. The same styles serve dropdown and right-click (context) menus.
 */
const surface =
  "z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-card p-1 text-fg shadow-popover animate-pop-in";
const row =
  "relative flex w-full cursor-default select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-label text-fg-soft outline-none transition-colors data-[highlighted]:bg-menu-active data-[highlighted]:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-secondary";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;
export const MenuGroup = MenuPrimitive.Group;
export const MenuSub = MenuPrimitive.Sub;
export const MenuRadioGroup = MenuPrimitive.RadioGroup;

export function MenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export interface MenuRowProps {
  icon?: ReactNode;
  description?: ReactNode;
  shortcut?: string;
  tone?: "default" | "danger";
}

function RowBody({
  icon,
  children,
  description,
  shortcut,
}: MenuRowProps & { children: ReactNode }) {
  return (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {description !== undefined ? (
          <span className="truncate text-micro text-fg-muted">{description}</span>
        ) : null}
      </span>
      {shortcut !== undefined ? <Kbd className="ml-auto">{shortcut}</Kbd> : null}
    </>
  );
}

export function MenuItem({
  className,
  icon,
  description,
  shortcut,
  tone = "default",
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & MenuRowProps) {
  return (
    <MenuPrimitive.Item
      className={cn(
        row,
        tone === "danger" && "text-rose data-[highlighted]:text-rose [&_svg]:text-rose",
        className,
      )}
      {...props}
    >
      <RowBody
        icon={icon}
        description={description}
        {...(shortcut !== undefined ? { shortcut } : {})}
      >
        {children}
      </RowBody>
    </MenuPrimitive.Item>
  );
}

export function MenuRadioItem({
  className,
  icon,
  description,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem> & MenuRowProps) {
  return (
    <MenuPrimitive.RadioItem className={cn(row, "pr-7", className)} {...props}>
      <RowBody icon={icon} description={description}>
        {children}
      </RowBody>
      <MenuPrimitive.ItemIndicator className="absolute right-2">
        <Check className="text-fg" />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubTrigger> & { icon?: ReactNode }) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(row, "data-[state=open]:bg-menu-active", className)}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="ml-auto" />
    </MenuPrimitive.SubTrigger>
  );
}

export function MenuSubContent({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2 pb-1 pt-1.5 text-micro font-medium text-fg-muted", className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border-muted", className)}
      {...props}
    />
  );
}

// Right-click menus share the same look.
export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: ComponentProps<typeof ContextPrimitive.Content>) {
  return (
    <ContextPrimitive.Portal>
      <ContextPrimitive.Content
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </ContextPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  icon,
  description,
  shortcut,
  tone = "default",
  children,
  ...props
}: ComponentProps<typeof ContextPrimitive.Item> & MenuRowProps) {
  return (
    <ContextPrimitive.Item
      className={cn(
        row,
        tone === "danger" && "text-rose data-[highlighted]:text-rose [&_svg]:text-rose",
        className,
      )}
      {...props}
    >
      <RowBody
        icon={icon}
        description={description}
        {...(shortcut !== undefined ? { shortcut } : {})}
      >
        {children}
      </RowBody>
    </ContextPrimitive.Item>
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof ContextPrimitive.Separator>) {
  return (
    <ContextPrimitive.Separator
      className={cn("-mx-1 my-1 h-px bg-border-muted", className)}
      {...props}
    />
  );
}

export function ContextMenuLabel({
  className,
  ...props
}: ComponentProps<typeof ContextPrimitive.Label>) {
  return (
    <ContextPrimitive.Label
      className={cn("px-2 pb-1 pt-1.5 text-micro font-medium text-fg-muted", className)}
      {...props}
    />
  );
}

export const ContextMenuSub = ContextPrimitive.Sub;

export function ContextMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof ContextPrimitive.SubTrigger> & { icon?: ReactNode }) {
  return (
    <ContextPrimitive.SubTrigger
      className={cn(row, "data-[state=open]:bg-menu-active", className)}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="ml-auto" />
    </ContextPrimitive.SubTrigger>
  );
}

export function ContextMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof ContextPrimitive.SubContent>) {
  return (
    <ContextPrimitive.Portal>
      <ContextPrimitive.SubContent
        collisionPadding={8}
        className={cn(surface, className)}
        {...props}
      />
    </ContextPrimitive.Portal>
  );
}
