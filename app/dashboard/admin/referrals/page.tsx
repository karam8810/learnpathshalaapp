
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Users,
  Wallet,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type TeacherProfile = {
  id: string;
  full_name: string;
  email: string;
  role: string;
};

type ReferralCode = {
  id: string;
  teacher_id: string;
  code: string;
  is_active: boolean;
  created_at?: string;
};

type Attribution = {
  id: string;
  student_id: string;
  teacher_id: string;
  referral_code: string;
  attributed_at: string;
  expires_at: string;
};

type ReferralClick = {
  id: string;
  teacher_id: string;
  referral_code: string;
  created_at: string;
};

type Commission = {
  id: string;
  teacher_id: string;
  student_id: string;
  product_type: "course" | "mock_test_series";
  transaction_id: string;
  product_id: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: "pending" | "available" | "paid" | "reversed";
  available_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  created_at: string;
};

type IndividualRateDraft = {
  course_rate_percent: string;
  mock_test_rate_percent: string;
};

type IndividualRateRow = {
  teacher_id: string;
  course_rate_percent: number | null;
  mock_test_rate_percent: number | null;
  updated_at?: string;
};

type ReferralSettings = {
  id: number;
  enabled: boolean;
  course_rate_percent: number;
  mock_test_rate_percent: number;
  attribution_days: number;
};

type Tab = "overview" | "teachers" | "commissions" | "settings";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

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

const statusStyle = (status: string) => {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-700";
    case "paid":
      return "bg-blue-50 text-blue-700";
    case "reversed":
      return "bg-red-50 text-red-700";
    default:
      return "bg-amber-50 text-amber-800";
  }
};

