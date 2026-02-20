"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Search, X, Check, Users, Trash2, Plus, Pencil, Link2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";

type ProjectLinks = {
  linear?: string;
  figma?: string;
  slack?: string;
  web?: string;
  others?: { label: string; url: string }[];
};

type Project = {
  id: string;
  name: string;
  client: string | null;
  thumbnail_url?: string | null;
  links?: ProjectLinks;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  memberIds?: string[];
};

type User = {
  id: string;
  email: string;
  full_name: string | null;
  nickname: string | null;
  avatar_url?: string | null;
  role: string;
};

const emptyLinks: ProjectLinks = { others: [] };

type ProjectFormValues = {
  name: string;
  client: string;
  thumbnail_url: string;
  links: ProjectLinks;
  start_date: string;
  end_date: string;
};

function ProjectForm({
  project,
  onSave,
  onCancel,
  saving,
}: {
  project: ProjectFormValues | null;
  onSave: (v: ProjectFormValues) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [client, setClient] = useState(project?.client ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(project?.thumbnail_url ?? "");
  const [linear, setLinear] = useState(project?.links?.linear ?? "");
  const [figma, setFigma] = useState(project?.links?.figma ?? "");
  const [slack, setSlack] = useState(project?.links?.slack ?? "");
  const [web, setWeb] = useState(project?.links?.web ?? "");
  const [others, setOthers] = useState<{ label: string; url: string }[]>(project?.links?.others ?? []);
  const [startDate, setStartDate] = useState(project?.start_date ?? "");
  const [endDate, setEndDate] = useState(project?.end_date ?? "");

  useEffect(() => {
    setName(project?.name ?? "");
    setClient(project?.client ?? "");
    setThumbnailUrl(project?.thumbnail_url ?? "");
    setLinear(project?.links?.linear ?? "");
    setFigma(project?.links?.figma ?? "");
    setSlack(project?.links?.slack ?? "");
    setWeb(project?.links?.web ?? "");
    setOthers(project?.links?.others ?? []);
    setStartDate(project?.start_date ?? "");
    setEndDate(project?.end_date ?? "");
  }, [project]);

  const addOther = () => setOthers((prev) => [...prev, { label: "", url: "" }]);
  const removeOther = (i: number) => setOthers((prev) => prev.filter((_, idx) => idx !== i));
  const updateOther = (i: number, field: "label" | "url", value: string) => {
    setOthers((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const links: ProjectLinks = {
      linear: linear.trim() || undefined,
      figma: figma.trim() || undefined,
      slack: slack.trim() || undefined,
      web: web.trim() || undefined,
      others: others.filter((o) => o.label.trim() || o.url.trim()).length ? others : undefined,
    };
    onSave({
      name: name.trim(),
      client: client.trim(),
      thumbnail_url: thumbnailUrl.trim(),
      links,
      start_date: startDate.trim(),
      end_date: endDate.trim(),
    });
  };

  const isNew = !project;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-xl bg-bg border-l border-border h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-medium text-fg">{isNew ? "New project" : "Edit project"}</h2>
          <button type="button" onClick={onCancel} className="p-2 text-fg-muted hover:text-fg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Client</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Thumbnail URL</label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://..."
              className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
            />
            {thumbnailUrl && (
              <div className="mt-2 w-24 h-24 border border-border overflow-hidden bg-bg-muted">
                <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-fg-muted uppercase tracking-wider mb-2">
              <Link2 className="w-3 h-3" /> Links
            </label>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-fg-muted block mb-1">Linear</span>
                <input
                  type="url"
                  value={linear}
                  onChange={(e) => setLinear(e.target.value)}
                  placeholder="https://linear.app/..."
                  className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                />
              </div>
              <div>
                <span className="text-[10px] text-fg-muted block mb-1">Figma</span>
                <input
                  type="url"
                  value={figma}
                  onChange={(e) => setFigma(e.target.value)}
                  placeholder="https://figma.com/..."
                  className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                />
              </div>
              <div>
                <span className="text-[10px] text-fg-muted block mb-1">Slack channels</span>
                <input
                  type="text"
                  value={slack}
                  onChange={(e) => setSlack(e.target.value)}
                  placeholder="#project-name, #design"
                  className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                />
              </div>
              <div>
                <span className="text-[10px] text-fg-muted block mb-1">Web / other link</span>
                <input
                  type="url"
                  value={web}
                  onChange={(e) => setWeb(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-fg-muted">Other useful links</span>
                  <button type="button" onClick={addOther} className="text-xs text-fg-muted hover:text-fg flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {others.map((o, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={o.label}
                      onChange={(e) => updateOther(i, "label", e.target.value)}
                      placeholder="Label"
                      className="flex-1 border border-border bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                    />
                    <input
                      type="url"
                      value={o.url}
                      onChange={(e) => updateOther(i, "url", e.target.value)}
                      placeholder="URL"
                      className="flex-[2] border border-border bg-bg px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-fg-muted"
                    />
                    <button type="button" onClick={() => removeOther(i)} className="p-1.5 text-fg-muted hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:border-fg-muted"
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted uppercase tracking-wider mb-1.5">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:border-fg-muted"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onCancel} className="px-4 py-2 border border-border text-sm text-fg-muted hover:text-fg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 border border-border bg-fg text-bg text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : isNew ? "Create project" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formProject, setFormProject] = useState<Project | null | "new">(null);
  const [formSaving, setFormSaving] = useState(false);
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

  const selectedUsers = useMemo(() => sortedUsers.filter((u) => memberIds.includes(u.id)), [sortedUsers, memberIds]);
  const unselectedFiltered = useMemo(() => filteredUsers.filter((u) => !memberIds.includes(u.id)), [filteredUsers, memberIds]);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const handleFormSave = async (v: ProjectFormValues) => {
    if (formSaving) return;
    setFormSaving(true);
    try {
      if (formProject === "new" || !formProject) {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            client: v.client || null,
            thumbnail_url: v.thumbnail_url || null,
            links: v.links,
            start_date: v.start_date || null,
            end_date: v.end_date || null,
          }),
        });
        if (res.ok) setFormProject(null);
      } else {
        const res = await fetch(`/api/projects/${formProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: v.name,
            client: v.client || null,
            thumbnail_url: v.thumbnail_url || null,
            links: v.links,
            start_date: v.start_date || null,
            end_date: v.end_date || null,
          }),
        });
        if (res.ok) setFormProject(null);
      }
      fetchProjects();
    } finally {
      setFormSaving(false);
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
    setMemberIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? This will unassign all users.`)) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) fetchProjects();
  };

  const editProject = (p: Project) => {
    setFormProject({
      ...p,
      links: p.links ?? emptyLinks,
    });
  };

  if (loading) {
    return <p className="text-fg-muted text-sm p-8">Loading...</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-medium border-b border-border pb-3 mb-6">Projects</h1>

      <div className="mb-8">
        <button
          type="button"
          onClick={() => setFormProject("new")}
          className="px-4 py-2 border border-border bg-fg text-bg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" />
          New project
        </button>
      </div>

      <ul className="space-y-2">
        {projects.map((p) => {
          const members = (p.memberIds ?? []).map((id) => userById.get(id)).filter(Boolean) as User[];
          return (
            <li key={p.id} className="border border-border p-4 flex items-center gap-4 flex-wrap hover:border-fg-muted transition-colors">
              {p.thumbnail_url ? (
                <div className="w-12 h-12 shrink-0 border border-border overflow-hidden bg-bg-muted">
                  <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-12 h-12 shrink-0 border border-border bg-bg-muted flex items-center justify-center text-fg-muted text-xs">No img</div>
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium text-fg">{p.name}</span>
                {p.client && <span className="text-fg-muted text-sm ml-2">— {p.client}</span>}
                {members.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {members.slice(0, 5).map((u) => (
                      <Avatar key={u.id} src={u.avatar_url} name={u.full_name ?? undefined} email={u.email} size="sm" title={u.full_name || u.email} />
                    ))}
                    {members.length > 5 && <span className="text-[10px] text-fg-muted">+{members.length - 5}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => editProject(p)} className="text-xs px-3 py-1.5 border border-border hover:bg-bg-muted transition-colors flex items-center gap-1.5">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button type="button" onClick={() => openMembers(p.id, p.name)} className="text-xs px-3 py-1.5 border border-border hover:bg-bg-muted transition-colors flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> Assign users
                </button>
                <button type="button" onClick={() => handleDelete(p.id, p.name)} className="text-xs px-3 py-1.5 border border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {projects.length === 0 && <p className="text-fg-muted text-sm mt-4">No projects yet. Create one above.</p>}

      {/* New / Edit project slide */}
      {(formProject === "new" || formProject) && (
        <ProjectForm
          project={formProject === "new" ? null : { name: formProject.name, client: formProject.client ?? "", thumbnail_url: formProject.thumbnail_url ?? "", links: formProject.links ?? emptyLinks, start_date: formProject.start_date ?? "", end_date: formProject.end_date ?? "" }}
          onSave={handleFormSave}
          onCancel={() => setFormProject(null)}
          saving={formSaving}
        />
      )}

      {/* Assign users modal */}
      {membersModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-bg border border-border max-w-lg w-full max-h-[85vh] flex flex-col shadow-lg">
            <div className="p-5 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-medium text-fg">Assign people to project</h2>
                <p className="text-xs text-fg-muted mt-0.5">{membersModal.name} · {memberIds.length} selected</p>
              </div>
              <button type="button" onClick={() => setMembersModal(null)} className="p-1.5 text-fg-muted hover:text-fg transition-colors" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
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
            <div className="flex-1 overflow-y-auto min-h-0">
              {selectedUsers.length > 0 && (
                <div className="px-5 pt-3 pb-1">
                  <p className="text-[10px] text-fg-muted uppercase tracking-wider mb-2">Selected ({selectedUsers.length})</p>
                  {selectedUsers.map((u) => (
                    <button key={u.id} type="button" onClick={() => toggleMember(u.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition-colors text-left mb-0.5">
                      <div className="w-8 h-8 shrink-0 flex items-center justify-center border border-fg-muted bg-fg-muted/20">
                        <Check className="w-3.5 h-3.5 text-fg" />
                      </div>
                      <Avatar src={u.avatar_url} name={u.full_name ?? undefined} email={u.email} size="md" className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg truncate">{u.full_name || u.nickname || u.email}</p>
                        {(u.full_name || u.nickname) && <p className="text-[10px] text-fg-muted truncate">{u.email}</p>}
                      </div>
                      <span className="text-[10px] text-fg-muted uppercase">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUsers.length > 0 && unselectedFiltered.length > 0 && <div className="border-t border-border mx-5 my-1" />}
              {unselectedFiltered.length > 0 && (
                <div className="px-5 pt-2 pb-3">
                  {selectedUsers.length > 0 && <p className="text-[10px] text-fg-muted uppercase tracking-wider mb-2">Available ({unselectedFiltered.length})</p>}
                  {unselectedFiltered.map((u) => (
                    <button key={u.id} type="button" onClick={() => toggleMember(u.id)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-muted transition-colors text-left mb-0.5">
                      <div className="w-8 h-8 shrink-0 border border-border group-hover:border-fg-muted flex items-center justify-center transition-colors" />
                      <Avatar src={u.avatar_url} name={u.full_name ?? undefined} email={u.email} size="md" className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-fg truncate">{u.full_name || u.nickname || u.email}</p>
                        {(u.full_name || u.nickname) && <p className="text-[10px] text-fg-muted truncate">{u.email}</p>}
                      </div>
                      <span className="text-[10px] text-fg-muted uppercase">{u.role}</span>
                    </button>
                  ))}
                </div>
              )}
              {filteredUsers.length === 0 && memberSearch.trim() && (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm text-fg-muted">No people match &quot;{memberSearch}&quot;</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0">
              <p className="text-xs text-fg-muted">{memberIds.length} user{memberIds.length !== 1 ? "s" : ""} assigned</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMembersModal(null)} className="px-4 py-2 border border-border text-sm text-fg-muted hover:text-fg transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={saveMembers} disabled={savingMembers} className="px-4 py-2 border border-border bg-fg text-bg text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors">
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
