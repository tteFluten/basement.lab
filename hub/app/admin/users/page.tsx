"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, X, Pencil, Check, Trash2, Plus, Camera, Ban, CheckCircle, UserPlus, KeyRound } from "lucide-react";
import { Avatar } from "@/components/Avatar";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: string;
  status?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editRole, setEditRole] = useState("member");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [createRole, setCreateRole] = useState("member");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const d = await res.json().catch(() => ({}));
      setUsers(Array.isArray(d?.items) ? d.items : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditName(u.full_name ?? "");
    setEditNickname(u.nickname ?? "");
    setEditRole(u.role);
    setEditAvatarUrl(u.avatar_url);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editName.trim() || null,
          nickname: editNickname.trim() || null,
          role: editRole,
          avatar_url: editAvatarUrl,
        }),
      });
      if (res.ok) { setEditingId(null); fetchUsers(); }
    } finally { setSaving(false); }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.url) setEditAvatarUrl(d.url); })
        .catch(() => {})
        .finally(() => setUploadingAvatar(false));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleSuspend = async (u: User) => {
    const newStatus = u.status === "suspended" ? "active" : "suspended";
    const action = newStatus === "suspended" ? "Suspend" : "Reactivate";
    if (!confirm(`${action} user ${u.email}?`)) return;
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchUsers();
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  };

  const handleChangePassword = async (id: string) => {
    if (savingPassword || newPassword.length < 4) return;
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setPasswordMsg({ ok: true, text: "Password updated" });
        setNewPassword("");
        setTimeout(() => { setPasswordUserId(null); setPasswordMsg(null); }, 1500);
      } else {
        const d = await res.json().catch(() => ({}));
        setPasswordMsg({ ok: false, text: d.error || "Failed" });
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          full_name: createName.trim() || null,
          nickname: createNickname.trim() || null,
          role: createRole,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(d.error || "Failed to create user");
        return;
      }
      setShowCreate(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateNickname("");
      setCreateRole("member");
      fetchUsers();
    } finally { setCreating(false); }
  };

  const filtered = search.trim()
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          u.email.toLowerCase().includes(q) ||
          (u.full_name ?? "").toLowerCase().includes(q) ||
          (u.nickname ?? "").toLowerCase().includes(q)
        );
      })
    : users;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium">Users</h1>
          <p className="text-xs text-fg-muted mt-1">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-fg text-bg hover:opacity-90 transition-opacity shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          New user
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="border border-border p-4 mb-6 space-y-3 bg-bg-muted/30">
          <h3 className="text-sm font-medium text-fg">Create User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-fg-muted uppercase mb-1">Email *</label>
              <input type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required
                className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
            </div>
            <div>
              <label className="block text-[10px] text-fg-muted uppercase mb-1">Password *</label>
              <input type="text" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required minLength={4}
                className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
            </div>
            <div>
              <label className="block text-[10px] text-fg-muted uppercase mb-1">Full name</label>
              <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)}
                className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
            </div>
            <div>
              <label className="block text-[10px] text-fg-muted uppercase mb-1">Nickname</label>
              <input type="text" value={createNickname} onChange={(e) => setCreateNickname(e.target.value)}
                className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
            </div>
            <div>
              <label className="block text-[10px] text-fg-muted uppercase mb-1">Role</label>
              <select value={createRole} onChange={(e) => setCreateRole(e.target.value)}
                className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg">
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating}
              className="flex items-center gap-1 px-4 py-2 text-xs bg-fg text-bg hover:opacity-90 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> {creating ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-xs border border-border hover:bg-bg-muted">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-2 bg-bg-muted border border-border px-3 py-2 max-w-sm mb-6">
        <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
        <input
          type="text"
          placeholder="Search by name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="text-fg-muted hover:text-fg">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-fg-muted py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-fg-muted py-8 text-center">
          {users.length === 0 ? "No users found." : "No users match your search."}
        </p>
      ) : (
        <ul className="border border-border divide-y divide-border">
          {filtered.map((u) => {
            const isEditing = editingId === u.id;
            const isSuspended = u.status === "suspended";
            return (
              <li key={u.id} className={`p-4 transition-colors ${isSuspended ? "opacity-50" : "hover:bg-bg-muted/30"}`}>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="relative group focus:outline-none shrink-0"
                        disabled={uploadingAvatar}
                      >
                        <Avatar src={editAvatarUrl} name={editName || undefined} email={u.email} size="md" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-4 h-4 text-white" />
                        </span>
                      </button>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <div>
                        <span className="text-sm text-fg-muted">{u.email}</span>
                        {uploadingAvatar && <span className="text-[10px] text-fg-muted ml-2">Uploading…</span>}
                        {editAvatarUrl && (
                          <button type="button" onClick={() => setEditAvatarUrl(null)} className="block text-[10px] text-red-400 hover:text-red-300 mt-0.5">
                            Remove avatar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-fg-muted uppercase mb-1">Full name</label>
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-fg-muted uppercase mb-1">Nickname</label>
                        <input type="text" value={editNickname} onChange={(e) => setEditNickname(e.target.value)}
                          className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-fg-muted uppercase mb-1">Role</label>
                        <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                          className="w-full bg-bg border border-border px-2 py-1.5 text-sm text-fg">
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveEdit(u.id)} disabled={saving}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-fg text-bg hover:opacity-90 disabled:opacity-50">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button type="button" onClick={cancelEdit}
                        className="px-3 py-1.5 text-xs border border-border hover:bg-bg-muted">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <Avatar src={u.avatar_url} name={u.full_name ?? undefined} email={u.email} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-fg">{u.full_name || u.email}</span>
                          {u.nickname && <span className="text-xs text-fg-muted">({u.nickname})</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 border ${u.role === "admin" ? "border-amber-600 text-amber-400" : "border-border text-fg-muted"}`}>
                            {u.role}
                          </span>
                          {isSuspended && (
                            <span className="text-[10px] px-1.5 py-0.5 border border-red-800 text-red-400">
                              suspended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-fg-muted">{u.email}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => startEdit(u)} title="Edit"
                          className="p-2 text-fg-muted hover:text-fg border border-transparent hover:border-border transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button type="button"
                          onClick={() => { setPasswordUserId(passwordUserId === u.id ? null : u.id); setNewPassword(""); setPasswordMsg(null); }}
                          title="Change password"
                          className={`p-2 border border-transparent transition-colors ${passwordUserId === u.id ? "text-fg border-border" : "text-fg-muted hover:text-fg hover:border-border"}`}>
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => toggleSuspend(u)}
                          title={isSuspended ? "Reactivate" : "Suspend"}
                          className={`p-2 border border-transparent transition-colors ${isSuspended ? "text-green-600 hover:text-green-400 hover:border-green-900/50" : "text-fg-muted hover:text-amber-400 hover:border-amber-900/50"}`}>
                          {isSuspended ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button type="button" onClick={() => deleteUser(u.id, u.email)} title="Delete"
                          className="p-2 text-fg-muted hover:text-red-400 border border-transparent hover:border-red-900/50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {passwordUserId === u.id && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap">
                        <KeyRound className="w-4 h-4 text-fg-muted shrink-0" />
                        <input
                          type="text"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password (min 4 chars)"
                          className="flex-1 max-w-[220px] bg-bg border border-border px-2 py-1.5 text-sm text-fg focus:outline-none focus:border-fg-muted"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleChangePassword(u.id)}
                          disabled={savingPassword || newPassword.length < 4}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-fg text-bg hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> {savingPassword ? "Saving…" : "Set"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPasswordUserId(null); setPasswordMsg(null); }}
                          className="px-3 py-1.5 text-xs border border-border hover:bg-bg-muted"
                        >
                          Cancel
                        </button>
                        {passwordMsg && (
                          <span className={`text-xs ${passwordMsg.ok ? "text-green-400" : "text-red-400"}`}>
                            {passwordMsg.text}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
