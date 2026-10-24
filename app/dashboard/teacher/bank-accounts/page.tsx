
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

type BankAccount = {
  id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  is_verified: boolean;
  is_default: boolean;
  created_at: string;
};

export default function TeacherBankAccountsPage() {
  const { user, profile, loading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: '',
  });

  const load = useCallback(async () => {
    if (!user || profile?.role !== 'teacher') return;
    setBusy(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('teacher_bank_accounts')
      .select('id, account_holder_name, bank_name, account_number, ifsc_code, is_verified, is_default, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (loadError) setError(loadError.message);
    else setAccounts((data || []) as BankAccount[]);
    setBusy(false);
  }, [user, profile]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'teacher')) {
      window.location.href = '/login';
      return;
    }
    if (user && profile?.role === 'teacher') void load();
  }, [loading, user, profile, load]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!user) return;

    const accountNumber = form.account_number.trim();
    const ifsc = form.ifsc_code.trim().toUpperCase();

    if (accountNumber !== form.confirm_account_number.trim()) {
      setError('Account numbers do not match.');
      return;
    }

    if (!/^[0-9]{8,18}$/.test(accountNumber)) {
      setError('Enter a valid bank account number (8–18 digits).');
      return;
    }

    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      setError('Enter a valid IFSC code.');
      return;
    }

    setSaving(true);

    try {
      // Do not let the browser set is_verified=true.
      const { error: insertError } = await supabase
        .from('teacher_bank_accounts')
        .insert({
          teacher_id: user.id,
          account_holder_name: form.account_holder_name.trim(),
          bank_name: form.bank_name.trim(),
          account_number: accountNumber,
          ifsc_code: ifsc,
          is_verified: false,
          is_default: accounts.length === 0,
        });

      if (insertError) throw insertError;

      setForm({
        account_holder_name: '',
        bank_name: '',
        account_number: '',
        confirm_account_number: '',
        ifsc_code: '',
      });

      setMessage('Bank account submitted. It must be verified by an admin before withdrawal.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save bank account.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || busy) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <DashboardShell role="teacher">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bank Accounts</h1>
        <p className="text-sm text-slate-500">Add a bank account for manual payouts.</p>
      </div>

      {message && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add bank account</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <div>
                <label className="mb-1 block text-sm font-medium">Account holder name</label>
                <input required maxLength={100} autoComplete="name" className="w-full rounded-md border p-2.5" value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bank name</label>
                <input required maxLength={100} className="w-full rounded-md border p-2.5" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Account number</label>
                <input required inputMode="numeric" autoComplete="off" maxLength={18} className="w-full rounded-md border p-2.5" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirm account number</label>
                <input required inputMode="numeric" autoComplete="off" maxLength={18} className="w-full rounded-md border p-2.5" value={form.confirm_account_number} onChange={(e) => setForm({ ...form, confirm_account_number: e.target.value.replace(/\D/g, '') })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">IFSC code</label>
                <input required maxLength={11} autoCapitalize="characters" className="w-full rounded-md border p-2.5 uppercase" value={form.ifsc_code} onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })} />
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : 'Submit bank account'}
              </Button>
              <p className="text-xs text-slate-500">Bank details are sensitive. Use HTTPS in production and restrict database access.</p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Saved accounts
              <Button size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-sm text-slate-500">No bank accounts added yet.</p>
            ) : accounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="font-semibold">{account.bank_name}</p>
                      <p className="text-sm text-slate-500">{account.account_holder_name}</p>
                      <p className="text-sm text-slate-500">Account ending {account.account_number.slice(-4)}</p>
                      <p className="text-xs text-slate-500">IFSC: {account.ifsc_code}</p>
                    </div>
                  </div>
                  <Badge variant={account.is_verified ? 'default' : 'outline'}>
                    {account.is_verified ? 'Verified' : 'Pending verification'}
                  </Badge>
                </div>
                {account.is_default && <p className="mt-2 text-xs text-sky-700">Default account</p>}
                {account.is_verified && <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Eligible for withdrawal</p>}
              </div>
            ))}
            <Button asChild variant="outline" className="w-full"><Link href="/dashboard/teacher/withdrawals">Go to withdrawals</Link></Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
