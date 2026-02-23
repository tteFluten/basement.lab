import Link from "next/link";
import { AdminUsageStats } from "@/components/AdminUsageStats";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-10">
      <h1 className="text-xl font-medium border-b border-border pb-2 mb-4">
        Admin Dashboard
      </h1>

      <section>
        <AdminUsageStats />
      </section>

      <section>
        <h2 className="text-lg font-medium border-b border-border pb-2 mb-4">
          Manage
        </h2>
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
          <li>
            <Link
              href="/admin/submitted-apps"
              className="text-fg-muted hover:text-fg border border-border hover:border-fg-muted p-4 block"
            >
              <span className="font-medium">Submitted Apps</span>
              <span className="text-sm text-fg-muted ml-2">— Edit apps, assign icons, manage tags</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
