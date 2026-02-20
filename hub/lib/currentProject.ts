const STORAGE_KEY = "hub_current_project_id";

export function getCurrentProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setCurrentProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id == null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, id);
  }
}
