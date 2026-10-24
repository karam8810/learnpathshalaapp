
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {DashboardShell} from "@/components/dashboard-shell";
import {
  IndianRupee,
  Users,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  AlertCircle,
  Wallet,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type EarningStatus = "pending" | "paid" | string;

type Earning = {
  id: string;
  teacher_id: string;
  course_id: string;
  student_id: string;
  enrollment_id: string;
  course_price: number;
  teacher_share_percent: number;
  teacher_earnings: number;
  platform_earnings: number;
  created_at: string;
  earning_status: EarningStatus | null;
  available_at: string | null;
  paid_at: string | null;
  payment_transaction_id: string | null;
  payout_reference: string | null;
  revenue_model: string | null;
  contribution_percent: number | null;
  teacher_pool_percent: number | null;
  calculation_snapshot: Record<string, unknown> | null;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
};

type Course = {
  id: string;
  title: string;
};

type WithdrawalItem = {
  earning_id: string;
  status: string;
};

type EarningRow = Earning & {
  teacherName: string;
  teacherEmail: string;
  courseTitle: string;
  reserved: boolean;
  studentName: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const dateTime = (value?: string | null) => {
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

function statusLabel(row: EarningRow) {
  if (row.earning_status === "paid") return "Paid";
  if (row.reserved) return "Reserved";
  if (row.available_at && new Date(row.available_at).getTime() > Date.now()) {
    return "Settlement hold";
  }
  return "Pending";
}

function statusStyle(status: string) {
  switch (status) {
    case "Paid":
      return "bg-emerald-50 text-emerald-700";
    case "Reserved":
      return "bg-blue-50 text-blue-700";
    case "Settlement hold":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function downloadCSV(rows: EarningRow[]) {
  const headers = [
    "Earning ID",
    "Teacher",
    "Teacher Email",
    "Course",
    "Student",
    "Course Price",
    "Teacher Share %",
    "Teacher Earnings",
    "Platform Earnings",
    "Status",
    "Created At",
    "Available At",
    "Paid At",
    "Payment Transaction ID",
    "Payout Reference",
  ];

  const csvCell = (value: unknown) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const content = [
    headers,
    ...rows.map((row) => [
      row.id,
      row.teacherName,
      row.teacherEmail,
      row.courseTitle,
      row.studentName,
      row.course_price,
      row.teacher_share_percent,
      row.teacher_earnings,
      row.platform_earnings,
      statusLabel(row),
      row.created_at,
      row.available_at,
      row.paid_at,
      row.payment_transaction_id,
      row.payout_reference,
    ]),
  ]
    .map((line) => line.map(csvCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "learnpathshala-teacher-earnings.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminTeacherEarningsPage() {

  const { profile } = useAuth();

  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [withdrawalItems, setWithdrawalItems] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        earningsResult,
        profilesResult,
        coursesResult,
        itemsResult,
      ] = await Promise.all([
        supabase
          .from("teacher_earnings")
          .select(
            "id,teacher_id,course_id,student_id,enrollment_id,course_price,teacher_share_percent,teacher_earnings,platform_earnings,created_at,earning_status,available_at,paid_at,payment_transaction_id,payout_reference,revenue_model,contribution_percent,teacher_pool_percent,calculation_snapshot"
          )
          .order("created_at", { ascending: false })
          .limit(10000),

        supabase
          .from("profiles")
          .select("id,full_name,email")
          .eq("role", "teacher"),

        supabase
          .from("courses")
          .select("id,title"),

        supabase
          .from("teacher_withdrawal_items")
          .select("earning_id,status")
          .in("status", ["reserved", "paid"]),
      ]);

      if (earningsResult.error) throw earningsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (coursesResult.error) throw coursesResult.error;

      setEarnings((earningsResult.data || []) as Earning[]);
      setProfiles((profilesResult.data || []) as Profile[]);
      setCourses((coursesResult.data || []) as Course[]);
      setWithdrawalItems(
        itemsResult.error
          ? []
          : ((itemsResult.data || []) as WithdrawalItem[])
      );
    } catch (err) {
      console.error("Teacher earnings load failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load teacher earnings."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

useEffect(() => {
  if (profile?.role === 'admin') {
    void loadData();
  } else if (profile) {
    setLoading(false);
    setError('You do not have permission to view teacher earnings.');
  }
}, [profile, loadData]);

  const rows = useMemo<EarningRow[]>(() => {
    const profileMap = new Map(profiles.map((item) => [item.id, item]));
    const courseMap = new Map(courses.map((item) => [item.id, item.title]));
    const reservedIds = new Set(
      withdrawalItems.map((item) => item.earning_id)
    );

    return earnings.map((earning) => {
      const teacher = profileMap.get(earning.teacher_id);
      const student = profileMap.get(earning.student_id);

      return {
        ...earning,
        teacherName: teacher?.full_name || "Unknown teacher",
        teacherEmail: teacher?.email || "",
        courseTitle: courseMap.get(earning.course_id) || "Unknown course",
        studentName: student?.full_name || "Unknown student",
        reserved: reservedIds.has(earning.id),
      };
    });
  }, [earnings, profiles, courses, withdrawalItems]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        [
          row.teacherName,
          row.teacherEmail,
          row.courseTitle,
          row.studentName,
          row.id,
          row.payment_transaction_id || "",
        ].some((value) => value.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" || statusLabel(row) === statusFilter;

      const matchesTeacher =
        teacherFilter === "all" || row.teacher_id === teacherFilter;

      return matchesSearch && matchesStatus && matchesTeacher;
    });
  }, [rows, search, statusFilter, teacherFilter]);

  const stats = useMemo(() => {
    let totalEarned = 0;
    let paid = 0;
    let reserved = 0;
    let available = 0;
    let onHold = 0;

    rows.forEach((row) => {
      const amount = Number(row.teacher_earnings) || 0;

      if (row.earning_status === "paid") {
        paid += amount;
        return;
      }

      totalEarned += amount;

      if (row.reserved) {
        reserved += amount;
      } else if (
        row.available_at &&
        new Date(row.available_at).getTime() > Date.now()
      ) {
        onHold += amount;
      } else {
        available += amount;
      }
    });

    return {
      totalEarned,
      paid,
      reserved,
      available,
      onHold,
      teachers: new Set(rows.map((row) => row.teacher_id)).size,
      records: rows.length,
    };
  }, [rows]);

  const teacherSummaries = useMemo(() => {
    const groups = new Map<
      string,
      {
        teacher_id: string;
        name: string;
        email: string;
        total: number;
        paid: number;
        available: number;
        onHold: number;
        reserved: number;
        records: number;
      }
    >();

    rows.forEach((row) => {
      let group = groups.get(row.teacher_id);

      if (!group) {
        group = {
          teacher_id: row.teacher_id,
          name: row.teacherName,
          email: row.teacherEmail,
          total: 0,
          paid: 0,
          available: 0,
          onHold: 0,
          reserved: 0,
          records: 0,
        };
        groups.set(row.teacher_id, group);
      }

      const amount = Number(row.teacher_earnings) || 0;
      group.records += 1;

      if (row.earning_status === "paid") {
        group.paid += amount;
      } else {
        group.total += amount;

        if (row.reserved) group.reserved += amount;
        else if (
          row.available_at &&
          new Date(row.available_at).getTime() > Date.now()
        ) {
          group.onHold += amount;
        } else group.available += amount;
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => b.total + b.paid - (a.total + a.paid)
    );
  }, [rows]);

  if (profile && profile.role !== "admin") {
    return (
      <DashboardShell role="admin">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          You do not have permission to view this page.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin">
      <div className="space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Teacher Earnings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Review teacher revenue, settlement holds, and payout history.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => downloadCSV(filteredRows)}
              disabled={loading || filteredRows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Unpaid earnings"
            value={money(stats.totalEarned)}
            icon={<IndianRupee size={20} />}
            description="Recorded earnings not yet paid"
          />
          <StatCard
            title="Available to withdraw"
            value={money(stats.available)}
            icon={<Wallet size={20} />}
            description="Past settlement hold, not reserved"
          />
          <StatCard
            title="Settlement hold"
            value={money(stats.onHold)}
            icon={<Clock size={20} />}
            description="Waiting for the 7-day hold"
          />
          <StatCard
            title="Total paid"
            value={money(stats.paid)}
            icon={<CheckCircle2 size={20} />}
            description="Earnings marked paid"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            title="Teachers with earnings"
            value={String(stats.teachers)}
            icon={<Users size={20} />}
            description={`${stats.records} earning records`}
          />
          <StatCard
            title="Reserved for withdrawals"
            value={money(stats.reserved)}
            icon={<Wallet size={20} />}
            description="Already reserved in withdrawal requests"
          />
        </div>

        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Teacher-wise summary
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Expand a teacher to see their individual earning records.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading teacher earnings…
            </div>
          ) : teacherSummaries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No teacher earnings found.
            </div>
          ) : (
            <div className="divide-y">
              {teacherSummaries.map((teacher) => {
                const isExpanded = expandedTeacher === teacher.teacher_id;
                const teacherRows = filteredRows.filter(
                  (row) => row.teacher_id === teacher.teacher_id
                );

                return (
                  <div key={teacher.teacher_id}>
                    <button
                      onClick={() =>
                        setExpandedTeacher(
                          isExpanded ? null : teacher.teacher_id
                        )
                      }
                      className="grid w-full gap-3 p-4 text-left hover:bg-slate-50 md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_24px] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-900">
                          {teacher.name}
                        </div>
                        <div className="truncate text-sm text-slate-500">
                          {teacher.email || "No email"} · {teacher.records} records
                        </div>
                      </div>
                      <SummaryAmount label="Unpaid" value={money(teacher.total)} />
                      <SummaryAmount label="Available" value={money(teacher.available)} />
                      <SummaryAmount label="On hold" value={money(teacher.onHold)} />
                      <SummaryAmount label="Paid" value={money(teacher.paid)} />
                      {isExpanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t bg-slate-50 p-4">
                        {teacherRows.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No records match the current filters.
                          </p>
                        ) : (
                          <EarningsTable rows={teacherRows} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              All earning records
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Search by teacher, email, course, student, or earning ID.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search earnings…"
                  className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <select
                value={teacherFilter}
                onChange={(event) => setTeacherFilter(event.target.value)}
                className="rounded-lg border bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All teachers</option>
                {teacherSummaries.map((teacher) => (
                  <option key={teacher.teacher_id} value={teacher.teacher_id}>
                    {teacher.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="Settlement hold">Settlement hold</option>
                <option value="Reserved">Reserved</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading records…
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-3 text-sm text-slate-500">
                Showing {filteredRows.length} of {rows.length} records
              </div>
              <EarningsTable rows={filteredRows} />
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function SummaryAmount({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function EarningsTable({ rows }: { rows: EarningRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">
        No earning records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Teacher / Student</th>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Course price</th>
            <th className="px-4 py-3 font-medium">Teacher earning</th>
            <th className="px-4 py-3 font-medium">Teacher pool</th>
            <th className="px-4 py-3 font-medium">Contribution</th>
            <th className="px-4 py-3 font-medium">Platform earning</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Available</th>
            <th className="px-4 py-3 font-medium">Payment reference</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const status = statusLabel(row);

            return (
              <tr key={row.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {row.teacherName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {row.teacherEmail}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Student: {row.studentName}
                  </div>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <div className="font-medium text-slate-800">
                    {row.courseTitle}
                  </div>
                  <div className="mt-1 break-all text-[11px] text-slate-400">
                    {row.id}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.revenue_model || "Revenue model not recorded"}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {money(Number(row.course_price))}
                  <div className="mt-1 text-xs text-slate-500">
                    Share: {row.teacher_share_percent}%
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                  {money(Number(row.teacher_earnings))}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.teacher_pool_percent == null
                    ? "—"
                    : `${Number(row.teacher_pool_percent).toFixed(2)}%`}
                  {typeof row.calculation_snapshot?.platform_profit_percent === "number" && (
                    <div className="mt-1 text-xs text-slate-500">
                      Platform share: {Number(row.calculation_snapshot.platform_profit_percent).toFixed(2)}%
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.contribution_percent == null
                    ? "—"
                    : `${Number(row.contribution_percent).toFixed(2)}%`}
                  {row.revenue_model && (
                    <div className="mt-1 text-xs text-slate-500">
                      {row.revenue_model} allocation
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {money(Number(row.platform_earnings))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                  {row.paid_at && (
                    <div className="mt-1 text-xs text-slate-500">
                      Paid: {dateTime(row.paid_at)}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {dateTime(row.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {dateTime(row.available_at)}
                </td>
                <td className="max-w-[190px] px-4 py-3">
                  <div className="break-all text-xs text-slate-700">
                    {row.payment_transaction_id || "Missing transaction link"}
                  </div>
                  {row.payout_reference && (
                    <div className="mt-1 break-all text-xs text-emerald-700">
                      Payout: {row.payout_reference}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
