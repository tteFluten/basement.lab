"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
    return <p className="text-fg-muted text-sm">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-medium border-b border-border pb-2 mb-4">Projects</h1>

      <form onSubmit={handleCreate} className="mb-8 p-4 border border-border bg-bg-muted flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="text-xs text-fg-muted block mb-1">Name</span>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
            className="border border-border bg-bg px-3 py-2 text-fg"
          />
        </label>
        <label className="block">
          <span className="text-xs text-fg-muted block mb-1">Client (optional)</span>
          <input
            type="text"
            value={createClient}
            onChange={(e) => setCreateClient(e.target.value)}
            className="border border-border bg-bg px-3 py-2 text-fg"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 border border-border bg-bg text-fg hover:bg-fg-muted hover:text-bg disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create project"}
        </button>
      </form>

      <ul className="space-y-2">
        {projects.map((p) => (
          <li
            key={p.id}
            className="border border-border p-4 flex items-center justify-between flex-wrap gap-2"
          >
            <div>
              <span className="font-medium">{p.name}</span>
              {p.client && <span className="text-fg-muted text-sm ml-2">— {p.client}</span>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openMembers(p.id, p.name)}
                className="text-xs px-3 py-1.5 border border-border hover:bg-bg-muted"
              >
                Assign users
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id, p.name)}
                className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {projects.length === 0 && (
        <p className="text-fg-muted text-sm">No projects yet. Create one above.</p>
      )}

      {membersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-bg border border-border max-w-md w-full p-6 max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-medium mb-2">Assign users — {membersModal.name}</h2>
            <p className="text-fg-muted text-sm mb-4">Select users who belong to this project.</p>
            <ul className="space-y-2 mb-6">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`user-${u.id}`}
                    checked={memberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  <label htmlFor={`user-${u.id}`} className="text-sm">
                    {u.full_name || u.email} <span className="text-fg-muted">({u.email})</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveMembers}
                disabled={savingMembers}
                className="px-4 py-2 border border-border bg-bg hover:bg-bg-muted disabled:opacity-50"
              >
                {savingMembers ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setMembersModal(null)}
                className="px-4 py-2 border border-border text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
