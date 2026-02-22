"use client";

import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import { fetchGenerations, isCacheReady } from "@/lib/generationsCache";

function Prefetcher() {
  const { status } = useSession();
  useEffect(() => {
    if (status === "authenticated" && !isCacheReady()) {
      fetchGenerations();
    }
  }, [status]);
  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <Prefetcher />
      {children}
    </NextAuthSessionProvider>
  );
}
