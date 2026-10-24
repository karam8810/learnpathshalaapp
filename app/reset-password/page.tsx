
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function verifyRecoverySession() {
      try {
        // Supabase may return a PKCE code in the query string.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) throw exchangeError;

          // Remove the one-time code from the visible URL.
          window.history.replaceState(
            window.history.state,
            "",
            url.pathname
          );
        }

        const { data, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (active) {
          setAuthorized(Boolean(data.session));
          if (!data.session) {
            setError(
              "This reset link is invalid or expired. Please request a new one."
            );
          }
        }
      } catch {
        if (active) {
          setAuthorized(false);
          setError(
            "Unable to verify this reset link. Please request a new one."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    verifyRecoverySession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setAuthorized(false);
        throw new Error(
          "Your reset session has expired. Please request a new link."
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setMessage(
        "Your password has been updated successfully. You can now log in with your new password."
      );
      setPassword("");
      setConfirmPassword("");
      setAuthorized(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose a new password for your LearnPathshala account.
          </p>
        </div>

        {checking ? (
          <p className="py-6 text-center text-sm text-slate-600">
            Verifying your reset link...
          </p>
        ) : message ? (
          <div className="space-y-4">
            <p
              role="status"
              className="rounded-lg bg-green-50 p-3 text-sm text-green-800"
            >
              {message}
            </p>
            <Link
              href="/login"
              className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
            >
              Go to Login
            </Link>
          </div>
        ) : authorized ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Enter the password again"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <Link
              href="/forgot-password"
              className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white hover:bg-blue-700"
            >
              Request a New Reset Link
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-blue-600 hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </main>
  );
}
