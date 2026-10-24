
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Share2,
  Users,
  Wallet,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";

type ReferralCode = {
  id: string;
  teacher_id: string;
  code: string;
  is_active: boolean;
};

type Attribution = {
  id: string;
  student_id: string;
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
  created_at: string;
};

type ReferralSettings = {
  enabled: boolean;
  attribution_days: number;
};

type TeacherReferralRates = {
  teacher_id: string;
  course_rate_percent: number | null;
  mock_test_rate_percent: number | null;
};

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

function statusClass(status: string) {
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
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

export default function TeacherReferralsPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [referralCode, setReferralCode] =
    useState<ReferralCode | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [clicks, setClicks] = useState<ReferralClick[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [teacherRates, setTeacherRates] = useState<TeacherReferralRates | null>(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);

  const referralUrl = referralCode
    ? `https://learnpathshala.com/ref/${encodeURIComponent(
        referralCode.code.toLowerCase(),
      )}`
    : "";

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "teacher")) {
      router.replace("/login");
    }
  }, [loading, user, profile, router]);

  const loadData = useCallback(async () => {
    if (!user || profile?.role !== "teacher") return;

    setPageLoading(true);
    setError("");
    setNotice("");

    try {
      const [
        codeResult,
        attributionResult,
        clickResult,
        commissionResult,
        settingsResult,
        teacherRatesResult,
      ] = await Promise.all([
        supabase
          .from("teacher_referral_codes")
          .select("id, teacher_id, code, is_active")
          .eq("teacher_id", user.id)
          .maybeSingle(),

        supabase
          .from("teacher_referral_attributions")
          .select(
            "id, student_id, referral_code, attributed_at, expires_at",
          )
          .eq("teacher_id", user.id)
          .order("attributed_at", { ascending: false }),

        supabase
          .from("teacher_referral_clicks")
          .select("id, teacher_id, referral_code, created_at")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("teacher_referral_commissions")
          .select(
            "id, student_id, product_type, transaction_id, product_id, gross_amount, commission_rate, commission_amount, status, available_at, paid_at, created_at",
          )
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("teacher_referral_settings")
          .select("enabled, attribution_days")
          .eq("id", 1)
          .maybeSingle(),

        supabase
          .from("teacher_referral_commission_settings")
          .select("teacher_id, course_rate_percent, mock_test_rate_percent")
          .eq("teacher_id", user.id)
          .maybeSingle(),
      ]);

      const queryErrors = [
        codeResult.error,
        attributionResult.error,
        clickResult.error,
        commissionResult.error,
        settingsResult.error,
        teacherRatesResult.error,
      ].filter(Boolean);

      if (queryErrors.length) {
        console.error("Referral dashboard query error:", queryErrors);
        throw new Error(
          "Could not load referral information. Check the referral tables' Supabase SELECT policies for teachers.",
        );
      }

      setReferralCode(codeResult.data as ReferralCode | null);
      setAttributions(
        (attributionResult.data || []) as Attribution[],
      );
      setClicks((clickResult.data || []) as ReferralClick[]);
      setCommissions(
        (commissionResult.data || []) as Commission[],
      );
      setSettings(settingsResult.data as ReferralSettings | null);
      setTeacherRates(teacherRatesResult.data as TeacherReferralRates | null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load referral dashboard.",
      );
    } finally {
      setPageLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && user && profile?.role === "teacher") {
      void loadData();
    }
  }, [loading, user, profile, loadData]);

  const copyReferralLink = async () => {
    if (!referralUrl) return;

    setCopying(true);
    setNotice("");

    try {
      await navigator.clipboard.writeText(referralUrl);
      setNotice("Referral link copied successfully.");
    } catch {
      setNotice(
        "Could not copy automatically. Select and copy the referral link manually.",
      );
    } finally {
      setCopying(false);
    }
  };

  const shareReferralLink = async () => {
    if (!referralUrl) return;

    const shareData = {
      title: "LearnPathshala",
      text: "Prepare for competitive exams with LearnPathshala courses and mock tests.",
      url: referralUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await copyReferralLink();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setNotice("Unable to open sharing. Please copy your referral link.");
    }
  };

  const totalCommission = commissions
    .filter((item) => item.status !== "reversed")
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const pendingCommission = commissions
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const availableCommission = commissions
    .filter((item) => item.status === "available")
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const paidCommission = commissions
    .filter((item) => item.status === "paid")
    .reduce((sum, item) => sum + Number(item.commission_amount || 0), 0);

  const referredCourses = commissions.filter(
    (item) =>
      item.product_type === "course" && item.status !== "reversed",
  ).length;

  const referredMockTests = commissions.filter(
    (item) =>
      item.product_type === "mock_test_series" &&
      item.status !== "reversed",
  ).length;

  const recentCommissions = commissions.slice(0, 10);

