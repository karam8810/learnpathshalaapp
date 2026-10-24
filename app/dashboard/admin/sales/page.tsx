"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import {
  IndianRupee,
  TrendingUp,
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  CalendarDays,
  ChevronDown,
  Loader2,
  BarChart3,
  Trophy,
  UserRound,
} from "lucide-react";

import { supabase } from "@/lib/supabase/client";

type Period = "today" | "7days" | "30days" | "month" | "all";

type Course = {
  id: string;
  title: string;
  final_price: number | null;
  discount_price: number | null;
  discount_active: boolean | null;
};

type MockSeries = {
  id: string;
  title: string;
  price: number | null;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type CourseTransaction = {
  id: string;
  txnid: string;
  course_id: string;
  student_id: string;
  amount: number;
  status: string;
  created_at: string;
};

type MockTransaction = {
  id: string;
  txnid: string;
  series_id: string;
  student_id: string;
  amount: number;
  status: string;
  created_at: string;
};

type TeacherEarning = {
  id: string;
  teacher_id: string;
  course_id: string;
  student_id: string;
  course_price: number;
  teacher_share_percent: number;
  teacher_earnings: number;
  platform_earnings: number;
  created_at: string;
};

type TransactionRow = {
  id: string;
  txnid: string;
  type: "Course" | "Mock Test";
  title: string;
  student: string;
  amount: number;
  status: string;
  created_at: string;
};

function money(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getStartDate(period: Period) {
  const now = new Date();

  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  if (period === "7days") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (period === "30days") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return null;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminSalesPage() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("30days");
  const [loading, setLoading] = useState(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [mockSeries, setMockSeries] = useState<MockSeries[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [courseTransactions, setCourseTransactions] = useState<
    CourseTransaction[]
  >([]);
  const [mockTransactions, setMockTransactions] = useState<MockTransaction[]>(
    [],
  );
  const [teacherEarnings, setTeacherEarnings] = useState<TeacherEarning[]>([]);

  useEffect(() => {
    if (profile?.role === "admin") {
      void loadSales();
    } else if (profile) {
      setLoading(false);
    }
    // loadSales is intentionally called when the period or authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, profile?.id, profile?.role]);

  async function loadSales() {
    try {
      setLoading(true);

      const startDate = getStartDate(period);
      const startISO = startDate?.toISOString();

      let courseQuery = supabase
        .from("payment_transactions")
        .select("id, txnid, course_id, student_id, amount, status, created_at")
        .eq("status", "success")
        .order("created_at", { ascending: false });

      let mockQuery = supabase
        .from("mock_series_payment_transactions")
        .select("id, txnid, series_id, student_id, amount, status, created_at")
        .eq("status", "success")
        .order("created_at", { ascending: false });

      let earningQuery = supabase
        .from("teacher_earnings")
        .select(
          "id, teacher_id, course_id, student_id, course_price, teacher_share_percent, teacher_earnings, platform_earnings, created_at",
        )
        .order("created_at", { ascending: false });

      if (startISO) {
        courseQuery = courseQuery.gte("created_at", startISO);
        mockQuery = mockQuery.gte("created_at", startISO);
        earningQuery = earningQuery.gte("created_at", startISO);
      }

      const [
        coursesResult,
        seriesResult,
        profilesResult,
        coursePaymentsResult,
        mockPaymentsResult,
        earningsResult,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, final_price, discount_price, discount_active"),

        supabase.from("mock_test_series").select("id, title, price"),

        supabase.from("profiles").select("id, full_name, email, role"),

        courseQuery,

        mockQuery,

        earningQuery,
      ]);

      if (coursesResult.error) throw coursesResult.error;
      if (seriesResult.error) throw seriesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (coursePaymentsResult.error) throw coursePaymentsResult.error;
      if (mockPaymentsResult.error) throw mockPaymentsResult.error;
      if (earningsResult.error) throw earningsResult.error;

      setCourses(coursesResult.data || []);
      setMockSeries(seriesResult.data || []);
      setProfiles(profilesResult.data || []);
      setCourseTransactions(coursePaymentsResult.data || []);
      setMockTransactions(mockPaymentsResult.data || []);
      setTeacherEarnings(earningsResult.data || []);
    } catch (error) {
      console.error("Sales dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  const seriesMap = useMemo(
    () => new Map(mockSeries.map((series) => [series.id, series])),
    [mockSeries],
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const courseRevenue = useMemo(
    () =>
      courseTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0,
      ),
    [courseTransactions],
  );

  const mockRevenue = useMemo(
    () =>
      mockTransactions.reduce(
        (sum, transaction) => sum + Number(transaction.amount || 0),
        0,
      ),
    [mockTransactions],
  );

  const teacherPayout = useMemo(
    () =>
      teacherEarnings.reduce(
        (sum, earning) => sum + Number(earning.teacher_earnings || 0),
        0,
      ),
    [teacherEarnings],
  );

  const coursePlatformEarnings = useMemo(
    () =>
      teacherEarnings.reduce(
        (sum, earning) => sum + Number(earning.platform_earnings || 0),
        0,
      ),
    [teacherEarnings],
  );

  const totalSales = courseRevenue + mockRevenue;

  /*
   * Mock-test series currently has no teacher earning relationship
   * in the provided schema, so its successful revenue is treated
   * as platform revenue.
   */
  const platformEarnings = coursePlatformEarnings + mockRevenue;

  const totalTransactions = courseTransactions.length + mockTransactions.length;

  const averageOrderValue =
    totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const recentTransactions = useMemo<TransactionRow[]>(() => {
    const coursesRows: TransactionRow[] = courseTransactions.map((item) => ({
      id: item.id,
      txnid: item.txnid,
      type: "Course",
      title: courseMap.get(item.course_id)?.title || "Course",
      student: profileMap.get(item.student_id)?.full_name || "Student",
      amount: Number(item.amount || 0),
      status: item.status,
      created_at: item.created_at,
    }));

    const mockRows: TransactionRow[] = mockTransactions.map((item) => ({
      id: item.id,
      txnid: item.txnid,
      type: "Mock Test",
      title: seriesMap.get(item.series_id)?.title || "Mock Test Series",
      student: profileMap.get(item.student_id)?.full_name || "Student",
      amount: Number(item.amount || 0),
      status: item.status,
      created_at: item.created_at,
    }));

    return [...coursesRows, ...mockRows]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 10);
  }, [courseTransactions, mockTransactions, courseMap, seriesMap, profileMap]);

  const topCourses = useMemo(() => {
    const map = new Map<
      string,
      { title: string; sales: number; revenue: number }
    >();

    courseTransactions.forEach((transaction) => {
      const course = courseMap.get(transaction.course_id);

      if (!course) return;

      const current = map.get(course.id) || {
        title: course.title,
        sales: 0,
        revenue: 0,
      };

      current.sales += 1;
      current.revenue += Number(transaction.amount || 0);

      map.set(course.id, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [courseTransactions, courseMap]);

  const teacherStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        courses: Set<string>;
        earnings: number;
        platform: number;
      }
    >();

    teacherEarnings.forEach((earning) => {
      const teacher = profileMap.get(earning.teacher_id);

      const current = map.get(earning.teacher_id) || {
        name: teacher?.full_name || "Teacher",
        courses: new Set<string>(),
        earnings: 0,
        platform: 0,
      };

      current.courses.add(earning.course_id);
      current.earnings += Number(earning.teacher_earnings || 0);
      current.platform += Number(earning.platform_earnings || 0);

      map.set(earning.teacher_id, current);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        courseCount: item.courses.size,
      }))
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);
  }, [teacherEarnings, profileMap]);

  const monthlyData = useMemo(() => {
    const months: {
      key: string;
      label: string;
      course: number;
      mock: number;
      total: number;
    }[] = [];

    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);

      months.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleDateString("en-IN", {
          month: "short",
        }),
        course: 0,
        mock: 0,
        total: 0,
      });
    }

    courseTransactions.forEach((transaction) => {
      const date = new Date(transaction.created_at);

      const month = months.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`,
      );

      if (month) {
        month.course += Number(transaction.amount || 0);
        month.total += Number(transaction.amount || 0);
      }
    });

    mockTransactions.forEach((transaction) => {
      const date = new Date(transaction.created_at);

      const month = months.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`,
      );

      if (month) {
        month.mock += Number(transaction.amount || 0);
        month.total += Number(transaction.amount || 0);
      }
    });

    return months;
  }, [courseTransactions, mockTransactions]);

  const maxMonthValue = Math.max(...monthlyData.map((item) => item.total), 1);

  if (profile && profile.role !== "admin") {
    return (
      <DashboardShell role="admin">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          You do not have permission to view this page.
        </div>
      </DashboardShell>
    );
  }

  if (loading || !profile) {
    return (
      <DashboardShell role="admin">
        <div className="flex min-h-[60vh] items-center justify-center bg-[#f7f9fc] p-6">
          <div className="flex items-center gap-3 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading sales dashboard...
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin">
      <div className="min-h-screen w-full min-w-0 bg-[#f7f9fc] p-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Sales & Earnings
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Track LearnPathshala revenue, teacher payouts and platform
              earnings.
            </p>
          </div>

          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="appearance-none bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>

            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Main KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            title="Total Sales"
            value={money(totalSales)}
            subtitle={`${totalTransactions} successful transactions`}
            icon={<IndianRupee className="w-5 h-5" />}
            iconClass="bg-blue-500"
          />

          <StatCard
            title="Platform Earnings"
            value={money(platformEarnings)}
            subtitle="Before business expenses"
            icon={<TrendingUp className="w-5 h-5" />}
            iconClass="bg-emerald-500"
            positive
          />

          <StatCard
            title="Teacher Payouts"
            value={money(teacherPayout)}
            subtitle="Teacher earnings"
            icon={<Users className="w-5 h-5" />}
            iconClass="bg-violet-500"
          />

          <StatCard
            title="Average Order"
            value={money(averageOrderValue)}
            subtitle="Average successful payment"
            icon={<CreditCard className="w-5 h-5" />}
            iconClass="bg-orange-500"
          />
        </div>

        {/* Revenue Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-slate-900">Revenue Overview</h2>

                <p className="text-xs text-slate-500 mt-1">
                  Course sales and mock test sales
                </p>
              </div>

              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>

            <div className="h-64 flex items-end gap-3 sm:gap-5 border-b border-slate-100 pb-2">
              {monthlyData.map((item) => {
                const height =
                  item.total > 0
                    ? Math.max((item.total / maxMonthValue) * 210, 12)
                    : 6;

                return (
                  <div
                    key={item.key}
                    className="flex-1 h-full flex flex-col justify-end items-center"
                  >
                    <div className="text-[10px] text-slate-500 mb-2">
                      {item.total > 0 ? money(item.total) : "₹0"}
                    </div>

                    <div
                      className="w-full max-w-[55px] rounded-t-lg bg-blue-500 transition-all"
                      style={{ height }}
                      title={`${item.label}: ${money(item.total)}`}
                    />

                    <div className="text-xs text-slate-500 mt-3">
                      {item.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-5 mt-5 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                Course Sales
              </div>

              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500" />
                Mock Test Sales
              </div>
            </div>
          </div>

          {/* Revenue Split */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900">Revenue Breakdown</h2>

            <p className="text-xs text-slate-500 mt-1">
              Where your sales are coming from
            </p>

            <div className="mt-8 flex items-center justify-center">
              <div className="relative w-44 h-44 rounded-full bg-slate-100 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                    #2563eb 0deg ${
                      totalSales ? (courseRevenue / totalSales) * 360 : 0
                    }deg,
                    #8b5cf6 ${
                      totalSales ? (courseRevenue / totalSales) * 360 : 0
                    }deg 360deg
                  )`,
                  }}
                />

                <div className="absolute w-28 h-28 bg-white rounded-full flex flex-col items-center justify-center">
                  <span className="text-xs text-slate-500">Total</span>
                  <strong className="text-lg text-slate-900">
                    {money(totalSales)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="space-y-4 mt-8">
              <RevenueRow
                label="Courses"
                amount={courseRevenue}
                total={totalSales}
                dot="bg-blue-500"
              />

              <RevenueRow
                label="Mock Test Series"
                amount={mockRevenue}
                total={totalSales}
                dot="bg-violet-500"
              />
            </div>
          </div>
        </div>

        {/* Top Courses + Teachers */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
          {/* Top Courses */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-900">
                  Top Selling Courses
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Based on successful payments
                </p>
              </div>

              <Trophy className="w-5 h-5 text-yellow-500" />
            </div>

            {topCourses.length === 0 ? (
              <EmptyState text="No course sales yet." />
            ) : (
              <div className="space-y-4">
                {topCourses.map((course, index) => (
                  <div key={course.title} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600">
                      #{index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">
                        {course.title}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {course.sales} sale
                        {course.sales !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900">
                        {money(course.revenue)}
                      </p>

                      <p className="text-xs text-emerald-600 mt-1">Revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Teacher Earnings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-slate-900">Teacher Earnings</h2>

                <p className="text-xs text-slate-500 mt-1">
                  Teacher payout summary
                </p>
              </div>

              <UserRound className="w-5 h-5 text-violet-500" />
            </div>

            {teacherStats.length === 0 ? (
              <EmptyState text="No teacher earnings recorded." />
            ) : (
              <div className="space-y-4">
                {teacherStats.map((teacher) => (
                  <div key={teacher.name} className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
                      <UserRound className="w-5 h-5 text-violet-600" />
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-sm text-slate-900">
                        {teacher.name}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        {teacher.courseCount} course
                        {teacher.courseCount !== 1 ? "s" : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900">
                        {money(teacher.earnings)}
                      </p>

                      <p className="text-xs text-slate-500 mt-1">
                        Teacher payout
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Profit Summary */}
        <div className="mt-5 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-slate-300 text-sm">Platform Earnings</p>

              <h2 className="text-3xl font-bold mt-1">
                {money(platformEarnings)}
              </h2>

              <p className="text-slate-400 text-xs mt-2">
                Revenue remaining for LearnPathshala after recorded teacher
                payouts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-slate-400 text-xs">Total Sales</p>

                <p className="font-bold text-lg mt-1">{money(totalSales)}</p>
              </div>

              <div>
                <p className="text-slate-400 text-xs">Teacher Payout</p>

                <p className="font-bold text-lg mt-1">{money(teacherPayout)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-slate-200 mt-5 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">
                  Recent Transactions
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  Latest successful sales
                </p>
              </div>

              <Wallet className="w-5 h-5 text-blue-500" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Transaction
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Student
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Product
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Amount
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-slate-500"
                    >
                      No successful transactions found.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((transaction) => (
                    <tr
                      key={`${transaction.type}-${transaction.id}`}
                      className="border-t border-slate-100 hover:bg-slate-50 transition"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-sm text-slate-900">
                          {transaction.txnid}
                        </p>

                        <span
                          className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            transaction.type === "Course"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-violet-50 text-violet-600"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">
                          {transaction.student}
                        </p>
                      </td>

                      <td className="px-5 py-4 max-w-[280px]">
                        <p className="text-sm text-slate-700 truncate">
                          {transaction.title}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(transaction.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-sm text-slate-900">
                          {money(transaction.amount)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Success
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  iconClass,
  positive,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClass: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>

        <div
          className={`w-11 h-11 rounded-xl ${iconClass} text-white flex items-center justify-center shadow-sm`}
        >
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-4 text-xs text-slate-500">
        {positive ? (
          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5 text-slate-400" />
        )}

        {subtitle}
      </div>
    </div>
  );
}

function RevenueRow({
  label,
  amount,
  total,
  dot,
}: {
  label: string;
  amount: number;
  total: number;
  dot: string;
}) {
  const percentage = total > 0 ? (amount / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${dot}`} />

          <span className="text-sm text-slate-700">{label}</span>
        </div>

        <div className="text-right">
          <span className="font-semibold text-sm text-slate-900">
            {money(amount)}
          </span>

          <span className="text-xs text-slate-400 ml-2">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${dot}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-slate-500">{text}</div>;
}
