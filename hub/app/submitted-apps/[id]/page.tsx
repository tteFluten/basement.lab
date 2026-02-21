"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ExternalLink, Pencil, Bug, Star, Send, X,
} from "lucide-react";

type AppInfo = {
  id: string;
  title: string;
  description: string;
  deployLink: string;
  editLink: string | null;
  version: string;
  tags: string[];
  submittedBy: string | null;
};

type BugReport = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: number;
  reportedBy: string | null;
};

type RatingInfo = {
  average: number;
  count: number;
  userScore: number | null;
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StarRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="p-0.5 transition-colors"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          <Star
            className={`w-4 h-4 ${
              (hover || value || 0) >= n ? "text-amber-400 fill-amber-400" : "text-zinc-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function SubmittedAppViewPage() {
  const params = useParams();
  const id = params?.id as string;

  const [app, setApp] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [rating, setRating] = useState<RatingInfo>({ average: 0, count: 0, userScore: null });

  const [bugTitle, setBugTitle] = useState("");
  const [bugDesc, setBugDesc] = useState("");
  const [submittingBug, setSubmittingBug] = useState(false);
  const [bugFormOpen, setBugFormOpen] = useState(false);

  const [panelTab, setPanelTab] = useState<"bugs" | "rating">("bugs");

  const fetchApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/submitted-apps/${id}`);
      if (res.ok) setApp(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchBugs = useCallback(async () => {
    try {
      const res = await fetch(`/api/submitted-apps/${id}/bugs`);
      const d = await res.json().catch(() => ({}));
      setBugs(Array.isArray(d?.items) ? d.items : []);
    } catch { setBugs([]); }
  }, [id]);

  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`/api/submitted-apps/${id}/ratings`);
      const d = await res.json().catch(() => ({}));
      setRating({ average: d.average ?? 0, count: d.count ?? 0, userScore: d.userScore ?? null });
    } catch {}
  }, [id]);

  useEffect(() => { fetchApp(); fetchBugs(); fetchRating(); }, [fetchApp, fetchBugs, fetchRating]);

  const submitBug = async () => {
    if (!bugTitle.trim()) return;
    setSubmittingBug(true);
    try {
      await fetch(`/api/submitted-apps/${id}/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bugTitle.trim(), description: bugDesc.trim() || null }),
      });
      setBugTitle("");
      setBugDesc("");
      setBugFormOpen(false);
      fetchBugs();
    } finally {
      setSubmittingBug(false);
    }
  };

  const submitRating = async (score: number) => {
    await fetch(`/api/submitted-apps/${id}/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score }),
    });
    fetchRating();
  };

  if (loading) {
    return <main className="flex-1 flex items-center justify-center text-fg-muted text-sm">Loading…</main>;
  }

  if (!app) {
    return (
      <main className="flex-1 p-8">
        <p className="text-fg-muted">App not found.</p>
        <Link href="/submitted-apps" className="text-xs text-fg-muted hover:text-fg mt-2 inline-block">Back to list</Link>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-bg-muted shrink-0">
        <Link href="/submitted-apps" className="text-fg-muted hover:text-fg">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <span className="text-sm font-medium text-fg truncate">{app.title}</span>
        <span className="text-xs text-fg-muted">v{app.version}</span>
        {app.submittedBy && <span className="text-xs text-fg-muted">by {app.submittedBy}</span>}
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-fg-muted" title={`${rating.average}/5 (${rating.count} votes)`}>
            <Star className={`w-3.5 h-3.5 ${rating.average > 0 ? "text-amber-400 fill-amber-400" : "text-zinc-600"}`} />
            <span>{rating.average > 0 ? rating.average.toFixed(1) : "–"}</span>
          </div>
          <button
            type="button"
            onClick={() => setPanelTab("bugs")}
            className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${panelTab === "bugs" ? "border-fg-muted text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
          >
            <Bug className="w-3.5 h-3.5" /> {bugs.length}
          </button>
          <button
            type="button"
            onClick={() => setPanelTab("rating")}
            className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${panelTab === "rating" ? "border-fg-muted text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
          >
            <Star className="w-3.5 h-3.5" /> Rate
          </button>
          {app.editLink && (
            <a href={app.editLink} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-fg-muted hover:text-fg" title="Edit source">
              <Pencil className="w-3.5 h-3.5" />
            </a>
          )}
          <a href={app.deployLink} target="_blank" rel="noopener noreferrer"
            className="p-1.5 text-fg-muted hover:text-fg" title="Open in new tab">
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <iframe
          title={app.title}
          src={app.deployLink}
          className="flex-1 min-h-0 border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />

        <aside className="w-72 border-l border-border bg-bg shrink-0 flex flex-col min-h-0 overflow-hidden">
          {panelTab === "bugs" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                <span className="text-xs font-medium text-fg uppercase tracking-wider">Bug Reports ({bugs.length})</span>
                <button type="button" onClick={() => setBugFormOpen((o) => !o)}
                  className="text-xs text-fg-muted hover:text-fg">
                  {bugFormOpen ? <X className="w-3.5 h-3.5" /> : "+ Report"}
                </button>
              </div>
              {bugFormOpen && (
                <div className="p-3 border-b border-border space-y-2 shrink-0">
                  <input type="text" placeholder="Bug title *" value={bugTitle} onChange={(e) => setBugTitle(e.target.value)}
                    className="w-full bg-bg-muted border border-border px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted" />
                  <textarea placeholder="Description (optional)" value={bugDesc} onChange={(e) => setBugDesc(e.target.value)} rows={2}
                    className="w-full bg-bg-muted border border-border px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted resize-none" />
                  <button type="button" onClick={submitBug} disabled={submittingBug || !bugTitle.trim()}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-fg text-bg hover:opacity-90 disabled:opacity-50">
                    <Send className="w-3 h-3" /> Submit
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {bugs.length === 0 ? (
                  <p className="text-xs text-fg-muted p-3">No bugs reported yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {bugs.map((b) => (
                      <li key={b.id} className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === "open" ? "bg-amber-400" : b.status === "resolved" ? "bg-green-400" : "bg-zinc-500"}`} />
                          <span className="text-xs font-medium text-fg flex-1 truncate">{b.title}</span>
                        </div>
                        {b.description && <p className="text-[10px] text-fg-muted mt-1 line-clamp-2">{b.description}</p>}
                        <p className="text-[10px] text-fg-muted mt-1">{fmtDate(b.createdAt)}{b.reportedBy && ` · ${b.reportedBy}`}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {panelTab === "rating" && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-fg uppercase tracking-wider mb-3">Rate this app</p>
                <StarRating value={rating.userScore} onChange={submitRating} />
                {rating.userScore && (
                  <p className="text-[10px] text-fg-muted mt-1">Your rating: {rating.userScore}/5</p>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-fg-muted">
                  Average: <span className="text-fg font-medium">{rating.average > 0 ? rating.average.toFixed(1) : "–"}</span> / 5
                </p>
                <p className="text-xs text-fg-muted">{rating.count} vote{rating.count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