if (loading || pageLoading) {
  return (
    <DashboardShell role="teacher">
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" size={22} />
          <span>Loading referral dashboard...</span>
        </div>
      </div>
    </DashboardShell>
  );
}

  if (!user || profile?.role !== "teacher") {
    return null;
  }

  return (
    <DashboardShell role="teacher">
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Share2 size={17} />
              Teacher referral program
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Referral Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Share LearnPathshala and earn commissions on eligible purchases.
              Referral commissions are separate from your teaching earnings.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 shrink-0" size={19} />
            <div>
              <p className="font-semibold">Unable to load referrals</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"
          >
            <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
            <span>{notice}</span>
          </div>
        )}

        {!error && settings?.enabled === false && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            The referral program is currently disabled by the administrator.
          </div>
        )}

        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                <Link2 size={17} />
                Your personal referral link
              </div>

              {referralCode ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-mono text-lg font-bold tracking-wide text-blue-900">
                      {referralCode.code}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        referralCode.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {referralCode.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="mt-3 break-all text-sm text-slate-700">
                    {referralUrl}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Students must use your link and complete an eligible
                    purchase for a referral commission to be recorded.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  You do not have a referral code yet. Please contact the
                  LearnPathshala administrator to have one assigned.
                </p>
              )}
            </div>

            {referralCode?.is_active && (
              <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  onClick={() => void copyReferralLink()}
                  disabled={copying}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {copying ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <Copy size={17} />
                  )}
                  Copy referral link
                </button>

                <button
                  type="button"
                  onClick={() => void shareReferralLink()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                >
                  <ExternalLink size={17} />
                  Share link
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Referral clicks"
            value={clicks.length.toLocaleString("en-IN")}
            description="Recorded visits to your referral link"
            icon={ExternalLink}
          />

          <StatCard
            title="Referred students"
            value={attributions.length.toLocaleString("en-IN")}
            description="Students attributed to your code"
            icon={Users}
          />

          <StatCard
            title="Pending commission"
            value={money(pendingCommission)}
            description="Waiting for the release process"
            icon={Clock3}
          />

          <StatCard
            title="Available commission"
            value={money(availableCommission)}
            description="Marked available in the commission ledger"
            icon={Wallet}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total recorded commission"
            value={money(totalCommission)}
            description="Excludes reversed commissions"
            icon={Wallet}
          />

          <StatCard
            title="Paid commission"
            value={money(paidCommission)}
            description="Marked paid in the commission ledger"
            icon={CheckCircle2}
          />

          <StatCard
            title="Course purchases"
            value={referredCourses.toLocaleString("en-IN")}
            description="Purchases with a non-reversed commission"
            icon={BookOpen}
          />

          <StatCard
            title="Mock-test purchases"
            value={referredMockTests.toLocaleString("en-IN")}
            description="Purchases with a non-reversed commission"
            icon={ArrowUpRight}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Commission rates
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Rates configured by the administrator.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Course commission</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {teacherRates?.course_rate_percent != null
                  ? `${Number(teacherRates.course_rate_percent)}%`
                  : "Not configured"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Mock-test commission</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {teacherRates?.mock_test_rate_percent != null
                  ? `${Number(teacherRates.mock_test_rate_percent)}%`
                  : "Not configured"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Attribution window</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {settings ? `${settings.attribution_days} days` : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-bold text-slate-900">
              Recent referral commissions
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Commissions are generated from eligible successful payments.
            </p>
          </div>

          {recentCommissions.length === 0 ? (
            <div className="p-10 text-center">
              <Wallet className="mx-auto text-slate-300" size={36} />
              <p className="mt-3 font-semibold text-slate-800">
                No commissions yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Eligible referred purchases will appear here after payment
                processing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Purchase type</th>
                    <th className="px-5 py-3 font-semibold">Purchase amount</th>
                    <th className="px-5 py-3 font-semibold">Rate</th>
                    <th className="px-5 py-3 font-semibold">Commission</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 font-semibold">Available at</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentCommissions.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <span className="font-medium text-slate-900">
                          {item.product_type === "course"
                            ? "Course"
                            : "Mock-test series"}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.transaction_id.slice(0, 8)}…
                        </p>
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-700">
                        {money(Number(item.gross_amount))}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {Number(item.commission_rate)}%
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {money(Number(item.commission_amount))}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {dateTime(item.created_at)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {dateTime(item.available_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">
            Recent referral activity
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Recent visits recorded against your referral code.
          </p>

          {clicks.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No referral visits have been recorded yet.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {clicks.slice(0, 8).map((click) => (
                <div
                  key={click.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <Link2 size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Referral link visited
                      </p>
                      <p className="text-xs text-slate-500">
                        Code: {click.referral_code}
                      </p>
                    </div>
                  </div>

                  <span className="pl-11 text-xs text-slate-500 sm:pl-0">
                    {dateTime(click.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
