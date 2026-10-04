"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function Providers({ children }: { children: ReactNode }) {
  // Isolate server requests; retain the browser client through initial suspension.
  const client =
    typeof window === "undefined"
      ? createQueryClient()
      : (browserQueryClient ??= createQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
