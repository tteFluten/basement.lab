import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if ((session.user as { role?: string }).role !== "admin") {
    return (
      <main className="p-8">
        <p className="text-red-400">Forbidden. Admin only.</p>
        <Link href="/" className="text-fg-muted hover:text-fg mt-2 inline-block">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="p-8 bg-bg min-h-full">
      <nav className="border-b border-border pb-4 mb-6 flex gap-4">
        <Link href="/admin" className="text-fg font-medium hover:text-fg-muted">
          Dashboard
        </Link>
        <Link href="/admin/projects" className="text-fg-muted hover:text-fg">
          Projects
        </Link>
        <Link href="/admin/users" className="text-fg-muted hover:text-fg">
          Users
        </Link>
        <Link href="/admin/submitted-apps" className="text-fg-muted hover:text-fg">
          Submitted Apps
        </Link>
        <Link href="/" className="text-fg-muted hover:text-fg ml-auto">
          Back to Hub
        </Link>
      </nav>
      {children}
    </main>
  );
}
