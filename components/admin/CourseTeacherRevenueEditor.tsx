"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
  RefreshCw,
} from "lucide-react";

type Teacher = { id: string; full_name: string; email: string | null };
type ShareRow = {
  id?: string;
  teacher_id: string;
  contribution_percent: number;
  teacher?: Teacher;
};
type LectureStats = {
  teacher_id: string;
  teacher_name: string;
  lecture_count: number;
  total_minutes: number;
};

type Props = {
  courseId: string;
  courseTitle: string;
  teacherPoolPercent: number;
  revenueModel: "lecture" | "hour";
  coursePrice: number;
  onSaved?: () => void;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function CourseTeacherRevenueEditor({
  courseId,
  courseTitle,
  teacherPoolPercent,
  revenueModel,
  coursePrice,
  onSaved,
}: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [stats, setStats] = useState<Record<string, LectureStats>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Compare rounded values to avoid floating-point totals such as 99.999999.
  const totalPercent = useMemo(
    () => round2(shares.reduce((sum, row) => sum + (Number(row.contribution_percent) || 0), 0)),
    [shares]
  );
  const validTotal = shares.length > 0 && totalPercent === 100;
  const poolAmount = (Math.max(0, Number(coursePrice) || 0) * Math.max(0, Number(teacherPoolPercent) || 0)) / 100;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [teacherResult, shareResult, lectureResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "teacher")
          .order("full_name"),
        supabase
          .from("course_teacher_revenue_shares")
          .select("id, teacher_id, contribution_percent")
          .eq("course_id", courseId)
          .order("created_at"),
        supabase
          .from("course_lectures")
          .select("teacher_id, duration_minutes")
          .eq("course_id", courseId)
          .eq("status", "published")
          .eq("is_earning_eligible", true)
          .neq("lecture_type", "demo"),
      ]);

      if (teacherResult.error) throw teacherResult.error;
      if (shareResult.error) throw shareResult.error;
      if (lectureResult.error) throw lectureResult.error;

      const teacherList = (teacherResult.data || []) as Teacher[];
      setTeachers(teacherList);

      const teacherById = new Map(teacherList.map((teacher) => [teacher.id, teacher]));
      setShares(
        (shareResult.data || []).map((row: any) => ({
          id: row.id,
          teacher_id: row.teacher_id,
          contribution_percent: Number(row.contribution_percent),
          teacher: teacherById.get(row.teacher_id),
        }))
      );

      const statsMap: Record<string, LectureStats> = {};
      for (const lecture of lectureResult.data || []) {
        const teacherId = lecture.teacher_id as string | null;
        if (!teacherId) continue;
        if (!statsMap[teacherId]) {
          statsMap[teacherId] = {
            teacher_id: teacherId,
            teacher_name: teacherById.get(teacherId)?.full_name || "Teacher",
            lecture_count: 0,
            total_minutes: 0,
          };
        }
        statsMap[teacherId].lecture_count += 1;
        statsMap[teacherId].total_minutes += Number(lecture.duration_minutes || 0);
      }
      setStats(statsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load teacher revenue settings.");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const addTeacher = (teacherId: string) => {
    if (!teacherId || shares.some((row) => row.teacher_id === teacherId)) return;
    const teacher = teachers.find((item) => item.id === teacherId);
    setShares((current) => [
      ...current,
      { teacher_id: teacherId, contribution_percent: 0, teacher },
    ]);
    setNotice("");
    setError("");
  };

  const updatePercent = (teacherId: string, value: string) => {
    // Preserve an empty input while the user edits; convert only non-empty values.
    const parsed = value.trim() === "" ? 0 : Number(value);
    const safe = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0;
    setShares((current) =>
      current.map((row) =>
        row.teacher_id === teacherId
          ? { ...row, contribution_percent: round2(safe) }
          : row
      )
    );
    setNotice("");
    setError("");
  };

  const removeTeacher = (teacherId: string) => {
    setShares((current) => current.filter((row) => row.teacher_id !== teacherId));
    setNotice("");
    setError("");
  };

  const save = async () => {
    if (saving) return;
    setError("");
    setNotice("");

    if (shares.length === 0) {
      setError("Add at least one teacher before saving.");
      return;
    }
    if (!validTotal) {
      setError(`Teacher contribution percentages must total exactly 100%. Current total: ${totalPercent.toFixed(2)}%.`);
      return;
    }

    // Deliberately do not block saving just because a teacher has no eligible
    // lectures: these admin-configured percentages are the allocation source.
    // The payment allocation function must use this table for new purchases.
    setSaving(true);
    try {
      const payload = shares.map((row) => ({
        course_id: courseId,
        teacher_id: row.teacher_id,
        contribution_percent: round2(Number(row.contribution_percent)),
      }));

      // Upsert selected rows first so existing data is not deleted before writes succeed.
      const { error: upsertError } = await supabase
        .from("course_teacher_revenue_shares")
        .upsert(payload, { onConflict: "course_id,teacher_id" });
      if (upsertError) throw upsertError;

      // Remove rows for teachers no longer selected. Keep query syntax simple and
      // avoid .not(..., 'in', ...) edge cases by deleting each removed row by id.
      const selectedIds = new Set(shares.map((row) => row.teacher_id));
      const { data: existingRows, error: existingError } = await supabase
        .from("course_teacher_revenue_shares")
        .select("id, teacher_id")
        .eq("course_id", courseId);
      if (existingError) throw existingError;

      const rowsToDelete = (existingRows || []).filter((row) => !selectedIds.has(row.teacher_id));
      for (const row of rowsToDelete) {
        const { error: deleteError } = await supabase
          .from("course_teacher_revenue_shares")
          .delete()
          .eq("id", row.id)
          .eq("course_id", courseId);
        if (deleteError) throw deleteError;
      }

      const { data: validation, error: validationError } = await supabase.rpc(
        "validate_course_teacher_revenue_shares",
        { p_course_id: courseId }
      );
      if (validationError) throw validationError;

      setNotice("Teacher shares saved and validated successfully. Total contribution: 100%.");
      onSaved?.();
      await load();
    } catch (e) {
      console.error("Save teacher revenue shares failed:", e);
      setError(e instanceof Error ? e.message : "Unable to save teacher revenue settings.");
    } finally {
      setSaving(false);
    }
  };

  const selectedIds = new Set(shares.map((row) => row.teacher_id));
  const availableTeachers = teachers.filter((teacher) => !selectedIds.has(teacher.id));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 rounded-xl border p-5 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading teacher revenue settings…
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">Teacher revenue sharing</h2>
          <p className="mt-1 text-sm text-slate-500">{courseTitle}</p>
          <p className="mt-1 text-xs text-slate-500">
            Referral commissions are separate and are not changed by these settings.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Teacher pool</p>
          <p className="mt-1 text-xl font-semibold">{teacherPoolPercent}%</p>
          <p className="text-xs text-slate-500">{money(poolAmount)} per purchase at the entered price</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500">Revenue model</p>
          <p className="mt-1 text-xl font-semibold">
            {revenueModel === "lecture" ? "Lecture count" : "Teaching time"}
          </p>
          <p className="text-xs text-slate-500">
            Lecture stats are informational; configured percentages determine each teacher's pool share.
          </p>
        </div>
        <div className={`rounded-xl p-4 ${validTotal ? "bg-emerald-50" : "bg-amber-50"}`}>
          <p className="text-xs text-slate-600">Configured contribution</p>
          <p className="mt-1 text-xl font-semibold">{totalPercent.toFixed(2)}%</p>
          <p className="text-xs text-slate-600">
            {validTotal ? "Ready to save" : "Must equal exactly 100%"}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Add teacher"
          className="min-h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm"
          defaultValue=""
          onChange={(event) => {
            addTeacher(event.target.value);
            event.currentTarget.value = "";
          }}
        >
          <option value="">Add a teacher…</option>
          {availableTeachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.full_name} — {teacher.email || "No email"}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm text-slate-600">
          <Plus className="h-4 w-4" /> Assign multiple teachers
        </div>
      </div>

      {shares.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No teacher shares configured yet. Add teachers and assign contribution percentages.
        </div>
      ) : (
        <div className="space-y-3">
          {shares.map((row) => {
            const stat = stats[row.teacher_id];
            const amount = (poolAmount * row.contribution_percent) / 100;
            return (
              <div key={row.teacher_id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{row.teacher?.full_name || "Teacher"}</p>
                    <p className="text-xs text-slate-500">{row.teacher?.email || row.teacher_id}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {stat
                        ? `${stat.lecture_count} eligible lecture(s) · ${stat.total_minutes} minutes`
                        : "No eligible lectures found (percentage allocation can still be saved)"}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600">Pool share %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={row.contribution_percent}
                      onChange={(event) => updatePercent(row.teacher_id, event.target.value)}
                      className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right"
                    />
                  </label>
                  <div className="min-w-32 text-right">
                    <p className="text-xs text-slate-500">Estimated per sale</p>
                    <p className="font-semibold text-slate-900">{money(amount)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTeacher(row.teacher_id)}
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                    aria-label={`Remove ${row.teacher?.full_name || "teacher"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !validTotal}
          title={!validTotal ? `Set contribution total to 100% (currently ${totalPercent.toFixed(2)}%)` : "Save teacher shares"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save teacher shares"}
        </button>
      </div>

      <p className="text-xs leading-5 text-amber-700">
        This saves the admin configuration only. Ensure the course payment allocation function uses these configured percentages for new purchases. Existing paid earnings are not recalculated.
      </p>
    </section>
  );
}
