
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';

export default function DeleteAccountPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const { data, error } = await supabase.auth.getUser();

      if (!active) return;

      if (error || !data.user) {
        setLoading(false);
        return;
      }

      setEmail(data.user.email || '');
      setLoading(false);
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    setError('');
    setSuccess('');

    if (!confirmed) {
      setError('Please confirm that you want to request account deletion.');
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/account-deletion/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request submission failed.');
      }

      setSuccess(result.message);
      setConfirmed(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-semibold text-sky-700 hover:underline"
        >
          LearnPathshala
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-red-50">
            <Trash2 className="h-7 w-7 text-red-600" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Request Account Deletion
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            You can request deletion of your LearnPathshala account and
            associated personal information using this page.
          </p>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="font-semibold text-amber-900">
                  Before you continue
                </h2>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Account deletion may affect your course access, mock-test
                  purchases, test history and profile. Certain transaction
                  records may need to be retained where required by law.
                </p>
              </div>
            </div>
          </div>

          {success ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex gap-2 text-emerald-800">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{success}</p>
              </div>
            </div>
          ) : !email ? (
            <div className="mt-6">
              <p className="text-sm text-slate-600">
                Please sign in to verify ownership of the account you want
                deleted.
              </p>
              <Link
                href="/login?next=%2Fdelete-account"
                className="mt-4 inline-flex rounded-lg bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Sign in to continue
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Account to be deleted
                </p>
                <p className="mt-1 break-all font-semibold text-slate-900">
                  {email}
                </p>
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-red-600"
                />
                <span className="text-sm leading-6 text-slate-600">
                  I confirm that I own this account and want to request its
                  deletion.
                </span>
              </label>

              {error && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!confirmed || submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
                {submitting ? 'Submitting...' : 'Submit deletion request'}
              </button>
            </>
          )}

          {error && !success && email && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-8 border-t border-slate-100 pt-5">
            <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Your request will be reviewed and processed according to
                LearnPathshala's account deletion and data retention
                procedures. Signing out or uninstalling the app does not
                delete your account.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          Need help? Contact LearnPathshala support.
        </p>
      </div>
    </main>
  );
}
