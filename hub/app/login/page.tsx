"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="w-full max-w-sm border border-border bg-bg-muted p-6">
        <h1 className="text-xl font-medium border-b border-border pb-2 mb-6">
          Basement Lab
        </h1>
        <p className="text-fg-muted text-sm mb-4">Log in with your email and password.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-fg-muted mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-fg-muted mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
            />
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 border border-border bg-bg text-fg font-medium hover:bg-bg-muted disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-xs text-fg-muted">
          No account? Ask an admin to create one.
        </p>
      </div>
      <Link
        href="/"
        className="mt-6 text-sm text-fg-muted hover:text-fg"
      >
        Back to home
      </Link>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-bg text-fg">
      <Suspense fallback={<div className="text-fg-muted">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
