"use client";

import { useState, useCallback } from "react";
import { X, ExternalLink, Pencil, Image } from "lucide-react";

export type SubmittedAppForm = {
  title: string;
  description: string;
  deployLink: string;
  editLink: string;
  thumbnailUrl: string;
  version: string;
  tags: string[];
};

const defaultForm: SubmittedAppForm = {
  title: "",
  description: "",
  deployLink: "",
  editLink: "",
  thumbnailUrl: "",
  version: "1.0",
  tags: [],
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddSubmittedAppModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<SubmittedAppForm>(defaultForm);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((updates: Partial<SubmittedAppForm>) => {
    setForm((f) => ({ ...f, ...updates }));
    setError(null);
  }, []);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
      setTagInput("");
    }
  }, [tagInput, form.tags]);

  const removeTag = useCallback((t: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!form.title.trim() || !form.deployLink.trim()) {
        setError("Title and Deploy link are required.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch("/api/submitted-apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(),
            description: form.description.trim() || null,
            deployLink: form.deployLink.trim(),
            editLink: form.editLink.trim() || null,
            thumbnailUrl: form.thumbnailUrl.trim() || null,
            version: form.version.trim() || "1.0",
            tags: form.tags,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? `Error ${res.status}`);
          return;
        }
        setForm(defaultForm);
        setTagInput("");
        onSuccess();
        onClose();
      } finally {
        setSubmitting(false);
      }
    },
    [form, onSuccess, onClose]
  );

  const handleClose = useCallback(() => {
    if (!submitting) {
      setForm(defaultForm);
      setTagInput("");
      setError(null);
      onClose();
    }
  }, [submitting, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-bg border border-border shadow-xl">
        <div className="sticky top-0 bg-bg border-b border-border px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-fg">Add application</h3>
          <button type="button" onClick={handleClose} className="p-2 text-fg-muted hover:text-fg transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="App name"
              className="w-full bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Short description"
              rows={2}
              className="w-full bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Deploy link *</label>
            <div className="flex gap-2">
              <ExternalLink className="w-4 h-4 text-fg-muted shrink-0 mt-2.5" />
              <input
                type="url"
                value={form.deployLink}
                onChange={(e) => update({ deployLink: e.target.value })}
                placeholder="https://..."
                className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Edit link</label>
            <div className="flex gap-2">
              <Pencil className="w-4 h-4 text-fg-muted shrink-0 mt-2.5" />
              <input
                type="url"
                value={form.editLink}
                onChange={(e) => update({ editLink: e.target.value })}
                placeholder="https://..."
                className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Thumbnail URL (optional)</label>
            <div className="flex gap-2">
              <Image className="w-4 h-4 text-fg-muted shrink-0 mt-2.5" />
              <input
                type="url"
                value={form.thumbnailUrl}
                onChange={(e) => update({ thumbnailUrl: e.target.value })}
                placeholder="https://..."
                className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Version</label>
            <input
              type="text"
              value={form.version}
              onChange={(e) => update({ version: e.target.value })}
              placeholder="1.0"
              className="w-full max-w-[120px] bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-muted border border-border text-xs text-fg"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="text-fg-muted hover:text-fg" aria-label={`Remove ${t}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag and press Enter"
                className="flex-1 bg-bg-muted border border-border px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
              />
              <button type="button" onClick={addTag} className="px-3 py-2 border border-border text-sm text-fg hover:bg-bg-muted transition-colors">
                Add
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-fg-muted hover:text-fg border border-border hover:bg-bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-fg text-bg hover:opacity-90 disabled:opacity-50 transition-opacity">
              {submitting ? "Adding…" : "Add application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
