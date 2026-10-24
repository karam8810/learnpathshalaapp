"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  Clock,
  Loader2,
  RefreshCw,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type BankAccount = {
  id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  is_verified: boolean;
  is_default: boolean;
};

type Withdrawal = {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
};

type CourseEarning = {
  id: string;
  teacher_earnings: number;
  earning_status: string | null;
  available_at: string | null;
  created_at: string;
};

type WithdrawalItem = {
  earning_id: string | null;
  referral_commission_id: string | null;
  amount: number;
  status: string;
};

type ReferralCommission = {
  id: string;
  product_type: string;
  transaction_id: string | null;
  product_id: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  available_at: string | null;
  created_at?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function referralStatus(commission: ReferralCommission) {
  if (commission.status === "paid") return "Paid";
  if (commission.status === "cancelled" || commission.status === "reversed") {
    return "Cancelled";
  }
  if (
    commission.available_at &&
    new Date(commission.available_at).getTime() > Date.now()
  ) {
    return "Settlement hold";
  }
  return commission.status
    ? commission.status.charAt(0).toUpperCase() + commission.status.slice(1)
    : "Pending";
}

export default function TeacherWithdrawalsPage() {
  const { user, profile, loading } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [requests, setRequests] = useState<Withdrawal[]>([]);
  const [referralCommissions, setReferralCommissions] = useState<ReferralCommission[]>([]);
  const [courseEarnings, setCourseEarnings] = useState<CourseEarning[]>([]);
  const [withdrawalItems, setWithdrawalItems] = useState<WithdrawalItem[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!user || profile?.role !== "teacher") return;

    setBusy(true);
    setError("");

    try {
      const [accountResult, requestResult, referralResult, courseEarningsResult] = await Promise.all([
        supabase
          .from("teacher_bank_accounts")
          .select("id, bank_name, account_holder_name, account_number, is_verified, is_default")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("teacher_withdrawal_requests")
          .select("id, amount, status, requested_at, reviewed_at, paid_at, payout_reference, admin_note, rejection_reason")
          .eq("teacher_id", user.id)
          .order("requested_at", { ascending: false }),
        supabase
          .from("teacher_referral_commissions")
          .select("id, product_type, transaction_id, product_id, gross_amount, commission_rate, commission_amount, status, available_at, created_at")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("teacher_earnings")
          .select("id, teacher_earnings, earning_status, available_at, created_at")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (accountResult.error) throw accountResult.error;
      if (requestResult.error) throw requestResult.error;

      setAccounts((accountResult.data || []) as BankAccount[]);
      setRequests((requestResult.data || []) as Withdrawal[]);

      if (courseEarningsResult.error) throw courseEarningsResult.error;
      const courseRows = (courseEarningsResult.data || []) as CourseEarning[];
      setCourseEarnings(courseRows);
      if (courseRows.length) {
        const { data: itemData, error: itemError } = await supabase
          .from("teacher_withdrawal_items")
          .select("earning_id, referral_commission_id, amount, status")
          .in("earning_id", courseRows.map((row) => row.id));
        if (itemError) throw itemError;
        setWithdrawalItems((itemData || []) as WithdrawalItem[]);
      } else {
        setWithdrawalItems([]);
      }

      // Keep the withdrawals page usable if referral-table SELECT is not yet
      // enabled by RLS, but surface the reason so it can be configured.
      if (referralResult.error) {
        console.error("Could not load referral commissions:", referralResult.error);
        setReferralCommissions([]);
        if (referralResult.error.code !== "42P01") {
          setError(
            "Your withdrawal history loaded, but referral commissions could not be read. Check the teacher SELECT policy on teacher_referral_commissions."
          );
        }
      } else {
        setReferralCommissions((referralResult.data || []) as ReferralCommission[]);
      }

      const bankAccounts = (accountResult.data || []) as BankAccount[];
      const defaultAccount =
        bankAccounts.find((a) => a.is_verified && a.is_default) ||
        bankAccounts.find((a) => a.is_verified);

      setSelectedAccount((current) =>
        bankAccounts.some((a) => a.id === current && a.is_verified)
          ? current
          : defaultAccount?.id || ""
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load withdrawals.");
    } finally {
      setBusy(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "teacher")) {
      window.location.href = "/login";
      return;
    }
    if (user && profile?.role === "teacher") void load();
  }, [loading, user, profile, load]);

  const courseTotals = useMemo(() => {
    const reservedIds = new Set(
      withdrawalItems
        .filter((item) => item.earning_id && ["reserved", "paid"].includes(item.status))
        .map((item) => item.earning_id as string)
    );
    const now = Date.now();
    let total = 0, paid = 0, onHold = 0, reserved = 0, potentiallyAvailable = 0;
    for (const earning of courseEarnings) {
      const amount = Number(earning.teacher_earnings) || 0;
      if (earning.earning_status === "paid") { paid += amount; continue; }
      total += amount;
      if (reservedIds.has(earning.id)) { reserved += amount; continue; }
      const availableAt = earning.available_at ||
        new Date(new Date(earning.created_at).getTime() + 7 * 86400000).toISOString();
      if (new Date(availableAt).getTime() > now) onHold += amount;
      else potentiallyAvailable += amount;
    }
    return { total, paid, onHold, reserved, potentiallyAvailable };
  }, [courseEarnings, withdrawalItems]);

  const referralTotals = useMemo(() => {
    const now = Date.now();
    let total = 0;
    let paid = 0;
    let onHold = 0;
    let potentiallyAvailable = 0;

    for (const commission of referralCommissions) {
      const amount = Number(commission.commission_amount) || 0;
      const status = commission.status?.toLowerCase();

      if (status === "cancelled" || status === "reversed") continue;
      if (status === "paid") {
        paid += amount;
        continue;
      }

      total += amount;
      if (
        commission.available_at &&
        new Date(commission.available_at).getTime() > now
      ) {
        onHold += amount;
      } else if (status === "pending" || status === "available") {
        potentiallyAvailable += amount;
      }
    }

    return { total, paid, onHold, potentiallyAvailable };
  }, [referralCommissions]);

  const requestWithdrawal = async () => {
    setError("");
    setMessage("");

    if (!selectedAccount) {
      setError("Add a bank account and wait for admin verification before requesting a withdrawal.");
      return;
    }

    const confirmed = window.confirm(
      "Request withdrawal of your eligible course-earning balance? The minimum is ₹500. Referral commissions are shown separately and are not included unless the withdrawal database function has been updated to support them."
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "request_teacher_withdrawal",
        { p_bank_account_id: selectedAccount }
      );

      if (rpcError) throw rpcError;

      const result = data as {
        withdrawal_id?: string;
        amount?: number;
        status?: string;
      };

      setMessage(
        `Withdrawal request submitted for ${money(Number(result?.amount || 0))}. Status: ${result?.status || "pending"}.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || busy) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const verifiedAccounts = accounts.filter((a) => a.is_verified);

  return (
    <DashboardShell role="teacher">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawals</h1>
          <p className="text-sm text-slate-500">
            Request a bank transfer and track your payout status.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="flex items-center justify-between p-5"><div>
          <p className="text-sm text-slate-500">Course earnings available</p>
          <p className="mt-1 text-2xl font-bold">{money(courseTotals.potentiallyAvailable)}</p>
          <p className="mt-1 text-xs text-slate-500">Past settlement hold, not reserved</p>
        </div><Wallet className="h-7 w-7 text-emerald-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div>
          <p className="text-sm text-slate-500">Course earnings on hold</p>
          <p className="mt-1 text-2xl font-bold">{money(courseTotals.onHold)}</p>
          <p className="mt-1 text-xs text-slate-500">Waiting for the settlement date</p>
        </div><Clock className="h-7 w-7 text-amber-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div>
          <p className="text-sm text-slate-500">Course earnings reserved</p>
          <p className="mt-1 text-2xl font-bold">{money(courseTotals.reserved)}</p>
          <p className="mt-1 text-xs text-slate-500">Attached to withdrawal requests</p>
        </div><ArrowDownToLine className="h-7 w-7 text-sky-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-5"><div>
          <p className="text-sm text-slate-500">Course earnings paid</p>
          <p className="mt-1 text-2xl font-bold">{money(courseTotals.paid)}</p>
          <p className="mt-1 text-xs text-slate-500">Already marked paid</p>
        </div><CheckCircle2 className="h-7 w-7 text-slate-600" /></CardContent></Card>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Referral commissions</p>
              <p className="mt-1 text-2xl font-bold">{money(referralTotals.total + referralTotals.paid)}</p>
              <p className="mt-1 text-xs text-slate-500">Recorded, excluding cancelled commissions</p>
            </div>
            <Wallet className="h-7 w-7 text-sky-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Referral settlement hold</p>
              <p className="mt-1 text-2xl font-bold">{money(referralTotals.onHold)}</p>
              <p className="mt-1 text-xs text-slate-500">Waiting for the availability date</p>
            </div>
            <Clock className="h-7 w-7 text-amber-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Referral potentially available</p>
              <p className="mt-1 text-2xl font-bold">{money(referralTotals.potentiallyAvailable)}</p>
              <p className="mt-1 text-xs text-slate-500">Not yet confirmed withdrawable by the database</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-slate-500">Referral paid</p>
              <p className="mt-1 text-2xl font-bold">{money(referralTotals.paid)}</p>
              <p className="mt-1 text-xs text-slate-500">Already marked paid in the commission ledger</p>
            </div>
            <CheckCircle2 className="h-7 w-7 text-slate-600" />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Referral withdrawals are tracked separately</p>
            <p className="mt-1">
              The balance cards are dashboard estimates. The{" "}
              <code>request_teacher_withdrawal</code> database function is the source
              of truth for the amount it actually reserves. This page requests a withdrawal
              from course earnings; referral commissions remain separate and must not be
              assumed withdrawable unless the database function explicitly reserves them.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5" /> New withdrawal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Minimum withdrawal</p>
              <p className="text-2xl font-bold">₹500</p>
              <p className="mt-1 text-xs text-slate-500">
                Estimated course balance past hold: {money(courseTotals.potentiallyAvailable)}.
                The database validates the actual amount, minimum, and settlement hold.
              </p>
            </div>

            {verifiedAccounts.length ? (
              <>
                <label className="block text-sm font-medium" htmlFor="bankAccount">
                  Verified bank account
                </label>
                <select
                  id="bankAccount"
                  className="w-full rounded-md border bg-white p-2.5"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  {verifiedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} •••• {a.account_number.slice(-4)}
                      {a.is_default ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
                <Button
                  className="w-full"
                  onClick={() => void requestWithdrawal()}
                  disabled={submitting || !selectedAccount}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="mr-2 h-4 w-4" />
                  )}
                  {submitting ? "Submitting..." : "Request available balance"}
                </Button>
                <p className="text-xs text-slate-500">
                  The database calculates and reserves the eligible amount. If a
                  request is rejected, the database should release the reserved items.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-900">
                  You need an admin-verified bank account before withdrawing.
                </p>
                <Button asChild className="mt-3">
                  <Link href="/dashboard/teacher/bank-accounts">Add bank account</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Request history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">No withdrawal requests yet.</p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{money(Number(request.amount))}</p>
                      <p className="text-xs text-slate-500">{dateLabel(request.requested_at)}</p>
                    </div>
                    <Badge variant={request.status === "paid" ? "default" : "outline"}>
                      {request.status}
                    </Badge>
                  </div>
                  {request.payout_reference && (
                    <p className="mt-2 text-sm">Payout reference: {request.payout_reference}</p>
                  )}
                  {request.rejection_reason && (
                    <p className="mt-2 text-sm text-red-700">Reason: {request.rejection_reason}</p>
                  )}
                  {request.admin_note && (
                    <p className="mt-2 text-sm text-slate-600">Admin note: {request.admin_note}</p>
                  )}
                  {request.paid_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      Paid on {new Date(request.paid_at).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Referral commission history</CardTitle>
        </CardHeader>
        <CardContent>
          {referralCommissions.length === 0 ? (
            <p className="text-sm text-slate-500">
              No referral commissions found, or the commission table is not readable by this account.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="p-3">Type</th>
                    <th className="p-3">Purchase amount</th>
                    <th className="p-3">Rate</th>
                    <th className="p-3">Commission</th>
                    <th className="p-3">Available at</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {referralCommissions.map((commission) => (
                    <tr key={commission.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">
                        {commission.product_type === "mock_test_series"
                          ? "Mock test series"
                          : commission.product_type === "course"
                            ? "Course"
                            : commission.product_type}
                      </td>
                      <td className="p-3">{money(Number(commission.gross_amount))}</td>
                      <td className="p-3">{Number(commission.commission_rate)}%</td>
                      <td className="p-3 font-semibold">{money(Number(commission.commission_amount))}</td>
                      <td className="p-3">{dateLabel(commission.available_at)}</td>
                      <td className="p-3">
                        <Badge variant={commission.status === "paid" ? "default" : "outline"}>
                          {referralStatus(commission)}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">
                        {commission.transaction_id || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
