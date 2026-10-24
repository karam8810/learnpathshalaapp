
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Banknote,
  ShieldCheck,
  Clock,
  Search,
  Landmark,
  AlertCircle,
  Mail,
  UserRound,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type WithdrawalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

type Withdrawal = {
  id: string;
  teacher_id: string;
  bank_account_id: string;
  amount: number;
  status: WithdrawalStatus;
  admin_note: string | null;
  rejection_reason: string | null;
  payout_reference: string | null;
  requested_at: string;
  reviewed_at: string | null;
  paid_at: string | null;
  reviewed_by: string | null;
};

type Teacher = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type BankAccount = {
  id: string;
  teacher_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  is_verified: boolean;
  is_default: boolean;
  created_at?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const statusVariant = (status: string) => {
  if (status === "paid") return "default" as const;

  if (status === "rejected" || status === "cancelled") {
    return "destructive" as const;
  }

  return "outline" as const;
};

const maskAccount = (accountNumber: string) => {
  const value = String(accountNumber || "");
  return value.length > 4 ? `•••• ${value.slice(-4)}` : "••••";
};

export default function AdminTeacherWithdrawalsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<Withdrawal[]>([]);
  const [teachers, setTeachers] = useState<Record<string, Teacher>>({});
  const [banks, setBanks] = useState<Record<string, BankAccount>>({});

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [payoutRefs, setPayoutRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "admin")) {
      router.replace("/login");
    }
  }, [loading, user, profile, router]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user || profile?.role !== "admin") {
        setBusy(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setBusy(true);
      }

      setError("");

      try {
        // Fetch withdrawals and ALL teacher bank accounts independently.
        // This is the key fix: accounts no longer depend on a withdrawal request.
        const [requestsResult, banksResult] = await Promise.all([
          supabase
            .from("teacher_withdrawal_requests")
            .select(
              "id, teacher_id, bank_account_id, amount, status, admin_note, rejection_reason, payout_reference, requested_at, reviewed_at, paid_at, reviewed_by"
            )
            .order("requested_at", { ascending: false }),

          supabase
            .from("teacher_bank_accounts")
            .select(
              "id, teacher_id, account_holder_name, bank_name, account_number, ifsc_code, is_verified, is_default, created_at"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (requestsResult.error) throw requestsResult.error;
        if (banksResult.error) throw banksResult.error;

        const requestRows = (requestsResult.data || []) as Withdrawal[];
        const bankRows = (banksResult.data || []) as BankAccount[];

        const nextBanks: Record<string, BankAccount> = {};

        bankRows.forEach((bank) => {
          nextBanks[bank.id] = bank;
        });

        // Fetch profiles for both teachers with withdrawals and teachers
        // who have only saved a bank account.
        const teacherIds = Array.from(
          new Set([
            ...requestRows.map((item) => item.teacher_id),
            ...bankRows.map((item) => item.teacher_id),
          ])
        );

        const nextTeachers: Record<string, Teacher> = {};

        if (teacherIds.length > 0) {
          const { data: teacherRows, error: teacherError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", teacherIds);

          if (teacherError) throw teacherError;

          (teacherRows || []).forEach((teacher) => {
            nextTeachers[teacher.id] = teacher as Teacher;
          });
        }

        setRequests(requestRows);
        setBanks(nextBanks);
        setTeachers(nextTeachers);
      } catch (e) {
        console.error("Admin teacher withdrawals load error:", e);

        setError(
          e instanceof Error
            ? e.message
            : "Could not load teacher bank accounts and withdrawals."
        );
      } finally {
        setBusy(false);
        setRefreshing(false);
      }
    },
    [user, profile]
  );

  useEffect(() => {
    if (!loading && user && profile?.role === "admin") {
      void load();
    }
  }, [loading, user, profile, load]);

  const verifyBank = async (bank: BankAccount, verified: boolean) => {
    setError("");
    setMessage("");

    const teacher = teachers[bank.teacher_id];

    const confirmed = window.confirm(
      verified
        ? `Verify ${bank.bank_name}, account ending ${bank.account_number.slice(
            -4
          )}, belonging to ${teacher?.full_name || "this teacher"}? Verify only after checking the bank details independently.`
        : `Remove verification from the account ending ${bank.account_number.slice(
            -4
          )}?`
    );

    if (!confirmed) return;

    setWorkingId(bank.id);

    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_set_teacher_bank_verification",
        {
          p_bank_account_id: bank.id,
          p_is_verified: verified,
        }
      );

      if (rpcError) throw rpcError;

      setMessage(
        verified
          ? "Bank account verified successfully."
          : "Bank account verification removed."
      );

      await load(true);
    } catch (e) {
      console.error("Bank verification error:", e);

      setError(
        e instanceof Error
          ? e.message
          : "Could not update bank account verification."
      );
    } finally {
      setWorkingId(null);
    }
  };

  const review = async (
    request: Withdrawal,
    decision: "approved" | "rejected"
  ) => {
    setError("");
    setMessage("");

    const bank = banks[request.bank_account_id];
    const note = notes[request.id]?.trim() || null;

    if (decision === "approved" && (!bank || !bank.is_verified)) {
      setError(
        "Verify the teacher's bank account before approving this withdrawal."
      );
      return;
    }

    if (decision === "rejected" && !note) {
      setError("Enter a rejection reason before rejecting this request.");
      return;
    }

    const confirmed = window.confirm(
      decision === "approved"
        ? `Approve the withdrawal of ${money(Number(request.amount))}?`
        : "Reject this withdrawal and release its reserved earnings?"
    );

    if (!confirmed) return;

    setWorkingId(request.id);

    try {
      const { error: rpcError } = await supabase.rpc(
        "review_teacher_withdrawal",
        {
          p_withdrawal_id: request.id,
          p_decision: decision,
          p_note: note,
        }
      );

      if (rpcError) throw rpcError;

      setMessage(`Withdrawal ${decision} successfully.`);
      await load(true);
    } catch (e) {
      console.error("Withdrawal review error:", e);

      setError(
        e instanceof Error ? e.message : "Could not review withdrawal."
      );
    } finally {
      setWorkingId(null);
    }
  };

  const markPaid = async (request: Withdrawal) => {
    setError("");
    setMessage("");

    const bank = banks[request.bank_account_id];
    const reference = payoutRefs[request.id]?.trim();

    if (request.status !== "approved") {
      setError("Only approved withdrawal requests can be marked as paid.");
      return;
    }

    if (!bank || !bank.is_verified) {
      setError("Verify the associated bank account before recording payment.");
      return;
    }

    if (!reference) {
      setError("Enter the bank transfer / UTR reference first.");
      return;
    }

    const confirmed = window.confirm(
      `Confirm that ${money(
        Number(request.amount)
      )} has actually been transferred to the teacher's verified bank account?`
    );

    if (!confirmed) return;

    setWorkingId(request.id);

    try {
      const { error: rpcError } = await supabase.rpc(
        "mark_teacher_withdrawal_paid",
        {
          p_withdrawal_id: request.id,
          p_payout_reference: reference,
        }
      );

      if (rpcError) throw rpcError;

      setMessage("Withdrawal marked as paid.");
      await load(true);
    } catch (e) {
      console.error("Mark withdrawal paid error:", e);

      setError(
        e instanceof Error
          ? e.message
          : "Could not mark withdrawal as paid."
      );
    } finally {
      setWorkingId(null);
    }
  };

  const unverifiedBanks = useMemo(
    () => Object.values(banks).filter((bank) => !bank.is_verified),
    [banks]
  );

  const verifiedBanks = useMemo(
    () => Object.values(banks).filter((bank) => bank.is_verified),
    [banks]
  );

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesStatus =
        filter === "all" || request.status === filter;

      const teacher = teachers[request.teacher_id];
      const bank = banks[request.bank_account_id];

      const searchableValues = [
        teacher?.full_name || "",
        teacher?.email || "",
        request.id,
        bank?.account_holder_name || "",
        bank?.bank_name || "",
      ];

      const matchesSearch =
        !query ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(query)
        );

      return matchesStatus && matchesSearch;
    });
  }, [requests, teachers, banks, filter, search]);

  const pendingCount = requests.filter(
    (request) => request.status === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) => request.status === "approved"
  ).length;

  const paidTotal = requests
    .filter((request) => request.status === "paid")
    .reduce((sum, request) => sum + Number(request.amount), 0);

  if (loading || busy) {
    return (
      <DashboardShell role="admin">
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <span className="ml-3 text-sm text-slate-500">
            Loading bank accounts and withdrawals...
          </span>
        </div>
      </DashboardShell>
    );
  }

  if (!user || profile?.role !== "admin") return null;

  return (
    <DashboardShell role="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Teacher Withdrawals
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify bank accounts, review withdrawal requests, and record
            manual bank transfers.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={refreshing}
          onClick={() => void load(true)}
        >
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

      {/* Withdrawal summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Clock className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-slate-500">Pending review</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Banknote className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Approved for payout</p>
              <p className="text-2xl font-bold">{approvedCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-slate-500">Total marked paid</p>
              <p className="text-xl font-bold">{money(paidTotal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank account verification */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Bank account verification
            </span>
            <Badge variant="outline">
              {unverifiedBanks.length} awaiting verification
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent>
          {unverifiedBanks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
              <p className="font-medium text-slate-800">
                No unverified bank accounts
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Newly saved teacher bank accounts will appear here, even if
                the teacher has not requested a withdrawal.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unverifiedBanks.map((bank) => {
                const teacher = teachers[bank.teacher_id];
                const working = workingId === bank.id;

                return (
                  <div
                    key={bank.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Landmark className="h-5 w-5 shrink-0 text-sky-600" />
                        <p className="font-semibold text-slate-900">
                          {bank.bank_name}
                        </p>
                        {bank.is_default && (
                          <Badge variant="outline">Default</Badge>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        Account holder: {bank.account_holder_name}
                      </p>

                      <p className="text-sm text-slate-600">
                        Account: {maskAccount(bank.account_number)}
                      </p>

                      <p className="text-sm text-slate-600">
                        IFSC: {bank.ifsc_code}
                      </p>

                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        <p className="flex items-center gap-2">
                          <UserRound className="h-4 w-4" />
                          {teacher?.full_name || "Teacher profile unavailable"}
                        </p>

                        {teacher?.email && (
                          <p className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {teacher.email}
                          </p>
                        )}

                        <p className="text-xs">
                          Teacher ID: {bank.teacher_id}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="shrink-0"
                      disabled={working}
                      onClick={() => void verifyBank(bank, true)}
                    >
                      {working ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Verify account
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              Verified bank accounts ({verifiedBanks.length})
            </h3>

            {verifiedBanks.length === 0 ? (
              <p className="text-sm text-slate-500">
                No verified accounts yet.
              </p>
            ) : (
              <div className="space-y-2">
                {verifiedBanks.map((bank) => {
                  const teacher = teachers[bank.teacher_id];
                  const working = workingId === bank.id;

                  return (
                    <div
                      key={bank.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">
                          {bank.bank_name} · {maskAccount(bank.account_number)}
                        </p>
                        <p className="text-sm text-slate-600">
                          {bank.account_holder_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {teacher?.full_name || bank.teacher_id}
                          {teacher?.email ? ` · ${teacher.email}` : ""}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working}
                        onClick={() => void verifyBank(bank, false)}
                      >
                        {working ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Remove verification
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Independently verify the account holder, bank details, and IFSC
            before confirming an account. Account numbers are masked in this
            interface.
          </p>
        </CardContent>
      </Card>

      {/* Withdrawal requests */}
      <Card>
        <CardHeader>
          <CardTitle>Withdrawal requests</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="mb-5 flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-md border bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Search teacher, email, bank or request ID"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              className="rounded-md border bg-white px-3 py-2.5 text-sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="py-10 text-center">
              <Banknote className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="font-medium text-slate-700">
                No withdrawal requests found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Bank account verification works independently. A withdrawal
                request will appear here after a teacher submits one.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredRequests.map((request) => {
                const teacher = teachers[request.teacher_id];
                const bank = banks[request.bank_account_id];
                const working = workingId === request.id;

                return (
                  <div
                    key={request.id}
                    className="rounded-xl border p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold text-slate-900">
                          {money(Number(request.amount))}
                        </p>

                        <p className="mt-1 font-semibold">
                          {teacher?.full_name || "Unknown teacher"}
                        </p>

                        <p className="text-sm text-slate-500">
                          {teacher?.email || request.teacher_id}
                        </p>

                        <p className="mt-1 break-all text-xs text-slate-400">
                          Request ID: {request.id}
                        </p>

                        <p className="text-xs text-slate-500">
                          Requested:{" "}
                          {new Date(request.requested_at).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>

                      <Badge variant={statusVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </div>

                    {bank ? (
                      <div className="mt-4 rounded-lg bg-slate-50 p-3">
                        <p className="font-semibold">{bank.bank_name}</p>
                        <p className="text-sm">
                          {bank.account_holder_name}
                        </p>
                        <p className="text-sm text-slate-600">
                          Account: {maskAccount(bank.account_number)}
                        </p>
                        <p className="text-sm text-slate-600">
                          IFSC: {bank.ifsc_code}
                        </p>

                        <p className="mt-1 text-xs">
                          {bank.is_verified ? (
                            <span className="text-emerald-700">
                              Verified account
                            </span>
                          ) : (
                            <span className="text-red-700">
                              Not verified — verify before approval or payout
                            </span>
                          )}
                        </p>

                        {!bank.is_verified && (
                          <Button
                            size="sm"
                            className="mt-3"
                            disabled={workingId === bank.id}
                            onClick={() => void verifyBank(bank, true)}
                          >
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Verify this account
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        The associated bank account could not be loaded.
                        Check its ID and your Supabase permissions.
                      </div>
                    )}

                    {request.status === "pending" && (
                      <div className="mt-4 space-y-3">
                        <textarea
                          className="w-full rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                          rows={2}
                          placeholder="Admin note (required for rejection)"
                          value={notes[request.id] || ""}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))
                          }
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            disabled={
                              working || !bank || !bank.is_verified
                            }
                            onClick={() => void review(request, "approved")}
                          >
                            {working ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                            )}
                            Approve withdrawal
                          </Button>

                          <Button
                            variant="destructive"
                            disabled={working}
                            onClick={() => void review(request, "rejected")}
                          >
                            {working ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="mr-2 h-4 w-4" />
                            )}
                            Reject and release funds
                          </Button>
                        </div>

                        {(!bank || !bank.is_verified) && (
                          <p className="text-xs text-amber-700">
                            Verify the associated bank account before approving
                            this request.
                          </p>
                        )}
                      </div>
                    )}

                    {request.status === "approved" && (
                      <div className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
                        <p className="text-sm font-medium text-blue-900">
                          Transfer the money manually, then record the bank
                          transfer reference below.
                        </p>

                        <input
                          className="w-full rounded-md border bg-white p-2.5 text-sm"
                          placeholder="Bank transfer / UTR reference"
                          value={payoutRefs[request.id] || ""}
                          onChange={(event) =>
                            setPayoutRefs((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))
                          }
                        />

                        <Button
                          disabled={working || !bank?.is_verified}
                          onClick={() => void markPaid(request)}
                        >
                          {working ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Banknote className="mr-2 h-4 w-4" />
                          )}
                          Mark transfer as paid
                        </Button>

                        {!bank?.is_verified && (
                          <p className="text-xs text-red-700">
                            Verify the associated bank account before marking
                            this request paid.
                          </p>
                        )}
                      </div>
                    )}

                    {request.status === "paid" && (
                      <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                        Paid
                        {request.payout_reference
                          ? ` · Reference: ${request.payout_reference}`
                          : ""}
                        {request.paid_at
                          ? ` · ${new Date(request.paid_at).toLocaleString(
                              "en-IN"
                            )}`
                          : ""}
                      </div>
                    )}

                    {request.rejection_reason && (
                      <p className="mt-3 text-sm text-red-700">
                        Rejection reason: {request.rejection_reason}
                      </p>
                    )}

                    {request.admin_note && (
                      <p className="mt-2 text-sm text-slate-600">
                        Admin note: {request.admin_note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
