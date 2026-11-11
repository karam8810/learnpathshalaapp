
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

type DeletionRequest = {
  id: string;
  user_id: string | null;
  email: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  admin_notes: string | null;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
};

export default function AdminDeletionRequestsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'admin')) {
      router.replace('/login');
    }
  }, [loading, user, profile, router]);

  const loadRequests = useCallback(async () => {
    if (!user || profile?.role !== 'admin') return;

    setPageLoading(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Admin session expired. Please log in again.');

      const response = await fetch('/api/admin/account-deletion', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Unable to load requests.');

      setRequests(result.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests.');
    } finally {
      setPageLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (profile?.role === 'admin') void loadRequests();
  }, [profile, loadRequests]);

  async function updateRequest(id: string, action: 'approve' | 'reject') {
    const confirmation =
      action === 'approve'
        ? 'Approve this request and move it to processing? The account will NOT be deleted yet.'
        : 'Reject this account deletion request?';

    if (!window.confirm(confirmation)) return;

    setBusyId(id);
    setError('');
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error('Admin session expired.');

      const response = await fetch('/api/admin/account-deletion', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, action }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Action failed.');

      setMessage(result.message);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    processing: requests.filter((r) => r.status === 'processing').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  if (loading || !user || profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <DashboardShell role="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Account Deletion Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and manage student account deletion requests.
          </p>
        </div>

        <button
          onClick={() => void loadRequests()}
          disabled={pageLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${pageLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pending', count: counts.pending, icon: Clock, color: 'text-amber-600' },
          { label: 'Processing', count: counts.processing, icon: AlertTriangle, color: 'text-sky-600' },
          { label: 'Completed', count: counts.completed, icon: CheckCircle, color: 'text-emerald-600' },
          { label: 'Rejected', count: counts.rejected, icon: XCircle, color: 'text-red-600' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{item.label}</span>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{item.count}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {pageLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No account deletion requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead className="bg-slate-50">
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Requested</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">
                        {item.profile?.full_name || 'Account unavailable'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.profile?.phone || 'No phone number'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {item.email}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {new Date(item.requested_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {item.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            disabled={busyId === item.id}
                            onClick={() => void updateRequest(item.id, 'approve')}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busyId === item.id ? 'Working...' : 'Approve'}
                          </button>
                          <button
                            disabled={busyId === item.id}
                            onClick={() => void updateRequest(item.id, 'reject')}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No action available
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
