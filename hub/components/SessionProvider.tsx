"use client";

import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { ReactNode, useEffect, useRef } from "react";
import { fetchGenerations, isCacheReady } from "@/lib/generationsCache";

function Prefetcher() {
  const { status } = useSession();
  const tried = useRef(false);

  useEffect(() => {
    if (!isCacheReady() && !tried.current) {
      tried.current = true;
      fetchGenerations();
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && !isCacheReady()) {
      fetchGenerations(true);
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
