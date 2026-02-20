"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, X, Check, Users, Trash2, Plus } from "lucide-react";

type Project = {
  id: string;
  name: string;
  client: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
};

type User = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  role: string;
};

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [createClient, setCreateClient] = useState("");
  const [creating, setCreating] = useState(false);
  const [membersModal, setMembersModal] = useState<{ projectId: string; name: string } | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json().catch(() => ({}));
    setProjects(Array.isArray(data?.items) ? data.items : []);
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json().catch(() => ({}));
    setUsers(Array.isArray(data?.items) ? data.items : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchProjects(), fetchUsers()]).finally(() => setLoading(false));
  }, [fetchProjects, fetchUsers]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = (a.full_name || a.email).toLowerCase();
      const nameB = (b.full_name || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q)
    );
  }, [sortedUsers, memberSearch]);

  const selectedUsers = useMemo(() => {
    return sortedUsers.filter((u) => memberIds.includes(u.id));
  }, [sortedUsers, memberIds]);

  const unselectedFiltered = useMemo(() => {
    return filteredUsers.filter((u) => !memberIds.includes(u.id));
  }, [filteredUsers, memberIds]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName.trim(), client: createClient.trim() || null }),
      });
      if (res.ok) {
        setCreateName("");
        setCreateClient("");
        fetchProjects();
      }
    } finally {
      setCreating(false);
    }
  };

  const openMembers = async (projectId: string, name: string) => {
    setMembersModal({ projectId, name });
    setMemberSearch("");
    const res = await fetch(`/api/projects/${projectId}/members`);
    const data = await res.json().catch(() => ({}));
    setMemberIds(Array.isArray(data?.userIds) ? data.userIds : []);
  };

  const saveMembers = async () => {
    if (!membersModal || savingMembers) return;
    setSavingMembers(true);
    try {
      const res = await fetch(`/api/projects/${membersModal.projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: memberIds }),
      });
      if (res.ok) setMembersModal(null);
    } finally {
      setSavingMembers(false);
    }
  };

  const toggleMember = (userId: string) => {
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? This will unassign all users.`)) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) fetchProjects();
  };

  if (loading) {
    return <p className="text-fg-muted text-sm p-8">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-medium border-b border-border pb-3 mb-6">Projects</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-8 p-5 border border-border bg-bg-muted flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-xs text-fg-muted block mb-1.5">Name</span>
          <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} required
            className="border border-border bg-bg px-3 py-2 text-sm text-fg w-48 focus:outline-none focus:border-fg-muted" />
        </label>
        <label className="block">
          <span className="text-xs text-fg-muted block mb-1.5">Client (optional)</span>
          <input type="text" value={createClient} onChange={(e) => setCreateClient(e.target.value)}
            className="border border-border bg-bg px-3 py-2 text-sm text-fg w-48 focus:outline-none focus:border-fg-muted" />
        </label>
        <button type="submit" disabled={creating}
          className="px-4 py-2 border border-border bg-bg text-fg text-sm hover:bg-fg hover:text-bg disabled:opacity-50 transition-colors flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" />
          {creating ? "Creating…" : "Create project"}
        </button>
      </form>

      {/* Projects list */}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="border border-border p-4 flex items-center justify-between flex-wrap gap-3 hover:border-fg-muted transition-colors">
            <div>
              <span className="font-medium text-fg">{p.name}</span>
              {p.client && <span className="text-fg-muted text-sm ml-2">— {p.client}</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openMembers(p.id, p.name)}
                className="text-xs px-3 py-1.5 border border-border hover:bg-bg-muted transition-colors flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Assign users
              </button>
              <button type="button" onClick={() => handleDelete(p.id, p.name)}
                className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {projects.length === 0 && (
        <p className="text-fg-muted text-sm mt-4">No projects yet. Create one above.</p>
      )}

      {/* Members modal */}
      {membersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-bg border border-border max-w-lg w-full max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-medium text-fg">Assign users</h2>
                <p className="text-xs text-fg-muted mt-0.5">{membersModal.name} · {memberIds.length} selected</p>
              </div>
              <button type="button" onClick={() => setMembersModal(null)}
                className="p-1.5 text-fg-muted hover:text-fg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2 border border-border bg-bg-muted px-3 py-2">
                <Search className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
                  autoFocus
                />
                {memberSearch && (
                  <button type="button" onClick={() => setMemberSearch("")} className="text-fg-muted hover:text-fg">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Selected users first */}
              {selectedUsers.length > 0 && (
                <div className="px-5 pt-3 pb-1">
                  <p className="text-[10px] text-fg-muted uppercase tracking-wider mb-2">
                    Selected ({selectedUsers.length})
                  </p>
                  {selectedUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition-colors text-left group mb-0.5"
                    >
                      <div className="w-5 h-5 border border-fg-muted bg-fg-muted/20 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-fg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg truncate">{u.full_name || u.nickname || u.email}</p>
                        {u.full_name && <p className="text-[10px] text-fg-muted truncate">{u.email}</p>}
                      </div>
                      <span className="text-[10px] text-fg-muted uppercase">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Divider */}
              {selectedUsers.length > 0 && unselectedFiltered.length > 0 && (
                <div className="border-t border-border mx-5 my-1" />
              )}

              {/* Unselected users */}
              {unselectedFiltered.length > 0 && (
                <div className="px-5 pt-2 pb-3">
                  {selectedUsers.length > 0 && (
                    <p className="text-[10px] text-fg-muted uppercase tracking-wider mb-2">
                      Available ({unselectedFiltered.length})
                    </p>
                  )}
                  {unselectedFiltered.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleMember(u.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition-colors text-left group mb-0.5"
                    >
                      <div className="w-5 h-5 border border-border group-hover:border-fg-muted flex items-center justify-center shrink-0 transition-colors" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg truncate">{u.full_name || u.nickname || u.email}</p>
                        {u.full_name && <p className="text-[10px] text-fg-muted truncate">{u.email}</p>}
                      </div>
                      <span className="text-[10px] text-fg-muted uppercase">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}

              {filteredUsers.length === 0 && memberSearch.trim() && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-fg-muted">No users match &quot;{memberSearch}&quot;</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
              <p className="text-xs text-fg-muted">{memberIds.length} user{memberIds.length !== 1 ? "s" : ""} assigned</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMembersModal(null)}
                  className="px-4 py-2 border border-border text-sm text-fg-muted hover:text-fg transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveMembers} disabled={savingMembers}
                  className="px-4 py-2 border border-border bg-fg text-bg text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors">
                  {savingMembers ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
