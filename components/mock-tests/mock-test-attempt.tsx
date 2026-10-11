"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  ListChecks,
  PlayCircle,
  Timer,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

type Question = {
  id: string;
  question_order: number;
  question_text: string;
  options: string[];
  explanation?: string | null;
  solution_video_path?: string | null;
  points?: number;
};

type Test = {
  id: string;
  title: string;
  exam_name?: string | null;
  category?: string | null;
  status: string;
  time_limit_minutes: number;
};

type TestResult = {
  score: number;
  total: number;
  percentage: number;
  attempt_number: number;
};

type Props = {
  params: { id: string };
  mode?: "mobile" | "dashboard";
};

export default function MockTestAttempt({
  params,
  mode = "mobile",
}: Props) {
  const isMobile = mode === "mobile";
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [solutionUrls, setSolutionUrls] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const answersRef = useRef<Record<string, number>>({});
  const submittingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "student")) {
      router.replace(
        `/login?next=${encodeURIComponent(
          isMobile
            ? `/app-home/mock-tests/${params.id}`
            : `/dashboard/student/mock-tests/${params.id}`
        )}`
      );
    }
  }, [loading, user, profile?.role, router, params.id, isMobile]);

  useEffect(() => {
    if (loading || !user || profile?.role !== "student") return;

    let cancelled = false;

    async function loadTest() {
      setDataLoading(true);

      try {
        const { data: testData, error: testError } = await supabase
          .from("mock_tests")
          .select("*")
          .eq("id", params.id)
          .maybeSingle();

        if (testError) throw testError;

        if (!testData || testData.status !== "published") {
          toast.error("Test not available");
          router.replace(
            isMobile
              ? "/app-home"
              : "/dashboard/student/mock-tests"
          );
          return;
        }

        const { data: questionData, error: questionError } =
          await supabase
            .from("mock_test_questions")
            .select(
              "id, question_order, question_text, options, explanation, solution_video_path, points"
            )
            .eq("test_id", params.id)
            .order("question_order");

        if (questionError) throw questionError;

        const questionList = (questionData ?? []) as Question[];

        const signedEntries = await Promise.all(
          questionList
            .filter((question) => question.solution_video_path)
            .map(async (question) => {
              const { data } = await supabase.storage
                .from("mock-solution-videos")
                .createSignedUrl(
                  question.solution_video_path!,
                  3600
                );

              return data?.signedUrl
                ? ([question.id, data.signedUrl] as const)
                : null;
            })
        );

        if (cancelled) return;

        setTest(testData as Test);
        setQuestions(questionList);
        setSolutionUrls(
          Object.fromEntries(
            signedEntries.filter(
              (
                entry
              ): entry is readonly [string, string] =>
                Boolean(entry)
            )
          )
        );
        setTimeLeft(
          Math.max(
            0,
            Number(testData.time_limit_minutes || 0) * 60
          )
        );
      } catch (error) {
        console.error("Failed to load mock test:", error);
        toast.error("Could not load this test. Please try again.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void loadTest();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, profile?.role, params.id, router, isMobile]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || result) return;

    submittingRef.current = true;
    setSubmitting(true);
    setConfirmSubmit(false);

    if (timerRef.current) clearTimeout(timerRef.current);

    const answersArray = Object.entries(answersRef.current).map(
      ([question_id, selected_answer]) => ({
        question_id,
        selected_answer,
      })
    );

    try {
      const { data, error } = await supabase.rpc(
        "submit_mock_test",
        {
          p_test_id: params.id,
          p_answers: answersArray,
        }
      );

      if (error) {
        toast.error(
          error.message?.includes("Attempt limit")
            ? "Attempt limit reached"
            : "Could not submit test."
        );
        submittingRef.current = false;
        return;
      }

      setResult(data as TestResult);
      toast.success("Test submitted!");
    } catch (error) {
      console.error("Failed to submit test:", error);
      toast.error("Could not submit test. Please try again.");
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [params.id, result]);

  useEffect(() => {
    if (
      timeLeft <= 0 ||
      result ||
      submitting ||
      questions.length === 0
    ) {
      return;
    }

    timerRef.current = setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        void handleSubmit();
      } else {
        setTimeLeft((previous) => previous - 1);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, result, submitting, questions.length, handleSubmit]);

  const exitUrl = isMobile
    ? "/app-home"
    : "/dashboard/student/mock-tests";

  const resultsUrl = "/dashboard/student/mock-tests/results";

  const page = (() => {
    if (loading || dataLoading) {
      return (
        <main className="flex min-h-dvh items-center justify-center bg-slate-50">
          <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-slate-600">
            Loading your test...
          </span>
        </main>
      );
    }

    if (!user || profile?.role !== "student") return null;

    if (result) {
      const passed = result.percentage >= 70;

      return (
        <main className="min-h-dvh bg-slate-50 px-4 py-6">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div
              className={`h-2 ${
                passed ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />

            <div className="p-5 text-center sm:p-8">
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                  passed ? "bg-emerald-100" : "bg-amber-100"
                }`}
              >
                <Award
                  className={`h-9 w-9 ${
                    passed ? "text-emerald-600" : "text-amber-600"
                  }`}
                />
              </div>

              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-blue-600">
                Test completed
              </p>
              <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
                {passed ? "Excellent work!" : "Keep practicing!"}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {test?.title} · Attempt {result.attempt_number}
              </p>

              <div className="mt-6 rounded-2xl bg-gradient-to-br from-blue-800 to-blue-500 p-6 text-white">
                <p className="text-sm text-blue-100">Your score</p>
                <p className="mt-1 text-5xl font-extrabold">
                  {result.percentage}%
                </p>
                <p className="mt-2 text-sm text-blue-100">
                  {result.score} out of {result.total} points
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                    {result.score}
                  </p>
                  <p className="text-xs text-emerald-700">
                    Correct points
                  </p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-4">
                  <XCircle className="mx-auto h-6 w-6 text-rose-600" />
                  <p className="mt-2 text-2xl font-extrabold text-rose-700">
                    {Math.max(0, result.total - result.score)}
                  </p>
                  <p className="text-xs text-rose-700">
                    Incorrect points
                  </p>
                </div>
              </div>

              {questions.some(
                (question) =>
                  question.explanation || solutionUrls[question.id]
              ) && (
                <section className="mt-7 space-y-3 text-left">
                  <h2 className="flex items-center gap-2 font-bold text-slate-900">
                    <PlayCircle className="h-5 w-5 text-blue-600" />
                    Solutions
                  </h2>

                  {questions
                    .filter(
                      (question) =>
                        question.explanation ||
                        solutionUrls[question.id]
                    )
                    .map((question) => (
                      <article
                        key={question.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <p className="text-sm font-bold text-slate-800">
                          Question {question.question_order}
                        </p>

                        {question.explanation && (
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {question.explanation}
                          </p>
                        )}

                        {solutionUrls[question.id] && (
                          <video
                            controls
                            preload="metadata"
                            playsInline
                            className="mt-3 w-full rounded-xl bg-black"
                            src={solutionUrls[question.id]}
                          />
                        )}
                      </article>
                    ))}
                </section>
              )}

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link
                  href={exitUrl}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                >
                  More tests
                </Link>
                <Link
                  href={resultsUrl}
                  className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white"
                >
                  View results
                </Link>
              </div>
            </div>
          </div>
        </main>
      );
    }

    if (questions.length === 0) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 text-center">
          <ClipboardCheck className="h-10 w-10 text-blue-600" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            No questions available
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This test has no questions yet.
          </p>
          <Link
            href={exitUrl}
            className="mt-5 rounded-xl border px-4 py-3 text-sm font-semibold"
          >
            Back to tests
          </Link>
        </main>
      );
    }

    const currentQuestion = questions[currentIdx];
    const answeredCount = Object.keys(answers).length;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeWarning = timeLeft < 60;
    const progress = ((currentIdx + 1) / questions.length) * 100;

    return (
      <main className="min-h-dvh bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 bg-gradient-to-br from-blue-900 to-blue-600 px-4 pb-4 pt-[max(12px,env(safe-area-inset-top))] text-white shadow-md">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={exitUrl}
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmSubmit(true);
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Exit
              </Link>

              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                  timeWarning
                    ? "bg-rose-500 text-white"
                    : "bg-white/15 text-white"
                }`}
                aria-live="polite"
              >
                <Clock3 className="h-4 w-4" />
                <span className="font-mono text-lg font-bold tabular-nums">
                  {minutes}:{seconds.toString().padStart(2, "0")}
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-blue-200">
              Mock test in progress
            </p>
            <h1 className="mt-1 break-words text-xl font-extrabold">
              {test?.title}
            </h1>
            <p className="mt-1 text-xs text-blue-100">
              {[test?.exam_name, test?.category]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-4 flex items-center justify-between text-xs text-blue-100">
              <span>
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span>
                {answeredCount} answered
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 pb-[calc(190px+env(safe-area-inset-bottom))]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setPaletteOpen((open) => !open)}
              aria-expanded={paletteOpen}
              className="flex min-h-10 w-full items-center justify-between gap-3 text-sm font-bold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-blue-600" />
                Question navigator
              </span>
              <span className="text-blue-700">
                {paletteOpen ? "Hide" : "Show"}
              </span>
            </button>

            {paletteOpen && (
              <>
                <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {questions.map((question, index) => {
                    const isAnswered =
                      answers[question.id] !== undefined;
                    const isCurrent = index === currentIdx;

                    return (
                      <button
                        key={question.id}
                        type="button"
                        onClick={() => {
                          setCurrentIdx(index);
                          setPaletteOpen(false);
                        }}
                        aria-label={`Go to question ${index + 1}`}
                        className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold ${
                          isCurrent
                            ? "bg-blue-700 text-white"
                            : isAnswered
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>🔵 Current</span>
                  <span>🟢 Answered</span>
                  <span>⚪ Unanswered</span>
                </div>
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-800">
                  Question {currentIdx + 1}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {currentQuestion.points ?? 1}{" "}
                  {(currentQuestion.points ?? 1) === 1
                    ? "point"
                    : "points"}
                </span>
              </div>
              <h2 className="whitespace-pre-wrap break-words text-base font-bold leading-7 sm:text-lg">
                {currentQuestion.question_text}
              </h2>
            </div>

            <div className="space-y-3 p-4">
              {(currentQuestion.options ?? []).map(
                (option, index) => {
                  const selected =
                    answers[currentQuestion.id] === index;

                  return (
                    <button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setAnswers((previous) => ({
                          ...previous,
                          [currentQuestion.id]: index,
                        }))
                      }
                      className={`flex min-h-14 w-full items-start gap-3 rounded-xl border-2 p-3 text-left ${
                        selected
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white active:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          selected
                            ? "bg-blue-700 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 break-words pt-1 text-sm leading-6">
                        {option}
                      </span>
                      {selected && (
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-blue-700" />
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <Timer className="mt-0.5 h-4 w-4 shrink-0" />
            Your answers are submitted when you confirm submission or the
            timer reaches zero.
          </p>
        </div>

        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>{answeredCount}/{questions.length} answered</span>
              <span>
                {questions.length - answeredCount} unanswered
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={currentIdx === 0 || submitting}
                onClick={() =>
                  setCurrentIdx((index) => Math.max(0, index - 1))
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    setCurrentIdx((index) =>
                      Math.min(questions.length - 1, index + 1)
                    )
                  }
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmSubmit(true)}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Submit test
                </button>
              )}
            </div>
          </div>
        </footer>

        {confirmSubmit && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="submit-title"
              className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h2
                id="submit-title"
                className="mt-4 text-xl font-extrabold text-slate-900"
              >
                Submit your test?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                You have answered {answeredCount} of {questions.length}
                {" "}questions. {questions.length - answeredCount}{" "}
                remain unanswered. You cannot change answers after
                submission.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmSubmit(false)}
                  className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
                >
                  Continue test
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {submitting && (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  )}
                  Submit now
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  })();

  if (isMobile) return page;

  return <DashboardShell role="student">{page}</DashboardShell>;
}