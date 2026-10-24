
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  Loader2,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {DashboardShell} from "@/components/dashboard-shell";

type Period = "this_month" | "last_month" | "last_3_months" | "this_year" | "all";

type CoursePayment = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

type MockPayment = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

type TeacherEarning = {
  id: string;
  teacher_earnings: number;
  platform_earnings: number;
  created_at: string;
};

type BusinessExpense = {
  id: string;
  category_name: string;
  description: string;
  amount: number;
  expense_date: string;
  status: "paid" | "pending" | "cancelled";
};

type MonthRow = {
  key: string;
  label: string;
  revenue: number;
  teacherCost: number;
  operatingExpenses: number;
  profit: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

const dateText = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

function getRange(period: Period) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  if (period === "last_month") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }

  if (period === "last_3_months") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      end,
    };
  }

  if (period === "this_year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }

  if (period === "all") {
    return { start: null, end: null };
  }

  return { start, end };
}

function isInRange(
  date: string,
  start: Date | null,
  end: Date | null
) {
  const value = new Date(date).getTime();

  return (
    (!start || value >= start.getTime()) &&
    (!end || value < end.getTime())
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconClass,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`rounded-xl p-3 ${iconClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function AdminProfitLossPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [coursePayments, setCoursePayments] = useState<CoursePayment[]>([]);
  const [mockPayments, setMockPayments] = useState<MockPayment[]>([]);
  const [teacherEarnings, setTeacherEarnings] = useState<TeacherEarning[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        courseResult,
        mockResult,
        teacherResult,
        expenseResult,
      ] = await Promise.all([
        supabase
          .from("payment_transactions")
          .select("id, amount, status, created_at")
          .eq("status", "success")
          .order("created_at", { ascending: false }),

        supabase
          .from("mock_series_payment_transactions")
          .select("id, amount, status, created_at")
          .eq("status", "success")
          .order("created_at", { ascending: false }),

        supabase
          .from("teacher_earnings")
          .select("id, teacher_earnings, platform_earnings, created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("business_expenses")
          .select(
            "id, category_name, description, amount, expense_date, status"
          )
          .order("expense_date", { ascending: false }),
      ]);

      if (courseResult.error) throw courseResult.error;
      if (mockResult.error) throw mockResult.error;
      if (teacherResult.error) throw teacherResult.error;
      if (expenseResult.error) throw expenseResult.error;

      setCoursePayments((courseResult.data ?? []) as CoursePayment[]);
      setMockPayments((mockResult.data ?? []) as MockPayment[]);
      setTeacherEarnings((teacherResult.data ?? []) as TeacherEarning[]);
      setExpenses((expenseResult.data ?? []) as BusinessExpense[]);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Profit & Loss loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load financial data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const range = useMemo(() => getRange(period), [period]);

  const report = useMemo(() => {
    const courses = coursePayments.filter((item) =>
      isInRange(item.created_at, range.start, range.end)
    );

    const mocks = mockPayments.filter((item) =>
      isInRange(item.created_at, range.start, range.end)
    );

    const earnings = teacherEarnings.filter((item) =>
      isInRange(item.created_at, range.start, range.end)
    );

    const selectedExpenses = expenses.filter((item) =>
      isInRange(item.expense_date, range.start, range.end)
    );

    const courseRevenue = courses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const mockRevenue = mocks.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const revenue = courseRevenue + mockRevenue;

    const teacherCost = earnings.reduce(
      (sum, item) => sum + Number(item.teacher_earnings || 0),
      0
    );

    const platformShare = earnings.reduce(
      (sum, item) => sum + Number(item.platform_earnings || 0),
      0
    );

    const paidExpenses = selectedExpenses.filter(
      (item) => item.status === "paid"
    );

    const pendingExpenses = selectedExpenses.filter(
      (item) => item.status === "pending"
    );

    const cancelledExpenses = selectedExpenses.filter(
      (item) => item.status === "cancelled"
    );

    const operatingExpenses = paidExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const pendingTotal = pendingExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const cancelledTotal = cancelledExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalCosts = teacherCost + operatingExpenses;
    const netProfit = revenue - totalCosts;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
      courseRevenue,
      mockRevenue,
      revenue,
      teacherCost,
      platformShare,
      paidExpenses,
      pendingExpenses,
      operatingExpenses,
      pendingTotal,
      cancelledTotal,
      totalCosts,
      netProfit,
      margin,
      selectedExpenses,
      courseCount: courses.length,
      mockCount: mocks.length,
    };
  }, [
    coursePayments,
    mockPayments,
    teacherEarnings,
    expenses,
    range,
  ]);

  const monthlyRows = useMemo<MonthRow[]>(() => {
    const rows: MonthRow[] = [];
    const now = new Date();

    // Display the most recent 6 months.
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      rows.push({
        key,
        label: date.toLocaleDateString("en-IN", { month: "short" }),
        revenue: 0,
        teacherCost: 0,
        operatingExpenses: 0,
        profit: 0,
      });
    }

    const byMonth = new Map(rows.map((row) => [row.key, row]));

    coursePayments.forEach((item) => {
      const key = item.created_at.slice(0, 7);
      const row = byMonth.get(key);
      if (row) row.revenue += Number(item.amount || 0);
    });

    mockPayments.forEach((item) => {
      const key = item.created_at.slice(0, 7);
      const row = byMonth.get(key);
      if (row) row.revenue += Number(item.amount || 0);
    });

    teacherEarnings.forEach((item) => {
      const key = item.created_at.slice(0, 7);
      const row = byMonth.get(key);
      if (row) row.teacherCost += Number(item.teacher_earnings || 0);
    });

    expenses.forEach((item) => {
      const key = item.expense_date.slice(0, 7);
      const row = byMonth.get(key);

      if (row && item.status === "paid") {
        row.operatingExpenses += Number(item.amount || 0);
      }
    });

    rows.forEach((row) => {
      row.profit =
        row.revenue - row.teacherCost - row.operatingExpenses;
    });

    return rows;
  }, [coursePayments, mockPayments, teacherEarnings, expenses]);

  const maxRevenue = Math.max(
    1,
    ...monthlyRows.map((item) => item.revenue)
  );

  function exportCsv() {
    const rows = [
      ["LearnPathshala Profit & Loss Report"],
      ["Period", periodLabel(period)],
      [],
      ["Metric", "Amount (INR)"],
      ["Course Revenue", report.courseRevenue],
      ["Mock Test Series Revenue", report.mockRevenue],
      ["Total Revenue", report.revenue],
      ["Teacher Earnings", report.teacherCost],
      ["Paid Operating Expenses", report.operatingExpenses],
      ["Total Costs", report.totalCosts],
      ["Net Profit / Loss", report.netProfit],
      ["Net Margin (%)", report.margin.toFixed(2)],
      ["Pending Bills (not included in net profit)", report.pendingTotal],
      [],
      ["Paid Expense Date", "Description", "Category", "Status", "Amount"],
      ...report.paidExpenses.map((item) => [
        item.expense_date,
        item.description,
        item.category_name,
        item.status,
        item.amount,
      ]),
      [],
      ["Pending Expense Date", "Description", "Category", "Status", "Amount"],
      ...report.pendingExpenses.map((item) => [
        item.expense_date,
        item.description,
        item.category_name,
        item.status,
        item.amount,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `learnpathshala-profit-loss-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell role="admin">
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">Admin / Finance</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Profit & Loss
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Understand LearnPathshala revenue, costs, and operating results.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Report period
            </div>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="last_3_months">Last 3 months</option>
              <option value="this_year">This year</option>
              <option value="all">All time</option>
            </select>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading financial report...
            </div>
          ) : !error ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Total revenue"
                  value={money(report.revenue)}
                  description={`${report.courseCount} course and ${report.mockCount} mock-series successful transactions`}
                  icon={<IndianRupee className="h-5 w-5" />}
                  iconClass="bg-blue-50 text-blue-700"
                />
                <StatCard
                  title="Teacher earnings"
                  value={money(report.teacherCost)}
                  description="Teacher share accrued during the selected period"
                  icon={<Wallet className="h-5 w-5" />}
                  iconClass="bg-violet-50 text-violet-700"
                />
                <StatCard
                  title="Paid operating expenses"
                  value={money(report.operatingExpenses)}
                  description={`${report.paidExpenses.length} paid expense records`}
                  icon={<ArrowDownRight className="h-5 w-5" />}
                  iconClass="bg-amber-50 text-amber-700"
                />
                <StatCard
                  title={report.netProfit >= 0 ? "Net operating profit" : "Net operating loss"}
                  value={money(report.netProfit)}
                  description={`Operating margin: ${report.margin.toFixed(1)}%`}
                  icon={
                    report.netProfit >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5" />
                    )
                  }
                  iconClass={
                    report.netProfit >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }
                />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-6">
                  <h2 className="font-bold text-slate-900">Profit & Loss statement</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Summary for {periodLabel(period).toLowerCase()}.
                  </p>
                </div>

                <div className="space-y-4">
                  <StatementRow label="Course sales revenue" amount={report.courseRevenue} />
                  <StatementRow label="Mock test series revenue" amount={report.mockRevenue} />
                  <div className="border-t border-slate-200 pt-4">
                    <StatementRow label="Total revenue" amount={report.revenue} strong />
                  </div>

                  <div className="pt-2">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Costs
                    </p>
                    <StatementRow label="Teacher earnings allocated" amount={report.teacherCost} negative />
                    <StatementRow label="Paid operating expenses" amount={report.operatingExpenses} negative />
                  </div>

                  <div className="border-t-2 border-slate-200 pt-4">
                    <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-base font-bold text-slate-900">
                          Net operating result
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Before taxes, unrecorded fees, refunds, and other untracked costs.
                        </p>
                      </div>
                      <p className={`text-2xl font-bold tabular-nums ${report.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {money(report.netProfit)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-6">
                  <h2 className="font-bold text-slate-900">Monthly performance</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Revenue and operating result for the last six months.
                  </p>
                </div>

                <div className="space-y-5">
                  {monthlyRows.map((row) => (
                    <div key={row.key}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">
                          {row.label} {row.key.slice(0, 4)}
                        </span>
                        <div className="text-right">
                          <span className="font-semibold text-slate-900">
                            {money(row.revenue)}
                          </span>
                          <span className={`ml-2 text-xs font-medium ${row.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {row.profit >= 0 ? "+" : ""}
                            {money(row.profit)}
                          </span>
                        </div>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{
                            width: `${Math.max(0, (row.revenue / maxRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                    Revenue
                  </span>
                  <span>
                    The amount beside each month shows the calculated profit or loss.
                  </span>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-900">Pending bills</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Not included in the current net operating result.
                      </p>
                    </div>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>

                  <p className="mt-4 text-2xl font-bold text-amber-700">
                    {money(report.pendingTotal)}
                  </p>

                  {report.pendingExpenses.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No pending bills in this period.
                    </p>
                  ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                      {report.pendingExpenses.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {item.description}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.category_name} · {dateText(item.expense_date)}
                            </p>
                          </div>
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                            {money(Number(item.amount))}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-slate-900">Expense breakdown</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Paid operating costs by category.
                      </p>
                    </div>
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>

                  {report.paidExpenses.length === 0 ? (
                    <p className="mt-5 text-sm text-slate-500">
                      No paid expenses in this period.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {Object.entries(
                        report.paidExpenses.reduce<Record<string, number>>(
                          (acc, item) => {
                            const category = item.category_name || "Uncategorized";
                            acc[category] =
                              (acc[category] || 0) + Number(item.amount || 0);
                            return acc;
                          },
                          {}
                        )
                      )
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, amount]) => {
                          const percent =
                            report.operatingExpenses > 0
                              ? (amount / report.operatingExpenses) * 100
                              : 0;

                          return (
                            <div key={category}>
                              <div className="mb-2 flex justify-between gap-3 text-sm">
                                <span className="text-slate-700">{category}</span>
                                <span className="font-semibold text-slate-900">
                                  {money(amount)}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-blue-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </section>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-900">Report notes</h2>
                </div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                  <li>Revenue uses successful course and mock-series payment transactions only.</li>
                  <li>Teacher cost uses teacher earnings recorded in the selected period; it is not a report of cash payouts.</li>
                  <li>Operating expenses include records marked paid. Pending and cancelled expenses are excluded.</li>
                  <li>Do not enter the same teacher-share amount again as a business expense. If you already have duplicate teacher expenses, correct those records before relying on the result.</li>
                  <li>This is a management estimate, not a tax-ready financial statement. Refunds, payment gateway charges, taxes, and other costs must be accounted for separately if applicable.</li>
                </ul>
                {lastUpdated && (
                  <p className="mt-4 text-xs text-slate-400">
                    Last refreshed: {lastUpdated.toLocaleString("en-IN")}
                  </p>
                )}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function StatementRow({
  label,
  amount,
  strong = false,
  negative = false,
}: {
  label: string;
  amount: number;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className={strong ? "font-bold text-slate-900" : "text-sm text-slate-600"}>
        {label}
      </span>
      <span
        className={`whitespace-nowrap tabular-nums ${
          strong
            ? "font-bold text-slate-900"
            : negative
              ? "text-sm font-medium text-red-700"
              : "text-sm font-medium text-slate-800"
        }`}
      >
        {negative ? "−" : ""}
        {money(amount)}
      </span>
    </div>
  );
}

function periodLabel(period: Period) {
  const labels: Record<Period, string> = {
    this_month: "This month",
    last_month: "Last month",
    last_3_months: "Last 3 months",
    this_year: "This year",
    all: "All time",
  };

  return labels[period];
}
