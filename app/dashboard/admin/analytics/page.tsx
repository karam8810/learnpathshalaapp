"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Brain,
  Users,
  GraduationCap,
  UserCheck,
  UserRound,
  IndianRupee,
  CreditCard,
  Video,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

type Period = "7days" | "30days" | "month" | "all";

type ProfileRow = {
  id: string;
  role: string;
  full_name?: string | null;
  email?: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  category?: string | null;
};

type SeriesRow = {
  id: string;
  title: string;
  price?: number | null;
};

type PaymentRow = {
  id: string;
  course_id?: string;
  series_id?: string;
  student_id: string;
  amount: number | string | null;
  status: string;
  created_at: string;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
  student_id: string;
  status: string;
  created_at: string;
};

type LiveClassRow = {
  id: string;
  status: string;
};

type SubmissionRow = {
  id: string;
  score: number;
  total_points: number;
};

const COLORS = {
  blue: "#2563eb",
  cyan: "#06b6d4",
  green: "#10b981",
  purple: "#8b5cf6",
  orange: "#f97316",
  pink: "#ec4899",
  slate: "#64748b",
  red: "#ef4444",
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

function getPeriodStart(period: Period, offset = 0): Date | null {
  const now = new Date();

  if (period === "all") return null;

  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth() - offset, 1);
  }

  const days = period === "7days" ? 7 : 30;
  return new Date(now.getTime() - days * (offset + 1) * 24 * 60 * 60 * 1000);
}

function getCurrentStart(period: Period): Date | null {
  if (period === "all") return null;
  if (period === "month") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const days = period === "7days" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function getPreviousStart(period: Period): Date | null {
  const currentStart = getCurrentStart(period);
  if (!currentStart) return null;

  if (period === "month") {
    return new Date(
      currentStart.getFullYear(),
      currentStart.getMonth() - 1,
      1
    );
  }

  const days = period === "7days" ? 7 : 30;
  return new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);
}

function formatPercentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? "New" : "0%";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function ChangeLabel({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const positive = change >= 0;
  const isNew = previous === 0 && current > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positive ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {positive ? (
        <TrendingUp className="h-3.5 w-3.5" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5" />
      )}
      {isNew ? "New" : formatPercentChange(current, previous)}
      <span className="font-normal text-slate-400">vs previous period</span>
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  iconClass = "bg-blue-50 text-blue-600",
  change,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  iconClass?: string;
  change?: { current: number; previous: number };
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {value}
            </p>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
            {icon}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{description}</p>
        {change && (
          <div className="mt-3">
            <ChangeLabel current={change.current} previous={change.previous} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminAnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [period, setPeriod] = useState<Period>("30days");
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [coursePayments, setCoursePayments] = useState<PaymentRow[]>([]);
  const [mockPayments, setMockPayments] = useState<PaymentRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClassRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    if (!authLoading && (!user || profile?.role !== "admin")) {
      router.replace("/login");
    }
  }, [authLoading, user, profile, router]);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const [
        profilesResult,
        coursesResult,
        seriesResult,
        coursePaymentsResult,
        mockPaymentsResult,
        enrollmentsResult,
        liveClassesResult,
        submissionsResult,
      ] = await Promise.all([
        supabase.from("profiles").select("id, role, full_name, email").limit(10000),
        supabase.from("courses").select("id, title, category").limit(10000),
        supabase.from("mock_test_series").select("id, title, price").limit(10000),
        supabase
          .from("payment_transactions")
          .select("id, course_id, student_id, amount, status, created_at")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("mock_series_payment_transactions")
          .select("id, series_id, student_id, amount, status, created_at")
          .eq("status", "success")
          .order("created_at", { ascending: false })
          .limit(10000),
        supabase
          .from("enrollments")
          .select("id, course_id, student_id, status, created_at")
          .limit(10000),
        supabase.from("live_classes").select("id, status").limit(10000),
        supabase.from("submissions").select("id, score, total_points").limit(10000),
      ]);

      const results = [
        profilesResult,
        coursesResult,
        seriesResult,
        coursePaymentsResult,
        mockPaymentsResult,
        enrollmentsResult,
        liveClassesResult,
        submissionsResult,
      ];

      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      setProfiles((profilesResult.data || []) as ProfileRow[]);
      setCourses((coursesResult.data || []) as CourseRow[]);
      setSeries((seriesResult.data || []) as SeriesRow[]);
      setCoursePayments((coursePaymentsResult.data || []) as PaymentRow[]);
      setMockPayments((mockPaymentsResult.data || []) as PaymentRow[]);
      setEnrollments((enrollmentsResult.data || []) as EnrollmentRow[]);
      setLiveClasses((liveClassesResult.data || []) as LiveClassRow[]);
      setSubmissions((submissionsResult.data || []) as SubmissionRow[]);
    } catch (err) {
      console.error("Admin analytics load failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load analytics. Please check database permissions and table names."
      );
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === "admin") {
      void fetchAll();
    }
  }, [profile, fetchAll]);

  const analytics = useMemo(() => {
    const now = new Date();
    const currentStart = getCurrentStart(period);
    const previousStart = getPreviousStart(period);

    const withinCurrent = (date: string) =>
      !currentStart || new Date(date).getTime() >= currentStart.getTime();

    const withinPrevious = (date: string) => {
      if (!currentStart || !previousStart) return false;
      const time = new Date(date).getTime();
      return time >= previousStart.getTime() && time < currentStart.getTime();
    };

    const currentCoursePayments = coursePayments.filter((p) => withinCurrent(p.created_at));
    const currentMockPayments = mockPayments.filter((p) => withinCurrent(p.created_at));
    const previousCoursePayments = coursePayments.filter((p) => withinPrevious(p.created_at));
    const previousMockPayments = mockPayments.filter((p) => withinPrevious(p.created_at));

    const sumAmount = (rows: PaymentRow[]) =>
      rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const totalStudents = profiles.filter((p) => p.role === "student").length;
    const totalTeachers = profiles.filter((p) => p.role === "teacher").length;

    const paidStudentIds = new Set<string>();
    [...coursePayments, ...mockPayments].forEach((payment) => {
      if (payment.student_id) paidStudentIds.add(payment.student_id);
    });

    const paidStudents = profiles.filter(
      (p) => p.role === "student" && paidStudentIds.has(p.id)
    ).length;
    const freeStudents = Math.max(totalStudents - paidStudents, 0);

    const courseRevenue = sumAmount(currentCoursePayments);
    const mockRevenue = sumAmount(currentMockPayments);
    const previousCourseRevenue = sumAmount(previousCoursePayments);
    const previousMockRevenue = sumAmount(previousMockPayments);

    const totalSales = courseRevenue + mockRevenue;
    const previousTotalSales = previousCourseRevenue + previousMockRevenue;

    const courseSalesById = new Map<string, { title: string; sales: number; revenue: number }>();
    currentCoursePayments.forEach((payment) => {
      const course = courses.find((c) => c.id === payment.course_id);
      const key = payment.course_id || "unknown";
      const existing = courseSalesById.get(key) || {
        title: course?.title || "Unknown course",
        sales: 0,
        revenue: 0,
      };
      existing.sales += 1;
      existing.revenue += Number(payment.amount || 0);
      courseSalesById.set(key, existing);
    });

    const mockSalesById = new Map<string, { title: string; sales: number; revenue: number }>();
    currentMockPayments.forEach((payment) => {
      const mockSeries = series.find((s) => s.id === payment.series_id);
      const key = payment.series_id || "unknown";
      const existing = mockSalesById.get(key) || {
        title: mockSeries?.title || "Unknown mock test series",
        sales: 0,
        revenue: 0,
      };
      existing.sales += 1;
      existing.revenue += Number(payment.amount || 0);
      mockSalesById.set(key, existing);
    });

    const categoryCounts = new Map<string, number>();
    courses.forEach((course) => {
      const category = course.category || "Uncategorized";
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    const roleData = [
      { name: "Students", value: totalStudents, fill: COLORS.blue },
      { name: "Teachers", value: totalTeachers, fill: COLORS.green },
      { name: "Admins", value: profiles.filter((p) => p.role === "admin").length, fill: COLORS.orange },
    ];

    const paidFreeData = [
      { name: "Paid students", value: paidStudents, fill: COLORS.green },
      { name: "Free / not yet purchased", value: freeStudents, fill: COLORS.slate },
    ];

    const revenueSplit = [
      { name: "Course sales", value: courseRevenue, fill: COLORS.blue },
      { name: "Mock test sales", value: mockRevenue, fill: COLORS.purple },
    ];

    const classStatusData = [
      { name: "Scheduled", value: liveClasses.filter((c) => c.status === "scheduled").length, fill: COLORS.cyan },
      { name: "Live", value: liveClasses.filter((c) => c.status === "live").length, fill: COLORS.red },
      { name: "Completed", value: liveClasses.filter((c) => c.status === "completed").length, fill: COLORS.slate },
      { name: "Cancelled", value: liveClasses.filter((c) => c.status === "cancelled").length, fill: COLORS.orange },
    ];

    const months: { key: string; month: string; courses: number; mocks: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: date.toLocaleDateString("en-IN", { month: "short" }),
        courses: 0,
        mocks: 0,
        total: 0,
      });
    }

    [...coursePayments, ...mockPayments].forEach((payment) => {
      const date = new Date(payment.created_at);
      const month = months.find((m) => m.key === `${date.getFullYear()}-${date.getMonth()}`);
      if (!month) return;
      const amount = Number(payment.amount || 0);
      if (payment.course_id) month.courses += amount;
      else month.mocks += amount;
      month.total += amount;
    });

    const avgScore = submissions.length
      ? Math.round(
          submissions.reduce(
            (sum, s) => sum + (Number(s.total_points) > 0 ? (Number(s.score) / Number(s.total_points)) * 100 : 0),
            0
          ) / submissions.length
        )
      : 0;

    return {
      totalStudents,
      totalTeachers,
      paidStudents,
      freeStudents,
      totalCourses: courses.length,
      totalMockSeries: series.length,
      totalEnrollments: enrollments.length,
      activeEnrollments: enrollments.filter((e) => e.status === "active").length,
      totalSubmissions: submissions.length,
      avgScore,
      totalLiveClasses: liveClasses.length,
      courseRevenue,
      mockRevenue,
      totalSales,
      previousCourseRevenue,
      previousMockRevenue,
      previousTotalSales,
      courseTransactionCount: currentCoursePayments.length,
      mockTransactionCount: currentMockPayments.length,
      previousCourseCount: previousCoursePayments.length,
      previousMockCount: previousMockPayments.length,
      previousStart,
      roleData,
      paidFreeData,
      revenueSplit,
      classStatusData,
      categoryData: Array.from(categoryCounts, ([name, value]) => ({ name, value })),
      monthlyData: months,
      topCourses: Array.from(courseSalesById.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
      topMockSeries: Array.from(mockSalesById.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5),
    };
  }, [period, profiles, courses, series, coursePayments, mockPayments, enrollments, liveClasses, submissions]);

  if (authLoading || (dataLoading && profile?.role === "admin")) {
    return (
      <DashboardShell role="admin">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
          <span className="ml-3 text-sm text-slate-500">Loading platform analytics...</span>
        </div>
      </DashboardShell>
    );
  }

  if (!user || profile?.role !== "admin") return null;

  return (
    <DashboardShell role="admin">
      <div className="space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">
              Students, teachers, paid users, course sales and mock-test growth.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
              aria-label="Analytics period"
            >
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="month">This month</option>
              <option value="all">All time</option>
            </select>
            <button
              onClick={() => void fetchAll()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Could not load all analytics</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Students"
            value={analytics.totalStudents.toLocaleString("en-IN")}
            description="Registered student accounts"
            icon={<GraduationCap className="h-5 w-5" />}
            iconClass="bg-blue-50 text-blue-600"
          />
          <MetricCard
            title="Teachers"
            value={analytics.totalTeachers.toLocaleString("en-IN")}
            description="Registered teacher accounts"
            icon={<Users className="h-5 w-5" />}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <MetricCard
            title="Paid Students"
            value={analytics.paidStudents.toLocaleString("en-IN")}
            description="Students with at least one successful course or mock-series payment"
            icon={<UserCheck className="h-5 w-5" />}
            iconClass="bg-violet-50 text-violet-600"
          />
          <MetricCard
            title="Free / Not Purchased"
            value={analytics.freeStudents.toLocaleString("en-IN")}
            description="Registered students with no successful payment recorded"
            icon={<UserRound className="h-5 w-5" />}
            iconClass="bg-slate-100 text-slate-600"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Total Sales"
            value={money(analytics.totalSales)}
            description={`${analytics.courseTransactionCount + analytics.mockTransactionCount} successful transactions in selected period`}
            icon={<IndianRupee className="h-5 w-5" />}
            iconClass="bg-blue-50 text-blue-600"
            change={period !== "all" ? { current: analytics.totalSales, previous: analytics.previousTotalSales } : undefined}
          />
          <MetricCard
            title="Course Sales"
            value={money(analytics.courseRevenue)}
            description={`${analytics.courseTransactionCount} successful course payments`}
            icon={<BookOpen className="h-5 w-5" />}
            iconClass="bg-cyan-50 text-cyan-600"
            change={period !== "all" ? { current: analytics.courseRevenue, previous: analytics.previousCourseRevenue } : undefined}
          />
          <MetricCard
            title="Mock Test Sales"
            value={money(analytics.mockRevenue)}
            description={`${analytics.mockTransactionCount} successful mock-series payments`}
            icon={<Brain className="h-5 w-5" />}
            iconClass="bg-violet-50 text-violet-600"
            change={period !== "all" ? { current: analytics.mockRevenue, previous: analytics.previousMockRevenue } : undefined}
          />
          <MetricCard
            title="Course Catalogue"
            value={`${analytics.totalCourses} courses`}
            description={`${analytics.totalMockSeries} mock-test series`}
            icon={<CreditCard className="h-5 w-5" />}
            iconClass="bg-orange-50 text-orange-600"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Monthly Sales Trend</CardTitle>
              <p className="text-sm text-slate-500">Successful course and mock-test payments over the last six months.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.monthlyData} margin={{ top: 10, right: 12, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => money(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="courses" name="Course sales" stroke={COLORS.blue} strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="mocks" name="Mock-test sales" stroke={COLORS.purple} strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="total" name="Total sales" stroke={COLORS.green} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {period === "all" && (
                <p className="mt-2 text-xs text-slate-400">The trend chart always displays the last six calendar months; the KPI cards use all-time totals.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Paid vs Free Students</CardTitle>
              <p className="text-sm text-slate-500">Based on successful payments recorded in the database.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.paidFreeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={48} label>
                      {analytics.paidFreeData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Paid conversion</p>
                  <p className="mt-1 text-xl font-bold text-emerald-800">
                    {analytics.totalStudents > 0 ? ((analytics.paidStudents / analytics.totalStudents) * 100).toFixed(1) : "0.0"}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">Not yet purchased</p>
                  <p className="mt-1 text-xl font-bold text-slate-800">
                    {analytics.totalStudents > 0 ? ((analytics.freeStudents / analytics.totalStudents) * 100).toFixed(1) : "0.0"}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">User Distribution</CardTitle>
              <p className="text-sm text-slate-500">Registered users by role.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label>
                      {analytics.roleData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Live Class Status</CardTitle>
              <p className="text-sm text-slate-500">Schedule and delivery overview.</p>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.classStatusData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Classes" radius={[8, 8, 0, 0]}>
                      {analytics.classStatusData.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Top-Selling Courses</CardTitle>
              <p className="text-sm text-slate-500">Ranked by successful payment revenue for the selected period.</p>
            </CardHeader>
            <CardContent>
              {analytics.topCourses.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No course sales found for this period.</p>
              ) : (
                <div className="space-y-4">
                  {analytics.topCourses.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-blue-700">#{index + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                            <p className="text-xs text-slate-500">{item.sales} successful sale{item.sales === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-900">{money(item.revenue)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, (item.revenue / Math.max(...analytics.topCourses.map((x) => x.revenue), 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Top-Selling Mock Test Series</CardTitle>
              <p className="text-sm text-slate-500">Ranked by successful mock-series payments.</p>
            </CardHeader>
            <CardContent>
              {analytics.topMockSeries.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No mock-test sales found for this period.</p>
              ) : (
                <div className="space-y-4">
                  {analytics.topMockSeries.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">#{index + 1}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{item.title}</p>
                            <p className="text-xs text-slate-500">{item.sales} successful sale{item.sales === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-slate-900">{money(item.revenue)}</p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(3, (item.revenue / Math.max(...analytics.topMockSeries.map((x) => x.revenue), 1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Course Enrollments"
            value={analytics.totalEnrollments.toLocaleString("en-IN")}
            description={`${analytics.activeEnrollments.toLocaleString("en-IN")} active enrollments`}
            icon={<BookOpen className="h-5 w-5" />}
            iconClass="bg-cyan-50 text-cyan-600"
          />
          <MetricCard
            title="Quiz Submissions"
            value={analytics.totalSubmissions.toLocaleString("en-IN")}
            description={`Average score: ${analytics.avgScore}%`}
            icon={<Brain className="h-5 w-5" />}
            iconClass="bg-pink-50 text-pink-600"
          />
          <MetricCard
            title="Live Classes"
            value={analytics.totalLiveClasses.toLocaleString("en-IN")}
            description="All recorded live classes"
            icon={<Video className="h-5 w-5" />}
            iconClass="bg-orange-50 text-orange-600"
          />
          <MetricCard
            title="Sales Conversion"
            value={`${analytics.totalStudents > 0 ? ((analytics.paidStudents / analytics.totalStudents) * 100).toFixed(1) : "0.0"}%`}
            description="Registered students with a successful purchase"
            icon={<BarChart3 className="h-5 w-5" />}
            iconClass="bg-emerald-50 text-emerald-600"
          />
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">How to interpret these numbers</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800">
            <li>“Paid students” means students with at least one successful course or mock-test-series payment; free students means no successful payment is recorded.</li>
            <li>Sales include successful payment transactions only. Refunds, payment gateway fees, and operating expenses are not deducted, so sales are not the same as net profit.</li>
            <li>Growth compares the selected period with the immediately preceding equivalent period. “All time” shows totals without a period-over-period comparison baseline.</li>
          </ul>
        </div>
      </div>
    </DashboardShell>
  );
}
