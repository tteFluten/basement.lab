"use client";

import { useEffect, useState, useRef } from "react";
import { Avatar } from "@/components/Avatar";
import { Camera } from "lucide-react";

type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  role: string;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        {/* Avatar */}
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

        {/* Email (read-only) */}
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

        {/* Full name */}
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

        {/* Nickname */}
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
    </main>
  );
}
