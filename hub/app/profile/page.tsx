"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Camera, Bug, Star } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
};

type BugItem = { id: string; appId: string; appTitle: string; title: string; status: string; createdAt: number };
type RatingItem = { id: string; appId: string; appTitle: string; score: number; createdAt: number };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activityBugs, setActivityBugs] = useState<BugItem[]>([]);
  const [activityRatings, setActivityRatings] = useState<RatingItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setProfile(d);
        setFullName(d.fullName ?? "");
        setNickname(d.nickname ?? "");
        setAvatarUrl(d.avatarUrl ?? null);
      })
      .catch(() => setProfile(null))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetch("/api/me/activity")
      .then((r) => r.json())
      .then((d) => {
        setActivityBugs(Array.isArray(d?.bugs) ? d.bugs : []);
        setActivityRatings(Array.isArray(d?.ratings) ? d.ratings : []);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim() || null,
          nickname: nickname.trim() || null,
          avatarUrl: avatarUrl || null,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setProfile(d);
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.url) setAvatarUrl(d.url);
        })
        .catch(() => {});
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (loading) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-medium border-b border-border pb-2 mb-4">Profile</h1>
        <p className="text-fg-muted text-sm">Loading...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-8">
        <h1 className="text-xl font-medium border-b border-border pb-2 mb-4">Profile</h1>
        <p className="text-fg-muted text-sm">Sign in to edit your profile.</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-xl">
      <h1 className="text-xl font-medium border-b border-border pb-2 mb-6">Profile</h1>
      <p className="text-xs text-fg-muted mb-6">Update your display info. Email cannot be changed.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group focus:outline-none"
          >
            <Avatar src={avatarUrl} name={fullName || undefined} email={profile.email} size="lg" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
          <div>
            <p className="text-sm text-fg font-medium">Profile photo</p>
            <p className="text-xs text-fg-muted">Click the avatar to upload a new image</p>
          </div>
        </div>

        <div>
          <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Email</label>
          <input
            type="email"
            value={profile.email}
            readOnly
            className="w-full border border-border bg-bg-muted px-3 py-2 text-sm text-fg-muted cursor-not-allowed"
          />
          <p className="text-[10px] text-fg-muted mt-1">Email cannot be changed</p>
        </div>

        <div>
          <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
          />
        </div>

        <div>
          <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Nickname</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Display nickname"
            className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 border border-border bg-fg text-bg text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
          {saved && <span className="text-xs text-green-500">Profile updated.</span>}
        </div>
      </form>

      <section className="mt-10 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-fg mb-3 flex items-center gap-2">
          <Bug className="w-4 h-4" /> Bug Reports ({activityBugs.length})
        </h2>
        {activityBugs.length === 0 ? (
          <p className="text-xs text-fg-muted">No bug reports yet.</p>
        ) : (
          <ul className="space-y-2">
            {activityBugs.map((b) => (
              <li key={b.id} className="flex items-center gap-3 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b.status === "open" ? "bg-amber-400" : b.status === "resolved" ? "bg-green-400" : "bg-zinc-500"}`} />
                <Link href={`/submitted-apps/${b.appId}`} className="text-fg hover:underline truncate">{b.title}</Link>
                <span className="text-fg-muted shrink-0">on {b.appTitle}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-fg mb-3 flex items-center gap-2">
          <Star className="w-4 h-4" /> Ratings Given ({activityRatings.length})
        </h2>
        {activityRatings.length === 0 ? (
          <p className="text-xs text-fg-muted">No ratings given yet.</p>
        ) : (
          <ul className="space-y-2">
            {activityRatings.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-xs">
                <span className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`w-3 h-3 ${n <= r.score ? "text-amber-400 fill-amber-400" : "text-zinc-600"}`} />
                  ))}
                </span>
                <Link href={`/submitted-apps/${r.appId}`} className="text-fg hover:underline truncate">{r.appTitle}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
