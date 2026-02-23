"use client";

import { useEffect, useState } from "react";
import { getAppLabel } from "@/lib/appIcons";
import {
  Users,
  ImagePlus,
  LayoutGrid,
  Bug,
  Star,
  Loader2,
  RefreshCw,
  Clock,
} from "lucide-react";

type UsageStats = {
  users: { total: number; active: number };
  generations: {
    total: number;
    last7Days: number;
    last30Days: number;
    byApp: { appId: string; count: number }[];
    sampleSize: number;
  };
  userActivity: {
    userId: string;
    generationsCount: number;
    lastActivityAt: number;
    fullName: string | null;
    email: string;
  }[];
  submittedApps: {
    total: number;
    byUser: {
      userId: string;
      count: number;
      fullName: string | null;
      email: string;
    }[];
  };
  bugReports: { total: number; open: number };
  ratings: { total: number };
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminUsageStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/usage");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-fg-muted">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading usage…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-amber-400">
        <p>{error}</p>
        <button
          type="button"
          onClick={fetchStats}
          className="mt-2 text-sm text-fg-muted hover:text-fg flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: "Users",
      value: `${stats.users.active} / ${stats.users.total} active`,
      icon: Users,
    },
    {
      label: "Generations (total)",
      value: stats.generations.total.toLocaleString(),
      icon: ImagePlus,
    },
    {
      label: "Last 7 days",
      value: stats.generations.last7Days.toLocaleString(),
      icon: Clock,
    },
    {
      label: "Last 30 days",
      value: stats.generations.last30Days.toLocaleString(),
      icon: Clock,
    },
    {
      label: "Submitted apps",
      value: stats.submittedApps.total.toString(),
      icon: LayoutGrid,
    },
    {
      label: "Bug reports",
      value: `${stats.bugReports.open} open / ${stats.bugReports.total} total`,
      icon: Bug,
    },
    {
      label: "Ratings",
      value: stats.ratings.total.toString(),
      icon: Star,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium border-b border-border pb-2">
          Usage overview
        </h2>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="text-xs text-fg-muted hover:text-fg flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="border border-border bg-bg-muted/50 p-4 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2 text-fg-muted">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-xs uppercase tracking-wider">{c.label}</span>
              </div>
              <p className="text-lg font-medium text-fg">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="border border-border overflow-hidden">
          <h3 className="text-sm font-medium uppercase tracking-wider text-fg-muted px-4 py-3 border-b border-border bg-bg-muted/50">
            Most used apps (last {stats.generations.sampleSize.toLocaleString()} generations)
          </h3>
          <div className="divide-y divide-border">
            {stats.generations.byApp.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-muted">No data</p>
            ) : (
              stats.generations.byApp.map(({ appId, count }) => (
                <div
                  key={appId}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <span className="text-sm text-fg">{getAppLabel(appId)}</span>
                  <span className="text-sm font-medium text-fg-muted">{count.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-border overflow-hidden">
          <h3 className="text-sm font-medium uppercase tracking-wider text-fg-muted px-4 py-3 border-b border-border bg-bg-muted/50">
            User activity (recent generations)
          </h3>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {stats.userActivity.length === 0 ? (
              <p className="px-4 py-6 text-sm text-fg-muted">No data</p>
            ) : (
              stats.userActivity.map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-fg truncate">
                      {u.fullName || u.email || u.userId}
                    </p>
                    {u.fullName && u.email && (
                      <p className="text-xs text-fg-muted truncate">{u.email}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-medium">{u.generationsCount}</span>
                    <span className="text-xs text-fg-muted ml-1">gens</span>
                    <p className="text-[10px] text-fg-muted">
                      {formatDate(u.lastActivityAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="border border-border overflow-hidden">
        <h3 className="text-sm font-medium uppercase tracking-wider text-fg-muted px-4 py-3 border-b border-border bg-bg-muted/50">
          Submitted apps by user
        </h3>
        <div className="divide-y divide-border">
          {stats.submittedApps.byUser.length === 0 ? (
            <p className="px-4 py-6 text-sm text-fg-muted">No submitted apps</p>
          ) : (
            stats.submittedApps.byUser.map((s) => (
              <div
                key={s.userId}
                className="flex items-center justify-between px-4 py-2.5"
              >
                <span className="text-sm text-fg truncate">
                  {s.userId === "anonymous"
                    ? "Anonymous"
                    : s.fullName || s.email || s.userId}
                </span>
                <span className="text-sm font-medium text-fg-muted">{s.count} app(s)</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
