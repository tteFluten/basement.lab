import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardHistory } from "./DashboardHistory";
import { HomeAppsSection } from "./HomeAppsSection";

export default function HomePage() {
  return (
    <main className="min-h-[80vh] bg-bg text-fg p-8 lg:p-10">
      <h1 className="text-lg font-medium text-fg border-b border-border pb-4 mb-8">
        Basement Lab
      </h1>

      <HomeAppsSection />

      {/* Recent history */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em]">Recent Generations</h2>
          <Link href="/history" className="text-xs text-fg-muted hover:text-fg transition-colors flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <DashboardHistory />
      </section>
    </main>
  );
}
