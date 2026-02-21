import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="text-xl font-medium border-b border-border pb-2 mb-4">
        Admin Dashboard
      </h1>
      <ul className="space-y-2">
        <li>
          <Link
            href="/admin/projects"
            className="text-fg-muted hover:text-fg border border-border hover:border-fg-muted p-4 block"
          >
            <span className="font-medium">Projects</span>
            <span className="text-sm text-fg-muted ml-2">— Create projects, assign users</span>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/users"
            className="text-fg-muted hover:text-fg border border-border hover:border-fg-muted p-4 block"
          >
            <span className="font-medium">Users</span>
            <span className="text-sm text-fg-muted ml-2">— View and edit user data, roles</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
