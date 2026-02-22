"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Step = "email" | "login" | "setup";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  async function handleEmailCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (data.suspended) {
        setError("This account has been suspended.");
        setLoading(false);
        return;
      }
      if (!data.exists) {
        setError("No account found with this email. Ask an admin to create one.");
        setLoading(false);
        return;
      }
      if (data.needsPassword) {
        setStep("setup");
      } else {
        setStep("login");
      }
    } catch {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
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
        setError("Invalid password.");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-first-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to set password.");
        setLoading(false);
        return;
      }
      const signInRes = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError("Password set. Try logging in.");
        setStep("login");
        setLoading(false);
        return;
      }
      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  function goBack() {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  return (
    <>
      <div className="w-full max-w-sm border border-border bg-bg-muted p-6">
        <h1 className="text-xl font-medium border-b border-border pb-2 mb-6">
          Basement Lab
        </h1>

        {step === "email" && (
          <>
            <p className="text-fg-muted text-sm mb-4">Enter your email to continue.</p>
            <form onSubmit={handleEmailCheck} className="space-y-4">
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
                  autoFocus
                  className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
                />
              </div>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 border border-border bg-bg text-fg font-medium hover:bg-bg-muted disabled:opacity-50"
              >
                {loading ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "login" && (
          <>
            <p className="text-fg-muted text-sm mb-4">
              Welcome back, <span className="text-fg">{email.trim()}</span>
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
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
                  autoFocus
                  className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
                />
              </div>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 border border-border bg-bg text-fg font-medium hover:bg-bg-muted disabled:opacity-50"
              >
                {loading ? "Logging in…" : "Log in"}
              </button>
            </form>
            <button
              type="button"
              onClick={goBack}
              className="mt-3 text-xs text-fg-muted hover:text-fg"
            >
              ← Use a different email
            </button>
          </>
        )}

        {step === "setup" && (
          <>
            <p className="text-fg-muted text-sm mb-1">
              Welcome, <span className="text-fg">{email.trim()}</span>
            </p>
            <p className="text-fg-muted text-xs mb-4">
              This is your first time. Create a password to get started.
            </p>
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm text-fg-muted mb-1">
                  Create password
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={4}
                  autoFocus
                  className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm text-fg-muted mb-1">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={4}
                  className="w-full px-3 py-2 border border-border bg-bg text-fg focus:outline-none focus:border-fg-muted"
                />
              </div>
              {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 border border-border bg-fg text-bg font-medium hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Setting up…" : "Set password & enter"}
              </button>
            </form>
            <button
              type="button"
              onClick={goBack}
              className="mt-3 text-xs text-fg-muted hover:text-fg"
            >
              ← Use a different email
            </button>
          </>
        )}
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
