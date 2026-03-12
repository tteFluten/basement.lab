"use client";

import { useState } from "react";
import type { CheckResult } from "@/app/api/admin/health-check/route";

const STATUS_ICON: Record<string, string> = { ok: "✓", error: "✗", warn: "⚠", skip: "—" };
const STATUS_COLOR: Record<string, string> = {
  ok: "text-green-400",
  error: "text-red-400",
  warn: "text-yellow-400",
  skip: "text-fg-muted",
};

function buildClaudePrompt(checks: CheckResult[], timestamp: string): string {
  const failed = checks.filter((c) => c.status === "error" || c.status === "warn");
  if (failed.length === 0) return "";
  const lines = [
    `[BASEMENT LAB HEALTH CHECK — ${timestamp}]`,
    `${failed.length} issue(s) detected:\n`,
    ...failed.map((c) => [
      `## ${c.status.toUpperCase()}: ${c.name}`,
      `Message: ${c.message}`,
      c.detail ? `Detail: ${c.detail}` : null,
    ].filter(Boolean).join("\n")),
    "\n---",
    "Please diagnose and fix each issue above in the Basement Lab codebase.",
  ];
  return lines.join("\n");
}

export function AdminHealthCheck() {
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [timestamp, setTimestamp] = useState("");
  const [summary, setSummary] = useState({ errors: 0, warnings: 0 });
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setRunning(true);
    setChecks(null);
    try {
      const res = await fetch("/api/admin/health-check");
      const data = await res.json() as { checks: CheckResult[]; errors: number; warnings: number; timestamp: string };
      setChecks(data.checks);
      setSummary({ errors: data.errors, warnings: data.warnings });
      setTimestamp(new Date(data.timestamp).toLocaleString("es-AR"));
    } catch (e) {
      setChecks([{ id: "run-fail", name: "Health check request", status: "error", message: "Failed to reach /api/admin/health-check", detail: String(e) }]);
    } finally {
      setRunning(false);
    }
  };

  const claudePrompt = checks ? buildClaudePrompt(checks, timestamp) : "";

  const copyPrompt = () => {
    navigator.clipboard.writeText(claudePrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const groups: { label: string; prefix: string }[] = [
    { label: "Environment", prefix: "env" },
    { label: "Database", prefix: "db" },
    { label: "R2 Storage", prefix: "r2" },
    { label: "Gemini AI", prefix: "gemini" },
    { label: "App Embeds", prefix: "app" },
  ];

  return (
    <div className="border border-border">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4">
        <div>
          <span className="font-medium">System Diagnostics</span>
          {timestamp && <span className="text-xs text-fg-muted ml-3">Last run: {timestamp}</span>}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="px-4 py-1.5 text-sm border border-border hover:border-fg-muted disabled:opacity-40 transition-colors"
        >
          {running ? "Running…" : "Run Diagnostics"}
        </button>
      </div>

      {running && (
        <div className="px-4 py-6 text-sm text-fg-muted animate-pulse">
          Running checks — database, storage, AI, apps…
        </div>
      )}

      {checks && !running && (
        <>
          {/* Summary bar */}
          <div className="px-4 py-2 border-b border-border flex items-center gap-6 text-sm">
            <span className={summary.errors > 0 ? "text-red-400 font-medium" : "text-green-400"}>
              {STATUS_ICON[summary.errors > 0 ? "error" : "ok"]} {summary.errors} error{summary.errors !== 1 ? "s" : ""}
            </span>
            <span className={summary.warnings > 0 ? "text-yellow-400" : "text-fg-muted"}>
              {STATUS_ICON[summary.warnings > 0 ? "warn" : "ok"]} {summary.warnings} warning{summary.warnings !== 1 ? "s" : ""}
            </span>
            <span className="text-fg-muted">
              {STATUS_ICON.ok} {checks.filter(c => c.status === "ok").length} passed
            </span>
          </div>

          {/* Checks grouped */}
          <div className="divide-y divide-border">
            {groups.map(({ label, prefix }) => {
              const group = checks.filter((c) => c.id.startsWith(prefix));
              if (group.length === 0) return null;
              const worstStatus = group.some(c => c.status === "error") ? "error"
                : group.some(c => c.status === "warn") ? "warn" : "ok";
              return (
                <details key={prefix} open={worstStatus !== "ok"} className="group">
                  <summary className="px-4 py-2 flex items-center gap-3 cursor-pointer list-none hover:bg-bg-muted text-sm select-none">
                    <span className={`w-4 shrink-0 ${STATUS_COLOR[worstStatus]}`}>{STATUS_ICON[worstStatus]}</span>
                    <span className="font-medium">{label}</span>
                    <span className="text-fg-muted text-xs ml-auto">
                      {group.filter(c => c.status === "ok").length}/{group.length} ok
                    </span>
                  </summary>
                  <div className="border-t border-border divide-y divide-border">
                    {group.map((c) => (
                      <div key={c.id} className="px-4 py-2 pl-10 flex items-start gap-3 text-xs">
                        <span className={`shrink-0 mt-0.5 w-3 ${STATUS_COLOR[c.status]}`}>{STATUS_ICON[c.status]}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-fg">{c.name}</span>
                            {c.durationMs != null && <span className="text-fg-muted">{c.durationMs}ms</span>}
                          </div>
                          <div className="text-fg-muted mt-0.5">{c.message}</div>
                          {c.detail && (
                            <pre className="mt-1 text-red-400/80 whitespace-pre-wrap break-all font-mono text-[10px] bg-bg p-2 border border-border">
                              {c.detail}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          {/* Claude prompt */}
          {claudePrompt && (
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">Prompt para Claude</span>
                <button
                  type="button"
                  onClick={copyPrompt}
                  className="text-xs border border-border px-3 py-1 hover:border-fg-muted transition-colors"
                >
                  {copied ? "Copiado ✓" : "Copiar prompt"}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-fg-muted bg-bg border border-border p-3 whitespace-pre-wrap overflow-x-auto max-h-48">
                {claudePrompt}
              </pre>
            </div>
          )}

          {summary.errors === 0 && summary.warnings === 0 && (
            <div className="px-4 py-3 text-sm text-green-400 border-t border-border">
              All systems operational.
            </div>
          )}
        </>
      )}
    </div>
  );
}
