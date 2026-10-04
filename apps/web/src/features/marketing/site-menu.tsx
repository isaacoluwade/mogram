"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Menu as MenuIcon } from "lucide-react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { SITE_LINKS } from "./links";

/** The header links on small screens. */
export function SiteMenu({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu"
          className="flex size-9 items-center justify-center rounded-full text-fg-soft transition-colors hover:bg-fill-hover hover:text-fg lg:hidden"
        >
          <MenuIcon className="size-5" />
        </button>
      </MenuTrigger>
      <MenuContent align="end" className="w-56">
        {SITE_LINKS.map((link) => (
          <MenuItem key={link.href} onSelect={() => router.push(link.href as Route)}>
            {link.label}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onSelect={() => router.push((signedIn ? "/diagrams" : "/sign-in") as Route)}>
          {signedIn ? "Your diagrams" : "Sign in"}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
