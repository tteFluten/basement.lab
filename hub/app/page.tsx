import { DashboardHistory } from "./DashboardHistory";
import { HomeAppsSection } from "./HomeAppsSection";

export default function HomePage() {
  return (
    <main className="min-h-[80vh] bg-bg text-fg p-8 lg:p-10">
      <h1 className="text-lg font-medium text-fg border-b border-border pb-4 mb-8">
        Basement Lab
      </h1>

      <HomeAppsSection />

      <section>
        <h2 className="text-xs font-bold text-fg-muted uppercase tracking-[0.2em] mb-4">Gallery</h2>
        <DashboardHistory />
      </section>
    </main>
  );
}