function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 break-words text-2xl font-bold text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function AdminReferralsPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [commissionFilter, setCommissionFilter] = useState("all");

  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [clicks, setClicks] = useState<ReferralClick[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [teacherRates, setTeacherRates] = useState<Record<string, IndividualRateDraft>>({});
  const [savingTeacherRate, setSavingTeacherRate] = useState<string | null>(null);
  const [productTitles, setProductTitles] = useState<Record<string, string>>({});
  const [studentProfiles, setStudentProfiles] = useState<
    Record<string, { full_name: string; email: string }>
  >({});

  const [pageLoading, setPageLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [changingCode, setChangingCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "admin")) {
      router.replace("/login");
    }
  }, [loading, user, profile, router]);

  const loadData = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;

    setPageLoading(true);
    setError("");
    setNotice("");

    try {
      const [
        teachersResult,
        codesResult,
        attributionResult,
        clicksResult,
        commissionsResult,
        settingsResult,
        teacherRatesResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "teacher")
          .order("full_name"),

        supabase
          .from("teacher_referral_codes")
          .select("id, teacher_id, code, is_active, created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("teacher_referral_attributions")
          .select(
            "id, student_id, teacher_id, referral_code, attributed_at, expires_at",
          )
          .order("attributed_at", { ascending: false })
          .limit(1000),

        supabase
          .from("teacher_referral_clicks")
          .select("id, teacher_id, referral_code, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),

        supabase
          .from("teacher_referral_commissions")
          .select(
            "id, teacher_id, student_id, product_type, transaction_id, product_id, gross_amount, commission_rate, commission_amount, status, available_at, paid_at, payout_reference, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(1000),

        supabase
          .from("teacher_referral_settings")
          .select(
            "id, enabled, course_rate_percent, mock_test_rate_percent, attribution_days",
          )
          .eq("id", 1)
          .maybeSingle(),

        supabase
          .from("teacher_referral_commission_settings")
          .select("teacher_id, course_rate_percent, mock_test_rate_percent, updated_at"),
      ]);

      const queryErrors = [
        teachersResult.error,
        codesResult.error,
        attributionResult.error,
        clicksResult.error,
        commissionsResult.error,
        settingsResult.error,
        teacherRatesResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        console.error("Admin referral queries failed:", queryErrors);
        throw new Error(
          "Some referral data could not be loaded. Check the Supabase SELECT policies and table columns.",
        );
      }

      const commissionRows = (commissionsResult.data || []) as Commission[];

      setTeachers((teachersResult.data || []) as TeacherProfile[]);
      setCodes((codesResult.data || []) as ReferralCode[]);
      setAttributions((attributionResult.data || []) as Attribution[]);
      setClicks((clicksResult.data || []) as ReferralClick[]);
      setCommissions(commissionRows);
      setSettings(settingsResult.data as ReferralSettings | null);

   
const courseIds = Array.from(
  new Set(
    commissionRows
      .filter(
        (item) => item.product_type === "course" && item.product_id,
      )
      .map((item) => item.product_id as string),
  ),
);

const seriesIds = Array.from(
  new Set(
    commissionRows
      .filter(
        (item) =>
          item.product_type === "mock_test_series" && item.product_id,
      )
      .map((item) => item.product_id as string),
  ),
);

const studentIds = Array.from(
  new Set(
    commissionRows
      .map((item) => item.student_id)
      .filter(Boolean),
  ),
);


      const [coursesResult, seriesResult, studentsResult] = await Promise.all([
        courseIds.length
          ? supabase.from("courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [], error: null }),

        seriesIds.length
          ? supabase
              .from("mock_test_series")
              .select("id, title")
              .in("id", seriesIds)
          : Promise.resolve({ data: [], error: null }),

        studentIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email")
              .in("id", studentIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (coursesResult.error) throw coursesResult.error;
      if (seriesResult.error) throw seriesResult.error;
      if (studentsResult.error) throw studentsResult.error;

      const titles: Record<string, string> = {};

      for (const course of coursesResult.data || []) {
        titles[`course:${course.id}`] = course.title;
      }

      for (const series of seriesResult.data || []) {
        titles[`mock_test_series:${series.id}`] = series.title;
      }

      const studentMap: Record<string, { full_name: string; email: string }> = {};

      for (const student of studentsResult.data || []) {
        studentMap[student.id] = {
          full_name: student.full_name || "Unknown student",
          email: student.email || "",
        };
      }

      setProductTitles(titles);
      setStudentProfiles(studentMap);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load referral data.",
      );
    } finally {
      setPageLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && user && profile?.role === "admin") {
      void loadData();
    }
  }, [loading, user, profile, loadData]);

  const teacherMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );

  const codeMap = useMemo(
    () => new Map(codes.map((code) => [code.teacher_id, code])),
    [codes],
  );

  const clickCountByTeacher = useMemo(() => {
    const counts = new Map<string, number>();
    for (const click of clicks) {
      counts.set(
        click.teacher_id,
        (counts.get(click.teacher_id) || 0) + 1,
      );
    }
    return counts;
  }, [clicks]);

  const attributionCountByTeacher = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of attributions) {
      counts.set(
        item.teacher_id,
        (counts.get(item.teacher_id) || 0) + 1,
      );
    }
    return counts;
  }, [attributions]);

  const totals = useMemo(() => {
    const sum = (status: Commission["status"]) =>
      commissions
        .filter((item) => item.status === status)
        .reduce(
          (total, item) => total + Number(item.commission_amount || 0),
          0,
        );

    return {
      clicks: clicks.length,
      students: attributions.length,
      pending: sum("pending"),
      available: sum("available"),
      paid: sum("paid"),
      reversed: sum("reversed"),
      total: commissions
        .filter((item) => item.status !== "reversed")
        .reduce(
          (total, item) => total + Number(item.commission_amount || 0),
          0,
        ),
      course: commissions
        .filter(
          (item) =>
            item.product_type === "course" && item.status !== "reversed",
        )
        .reduce(
          (total, item) => total + Number(item.commission_amount || 0),
          0,
        ),
      mock: commissions
        .filter(
          (item) =>
            item.product_type === "mock_test_series" &&
            item.status !== "reversed",
        )
        .reduce(
          (total, item) => total + Number(item.commission_amount || 0),
          0,
        ),
    };
  }, [clicks, attributions, commissions]);

  const filteredTeachers = teachers.filter((teacher) => {
    const code = codeMap.get(teacher.id);
    const term = search.trim().toLowerCase();

    if (!term) return true;

    return (
      teacher.full_name?.toLowerCase().includes(term) ||
      teacher.email?.toLowerCase().includes(term) ||
      code?.code.toLowerCase().includes(term)
    );
  });

  const filteredCommissions = commissions.filter((item) => {
    const teacher = teacherMap.get(item.teacher_id);
    const term = search.trim().toLowerCase();

    const matchesSearch =
      !term ||
      teacher?.full_name?.toLowerCase().includes(term) ||
      teacher?.email?.toLowerCase().includes(term) ||
      item.transaction_id.toLowerCase().includes(term) ||
      item.student_id.toLowerCase().includes(term);

    const matchesStatus =
      commissionFilter === "all" || item.status === commissionFilter;

    return matchesSearch && matchesStatus;
  });

  const updateCodeStatus = async (code: ReferralCode) => {
    if (!user || profile?.role !== "admin") return;

    const confirmed = window.confirm(
      `${code.is_active ? "Deactivate" : "Activate"} referral code ${code.code}?`,
    );

    if (!confirmed) return;

    setChangingCode(code.id);
    setError("");
    setNotice("");

    try {
      const { error: updateError } = await supabase
        .from("teacher_referral_codes")
        .update({
          is_active: !code.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", code.id)
        .eq("teacher_id", code.teacher_id);

      if (updateError) throw updateError;

      setNotice(
        `Referral code ${code.code} ${
          code.is_active ? "deactivated" : "activated"
        }.`,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update referral code.",
      );
    } finally {
      setChangingCode(null);
    }
  };

  const updateTeacherRateDraft = (
    teacherId: string,
    field: keyof IndividualRateDraft,
    value: string,
  ) => {
    setTeacherRates((current) => ({
      ...current,
      [teacherId]: {
        course_rate_percent: current[teacherId]?.course_rate_percent ?? "",
        mock_test_rate_percent: current[teacherId]?.mock_test_rate_percent ?? "",
        [field]: value,
      },
    }));
  };

  const saveTeacherRates = async (teacher: TeacherProfile) => {
    if (!user || profile?.role !== "admin") return;

    const draft = teacherRates[teacher.id] ?? {
      course_rate_percent: "",
      mock_test_rate_percent: "",
    };

    const parseRate = (raw: string, label: string): number | null => {
      if (raw.trim() === "") return null;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new Error(`${label} for ${teacher.full_name} must be between 0 and 100, or left blank.`);
      }
      return value;
    };

    let courseRate: number | null;
    let mockRate: number | null;
    try {
      courseRate = parseRate(draft.course_rate_percent, "Course rate");
      mockRate = parseRate(draft.mock_test_rate_percent, "Mock-test rate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid teacher commission rate.");
      return;
    }

    setSavingTeacherRate(teacher.id);
    setError("");
    setNotice("");

    try {
      const { error: upsertError } = await supabase
        .from("teacher_referral_commission_settings")
        .upsert(
          {
            teacher_id: teacher.id,
            course_rate_percent: courseRate,
            mock_test_rate_percent: mockRate,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          { onConflict: "teacher_id" },
        );

      if (upsertError) throw upsertError;

      setNotice(
        `Individual referral rates saved for ${teacher.full_name}. Blank rates remain unconfigured; existing commissions are unchanged.`,
      );
      await loadData();
    } catch (err) {
      console.error("Unable to save teacher referral rates:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not save individual teacher referral rates. Verify the table's admin INSERT/UPDATE policies.",
      );
    } finally {
      setSavingTeacherRate(null);
    }
  };

  const saveSettings = async () => {
    if (!user || profile?.role !== "admin" || !settings) return;

    const courseRate = Number(settings.course_rate_percent);
    const mockRate = Number(settings.mock_test_rate_percent);
    const days = Number(settings.attribution_days);

    if (
      !Number.isFinite(courseRate) ||
      !Number.isFinite(mockRate) ||
      courseRate < 0 ||
      courseRate > 100 ||
      mockRate < 0 ||
      mockRate > 100 ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365
    ) {
      setError(
        "Use commission rates from 0 to 100 and an attribution window from 1 to 365 whole days.",
      );
      return;
    }

    setSavingSettings(true);
    setError("");
    setNotice("");

    try {
      const { data, error: updateError } = await supabase
        .from("teacher_referral_settings")
        .update({
          enabled: settings.enabled,
          course_rate_percent: courseRate,
          mock_test_rate_percent: mockRate,
          attribution_days: days,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("id", 1)
        .select(
          "id, enabled, course_rate_percent, mock_test_rate_percent, attribution_days",
        )
        .maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        throw new Error(
          "Settings were not updated. Verify the admin UPDATE policy and settings row with id = 1.",
        );
      }

      setSettings(data as ReferralSettings);
      setNotice(
        "Referral settings saved. Existing commission records keep their recorded rates.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading || pageLoading) {
    return (
      <DashboardShell role="admin">
        <div className="flex min-h-[50vh] items-center justify-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" size={22} />
          Loading referral management...
        </div>
      </DashboardShell>
    );
  }

  if (!user || profile?.role !== "admin") return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "teachers", label: "Teachers & links" },
    { id: "commissions", label: "Commission ledger" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <DashboardShell role="admin">
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <ShieldCheck size={17} />
              Admin control centre
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Referral Management
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Monitor referral activity, teacher codes, commissions and program
              settings. Referral commissions are separate from teaching earnings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh data
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === item.id
                  ? "bg-blue-700 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Referral clicks"
                value={totals.clicks.toLocaleString("en-IN")}
                detail="Recorded visits"
                icon={Activity}
              />
              <StatCard
                title="Referred students"
                value={totals.students.toLocaleString("en-IN")}
                detail="Recorded attributions"
                icon={Users}
              />
              <StatCard
                title="Pending commissions"
                value={money(totals.pending)}
                detail="Awaiting release"
                icon={Clock3}
              />
              <StatCard
                title="Available commissions"
                value={money(totals.available)}
                detail="Marked available"
                icon={Wallet}
              />
              <StatCard
                title="Total non-reversed"
                value={money(totals.total)}
                detail="Referral commission ledger"
                icon={Wallet}
              />
              <StatCard
                title="Paid commissions"
                value={money(totals.paid)}
                detail="Marked paid"
                icon={CheckCircle2}
              />
              <StatCard
                title="Course commissions"
                value={money(totals.course)}
                detail="Non-reversed course records"
                icon={BookOpen}
              />
              <StatCard
                title="Mock-test commissions"
                value={money(totals.mock)}
                detail="Non-reversed mock-test records"
                icon={Activity}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Referral program
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current global configuration
                </p>

                {settings ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Program status</span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          settings.enabled
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {settings.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Course rate</span>
                      <strong>{settings.course_rate_percent}%</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Mock-test rate</span>
                      <strong>{settings.mock_test_rate_percent}%</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">Attribution window</span>
                      <strong>{settings.attribution_days} days</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("settings")}
                      className="mt-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Manage settings
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-amber-700">
                    Referral settings row with id 1 was not found.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Recent commissions
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Latest referral commission records
                </p>

                <div className="mt-4 space-y-3">
                  {commissions.slice(0, 5).map((item) => {
                    const teacher = teacherMap.get(item.teacher_id);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {teacher?.full_name || "Unknown teacher"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.product_type === "course"
                              ? "Course"
                              : "Mock-test series"}{" "}
                            · {dateTime(item.created_at)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold text-slate-900">
                            {money(Number(item.commission_amount))}
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {commissions.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      No referral commissions found.
                    </p>
                  )}

                  {commissions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTab("commissions")}
                      className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                      Open full commission ledger →
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === "teachers" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Teacher referral codes & commission rates
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Manage referral links and set individual course and mock-test rates. Blank rates disable commissions for that product type.
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search teacher or code..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1350px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Teacher</th>
                    <th className="px-5 py-3 font-semibold">Referral code</th>
                    <th className="px-5 py-3 font-semibold">Clicks</th>
                    <th className="px-5 py-3 font-semibold">Students</th>
                    <th className="px-5 py-3 font-semibold">Commissions</th>
                    <th className="px-5 py-3 font-semibold">Course rate (%)</th>
                    <th className="px-5 py-3 font-semibold">Mock-test rate (%)</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredTeachers.map((teacher) => {
                    const code = codeMap.get(teacher.id);
                    const teacherCommissions = commissions
                      .filter((item) => item.teacher_id === teacher.id)
                      .reduce(
                        (sum, item) =>
                          sum +
                          (item.status === "reversed"
                            ? 0
                            : Number(item.commission_amount || 0)),
                        0,
                      );

                    return (
                      <tr key={teacher.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {teacher.full_name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {teacher.email}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {code ? (
                            <>
                              <p className="font-mono font-semibold">
                                {code.code}
                              </p>
                              <a
                                href={`https://learnpathshala.com/ref/${encodeURIComponent(
                                  code.code.toLowerCase(),
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                              >
                                Open link <ExternalLink size={12} />
                              </a>
                            </>
                          ) : (
                            <span className="text-amber-700">
                              No code assigned
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {clickCountByTeacher.get(teacher.id) || 0}
                        </td>
                        <td className="px-5 py-4">
                          {attributionCountByTeacher.get(teacher.id) || 0}
                        </td>
                        <td className="px-5 py-4 font-semibold">
                          {money(teacherCommissions)}
                        </td>
                        <td className="px-5 py-4">
                          <input
                            aria-label={`${teacher.full_name} course commission rate`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={teacherRates[teacher.id]?.course_rate_percent ?? ""}
                            onChange={(event) =>
                              updateTeacherRateDraft(
                                teacher.id,
                                "course_rate_percent",
                                event.target.value,
                              )
                            }
                            placeholder="Not configured"
                            className="w-32 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <input
                            aria-label={`${teacher.full_name} mock-test commission rate`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={teacherRates[teacher.id]?.mock_test_rate_percent ?? ""}
                            onChange={(event) =>
                              updateTeacherRateDraft(
                                teacher.id,
                                "mock_test_rate_percent",
                                event.target.value,
                              )
                            }
                            placeholder="Not configured"
                            className="w-32 rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              code?.is_active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {!code
                              ? "No code"
                              : code.is_active
                                ? "Active"
                                : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              type="button"
                              disabled={savingTeacherRate === teacher.id}
                              onClick={() => void saveTeacherRates(teacher)}
                              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingTeacherRate === teacher.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : null}
                              Save rates
                            </button>
                          {code && (
                            <button
                              type="button"
                              disabled={changingCode === code.id}
                              onClick={() => void updateCodeStatus(code)}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {changingCode === code.id ? (
                                <Loader2 className="animate-spin" size={14} />
                              ) : code.is_active ? (
                                <ToggleRight size={16} />
                              ) : (
                                <ToggleLeft size={16} />
                              )}
                              {code.is_active ? "Deactivate" : "Activate"}
                            </button>
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTeachers.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">
                No matching teachers found.
              </p>
            )}
          </section>
        )}

        {tab === "commissions" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Referral commission ledger
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Audit commission entries across every teacher.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search teacher or transaction..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 sm:w-64"
                  />
                </div>

                <select
                  value={commissionFilter}
                  onChange={(event) => setCommissionFilter(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="available">Available</option>
                  <option value="paid">Paid</option>
                  <option value="reversed">Reversed</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1450px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Teacher</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 font-semibold">Purchased product</th>
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Transaction ID</th>
                    <th className="px-5 py-3 font-semibold">Gross amount</th>
                    <th className="px-5 py-3 font-semibold">Rate</th>
                    <th className="px-5 py-3 font-semibold">Commission</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Available at</th>
                    <th className="px-5 py-3 font-semibold">Created at</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredCommissions.map((item) => {
                    const teacher = teacherMap.get(item.teacher_id);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {teacher?.full_name || "Unknown teacher"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {teacher?.email || item.teacher_id}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          {item.product_type === "course"
                            ? "Course"
                            : "Mock-test"}
                        </td>
                        <td className="px-5 py-4">
                          <p className="max-w-xs font-semibold text-slate-900">
                            {item.product_id
                              ? productTitles[
                                  `${item.product_type}:${item.product_id}`
                                ] || "Product title unavailable"
                              : "Product ID unavailable"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.product_type === "course"
                              ? "Course"
                              : "Mock-test series"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {studentProfiles[item.student_id]?.full_name ||
                              "Unknown student"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {studentProfiles[item.student_id]?.email ||
                              item.student_id}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs">
                          {item.transaction_id}
                        </td>
                        <td className="px-5 py-4">
                          {money(Number(item.gross_amount))}
                        </td>
                        <td className="px-5 py-4">
                          {Number(item.commission_rate)}%
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-900">
                          {money(Number(item.commission_amount))}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {dateTime(item.available_at)}
                        </td>
                        <td className="px-5 py-4">
                          {dateTime(item.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredCommissions.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">
                No commissions match these filters.
              </p>
            )}

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              Showing up to 1,000 commission records loaded from Supabase.
              This page does not manually mark commissions paid or alter payment records.
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
                <Settings2 size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Referral program settings
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Configure the global referral rates and attribution window.
                </p>
              </div>
            </div>

            {!settings ? (
              <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                Settings row with id 1 was not found. Create or verify the
                existing settings row before saving.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <span>
                    <span className="block font-semibold text-slate-900">
                      Enable referral program
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Controls whether new referrals are accepted by the referral flow.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        enabled: event.target.checked,
                      })
                    }
                    className="h-5 w-5 accent-blue-700"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">
                      Course commission (%)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={settings.course_rate_percent}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          course_rate_percent: Number(event.target.value),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">
                      Mock-test commission (%)
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={settings.mock_test_rate_percent}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          mock_test_rate_percent: Number(event.target.value),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-400"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Attribution window (days)
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={settings.attribution_days}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          attribution_days: Number(event.target.value),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-400"
                    />
                    <span className="mt-2 block text-xs text-slate-500">
                      Applies to new attribution records created by your referral flow.
                    </span>
                  </label>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  Existing commission records retain their recorded rate and
                  amount. Changing the global rate should affect future
                  commissions only. Disabling the program does not automatically
                  reverse existing commissions or payments.
                </div>

                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={savingSettings}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSettings && (
                    <Loader2 className="animate-spin" size={17} />
                  )}
                  Save referral settings
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}
