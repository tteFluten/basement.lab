"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, X, Pencil, Check, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";

type User = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  role: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editRole, setEditRole] = useState("member");
  const [saving, setSaving] = useState(false);

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
        }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchUsers();
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
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
      </div>

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
            return (
              <li key={u.id} className="p-4 hover:bg-bg-muted/30 transition-colors">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Avatar src={u.avatar_url} name={u.full_name} email={u.email} size="md" />
                      <span className="text-sm text-fg-muted">{u.email}</span>
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
                  <div className="flex items-center gap-4">
                    <Avatar src={u.avatar_url} name={u.full_name} email={u.email} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg">{u.full_name || u.email}</span>
                        {u.nickname && <span className="text-xs text-fg-muted">({u.nickname})</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 border ${u.role === "admin" ? "border-amber-600 text-amber-400" : "border-border text-fg-muted"}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-fg-muted">{u.email}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => startEdit(u)} title="Edit"
                        className="p-2 text-fg-muted hover:text-fg border border-transparent hover:border-border transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => deleteUser(u.id, u.email)} title="Delete"
                        className="p-2 text-fg-muted hover:text-red-400 border border-transparent hover:border-red-900/50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
