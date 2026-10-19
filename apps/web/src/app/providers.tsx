"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { beforeFilesSaved } from "@/lib/api/client";
import { uploadMissingAssets } from "@/features/assets/remote";

// Saving a project to the account first uploads the pictures it points at (D-101).
beforeFilesSaved(uploadMissingAssets);

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so server renders never share it.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
