'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ClipboardCheck,
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Award,
  PlayCircle,
  ListChecks,
  Timer,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Question = {
  id: string;
  question_order: number;
  question_text: string;
  options: string[];
  explanation?: string | null;
  solution_video_path?: string | null;
  points?: number | null;
};

type Test = {
  id: string;
  title: string;
  exam_name?: string | null;
  category?: string | null;
  status: string;
  time_limit_minutes: number;
};

type ReviewedAnswer = {
  question_id: string;
  question_order: number;
  question_text: string;
  options: string[];
  selected_answer: number | null;
  correct_answer: number;
  is_correct: boolean;
  points: number;
  earned_points: number;
  explanation: string | null;
  solution_video_path: string | null;
};

type TestResult = {
  attempt_id: string;
  score: number;
  total: number;
  percentage: number;
  attempt_number: number;
  answers: ReviewedAnswer[];
};

export default function MockTestTakePage({
  params,
}: {
  params: { id: string };
}) {
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
  const [questionPaletteOpen, setQuestionPaletteOpen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef<Record<string, number>>({});
  const submittingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'student')) {
      router.replace('/login');
    }
  }, [loading, user, profile?.role, router]);

  useEffect(() => {
    if (profile?.role !== 'student' || !user) return;

    let cancelled = false;

    async function fetchTest() {
      setDataLoading(true);

      try {
        const { data: testData, error: testError } = await supabase
          .from('mock_tests')
          .select('*')
          .eq('id', params.id)
          .maybeSingle();

        if (testError) throw testError;

        if (!testData || testData.status !== 'published') {
          toast.error('Test not available');
          router.replace('/dashboard/student/mock-tests');
          return;
        }

        const { data: questionData, error: questionError } = await supabase
          .from('mock_test_questions')
          .select(
            'id, question_order, question_text, options, explanation, solution_video_path, points'
          )
          .eq('test_id', params.id)
          .order('question_order');

        if (questionError) throw questionError;

        const questionList = (questionData ?? []) as Question[];

        const signedSolutions = await Promise.all(
          questionList
            .filter((question) => question.solution_video_path)
            .map(async (question) => {
              const { data: signed, error: signedError } = await supabase.storage
                .from('mock-solution-videos')
                .createSignedUrl(question.solution_video_path as string, 3600);

              if (signedError) {
                console.warn(
                  `Could not sign solution video for question ${question.id}:`,
                  signedError.message
                );
              }

              return signed?.signedUrl
                ? ([question.id, signed.signedUrl] as const)
                : null;
            })
        );

        if (cancelled) return;

        setSolutionUrls(
          Object.fromEntries(
            signedSolutions.filter(
              (entry): entry is readonly [string, string] => Boolean(entry)
            )
          )
        );

        setTest(testData as Test);
        setQuestions(questionList);
        setTimeLeft(Math.max(0, Number(testData.time_limit_minutes || 0) * 60));
      } catch (error) {
        console.error('Failed to load mock test:', error);
        toast.error('Could not load this test. Please try again.');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void fetchTest();

    return () => {
      cancelled = true;
    };
  }, [profile?.role, user?.id, params.id, router]);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current || result) return;

    submittingRef.current = true;
    setSubmitting(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    const answersArray = Object.entries(answersRef.current).map(
      ([question_id, selected_answer]) => ({
        question_id,
        selected_answer,
      })
    );

    try {
      const { data, error } = await supabase.rpc('submit_mock_test', {
        p_test_id: params.id,
        p_answers: answersArray,
      });

      if (error) {
        toast.error(
          error.message.toLowerCase().includes('attempt limit')
            ? 'Attempt limit reached'
            : error.message.toLowerCase().includes('test unavailable')
              ? 'This test is not available for your account.'
              : 'Could not submit test. Please try again.'
        );
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }

      if (!data || typeof data !== 'object') {
        throw new Error('The submission response was empty or invalid.');
      }

      const raw = data as Record<string, unknown>;
      const score = Number(raw.score ?? 0);
      const total = Number(raw.total ?? raw.total_points ?? 0);
      const percentage = Number(raw.percentage ?? 0);
      const review = Array.isArray(raw.answers)
        ? (raw.answers as ReviewedAnswer[])
        : [];

      if (
        !Number.isFinite(score) ||
        !Number.isFinite(total) ||
        !Number.isFinite(percentage)
      ) {
        throw new Error('The server returned an invalid score.');
      }

      setResult({
        attempt_id: String(raw.attempt_id ?? ''),
        score,
        total,
        percentage,
        attempt_number: Number(raw.attempt_number ?? 1),
        answers: review,
      });

      toast.success('Test submitted!');
    } catch (error) {
      console.error('Failed to submit mock test:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not submit test. Please try again.'
      );
      submittingRef.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [params.id, result]);

  useEffect(() => {
    if (timeLeft <= 0 || result || submitting || questions.length === 0) return;

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

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || profile?.role !== 'student') return null;

  if (result) {
    const passed = result.percentage >= 70;
    const correctCount = result.answers.filter(
      (answer) => answer.selected_answer !== null && answer.is_correct
    ).length;
    const wrongCount = result.answers.filter(
      (answer) => answer.selected_answer !== null && !answer.is_correct
    ).length;
    const unansweredCount = result.answers.filter(
      (answer) => answer.selected_answer === null
    ).length;

    return (
      <DashboardShell role="student">
        <div className="mx-auto max-w-3xl space-y-5">
          <Card className="overflow-hidden border-slate-200 shadow-lg">
            <div
              className={`h-2 ${
                passed
                  ? 'bg-gradient-to-r from-emerald-400 to-green-600'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500'
              }`}
            />

            <CardContent className="p-5 text-center sm:p-8">
              <div
                className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl sm:h-20 sm:w-20 ${
                  passed ? 'bg-emerald-100' : 'bg-amber-100'
                }`}
              >
                <Award
                  className={`h-9 w-9 sm:h-10 sm:w-10 ${
                    passed ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                />
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                Test completed
              </p>

              <h1 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {passed ? 'Excellent work!' : 'Keep practicing!'}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                {test?.title} · Attempt {result.attempt_number}
              </p>

              <div className="mt-6 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 p-6 text-white">
                <p className="text-sm text-blue-100">Your score</p>
                <div className="mt-1 text-5xl font-extrabold">
                  {result.percentage.toFixed(0)}%
                </div>
                <p className="mt-2 text-sm text-blue-100">
                  {result.score} out of {result.total} points
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, result.percentage))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" />
                  <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                    {correctCount}
                  </p>
                  <p className="text-xs text-emerald-700">Correct answers</p>
                </div>

                <div className="rounded-2xl bg-rose-50 p-4">
                  <XCircle className="mx-auto h-6 w-6 text-rose-600" />
                  <p className="mt-2 text-2xl font-extrabold text-rose-700">
                    {wrongCount}
                  </p>
                  <p className="text-xs text-rose-700">Wrong answers</p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <Clock className="mx-auto h-6 w-6 text-slate-600" />
                  <p className="mt-2 text-2xl font-extrabold text-slate-700">
                    {unansweredCount}
                  </p>
                  <p className="text-xs text-slate-600">Unanswered</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Answer review & solutions
              </h2>
            </div>

            {result.answers.length === 0 ? (
              <Card>
                <CardContent className="p-5 text-sm text-slate-600">
                  Your score was saved, but the server did not return the
                  question-by-question review. Confirm that the updated
                  submit_mock_test SQL function was saved successfully.
                </CardContent>
              </Card>
            ) : (
              result.answers.map((answer) => {
                const selected = answer.selected_answer;
                const correct = Number(answer.correct_answer);
                const selectedIsCorrect =
                  selected !== null && selected === correct;
                const videoUrl = solutionUrls[answer.question_id];

                return (
                  <Card
                    key={answer.question_id}
                    className="overflow-hidden border-slate-200 shadow-sm"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-900">
                          Question {answer.question_order}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            selected === null
                              ? 'bg-slate-100 text-slate-600'
                              : selectedIsCorrect
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {selected === null
                            ? 'Not attempted'
                            : selectedIsCorrect
                              ? 'Correct'
                              : 'Wrong'}
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                        {answer.question_text}
                      </p>

                      <div className="mt-4 space-y-2">
                        {Array.isArray(answer.options) &&
                          answer.options.map((option, index) => {
                            const isCorrectOption = index === correct;
                            const isSelectedOption = selected === index;

                            return (
                              <div
                                key={`${answer.question_id}-${index}`}
                                className={`flex items-start gap-3 rounded-xl border p-3 ${
                                  isCorrectOption
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : isSelectedOption
                                      ? 'border-rose-300 bg-rose-50'
                                      : 'border-slate-200 bg-white'
                                }`}
                              >
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                    isCorrectOption
                                      ? 'bg-emerald-600 text-white'
                                      : isSelectedOption
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {String.fromCharCode(65 + index)}
                                </span>

                                <span className="min-w-0 flex-1 pt-1 text-sm leading-6 text-slate-800">
                                  {option}
                                </span>

                                <span className="shrink-0 pt-1 text-xs font-semibold">
                                  {isCorrectOption ? (
                                    <span className="text-emerald-700">
                                      Correct answer
                                    </span>
                                  ) : isSelectedOption ? (
                                    <span className="text-rose-700">
                                      Your answer
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                            );
                          })}

                        {selected === null && (
                          <p className="text-sm text-slate-500">
                            You did not answer this question.
                          </p>
                        )}
                      </div>

                      <p className="mt-3 text-xs text-slate-500">
                        Points earned: {Number(answer.earned_points ?? 0)} /{' '}
                        {Number(answer.points ?? 1)}
                      </p>

                      {answer.explanation && (
                        <div className="mt-4 rounded-xl bg-blue-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                            Explanation
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {answer.explanation}
                          </p>
                        </div>
                      )}

                      {videoUrl && (
                        <div className="mt-4 overflow-hidden rounded-xl bg-slate-950">
                          <video
                            controls
                            preload="metadata"
                            className="w-full"
                            src={videoUrl}
                          >
                            <track kind="captions" />
                          </video>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300">
                            <PlayCircle className="h-4 w-4" />
                            Video solution
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/dashboard/student/mock-tests">
              <Button variant="outline" className="w-full">
                More Tests
              </Button>
            </Link>
            <Link href="/dashboard/student/mock-tests/results">
              <Button className="w-full bg-blue-600 text-white hover:bg-blue-700">
                View Results
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (questions.length === 0) {
    return (
      <DashboardShell role="student">
        <div className="mx-auto max-w-xl py-12 text-center sm:py-16">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <ClipboardCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            No questions available
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            This test has no questions yet.
          </p>
          <Link
            href="/dashboard/student/mock-tests"
            className="mt-5 inline-block"
          >
            <Button variant="outline">Back to Tests</Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const currentQuestion = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeWarning = timeLeft < 60;
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <DashboardShell role="student">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 rounded-2xl bg-gradient-to-br from-blue-800 to-blue-600 p-4 text-white shadow-md sm:p-6">
          <Link
            href="/dashboard/student/mock-tests"
            className="mb-4 inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit test
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Mock test in progress
              </p>
              <h1 className="mt-1 break-words text-xl font-extrabold leading-tight sm:text-2xl">
                {test?.title}
              </h1>
              <p className="mt-2 text-xs text-blue-100 sm:text-sm">
                {[test?.exam_name, test?.category].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 ${
                timeWarning ? 'bg-rose-500 text-white' : 'bg-white/15 text-white'
              }`}
              aria-live="polite"
            >
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-mono text-base font-bold tabular-nums sm:text-lg">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">QUESTION</p>
              <p className="mt-1 font-bold text-slate-900">
                {currentIdx + 1}
                <span className="font-medium text-slate-400">
                  {' '}
                  / {questions.length}
                </span>
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-500">Answered</p>
              <p className="mt-1 font-bold text-blue-700">
                {answeredCount} of {questions.length}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setQuestionPaletteOpen((open) => !open)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              aria-expanded={questionPaletteOpen}
            >
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Questions</span>
            </button>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {questionPaletteOpen && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">
                JUMP TO QUESTION
              </p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
                {questions.map((question, index) => {
                  const isAnswered = answers[question.id] !== undefined;
                  const isCurrent = index === currentIdx;

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => {
                        setCurrentIdx(index);
                        setQuestionPaletteOpen(false);
                      }}
                      aria-label={`Go to question ${index + 1}`}
                      className={`flex h-10 items-center justify-center rounded-xl text-sm font-bold transition ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isAnswered
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                  Current
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-200" />
                  Answered
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                  Not answered
                </span>
              </div>
            </div>
          )}
        </div>

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/80 p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700">
                Question {currentIdx + 1}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {currentQuestion.points ?? 1}{' '}
                {(currentQuestion.points ?? 1) === 1 ? 'point' : 'points'}
              </span>
            </div>
            <CardTitle className="break-words text-base leading-7 text-slate-900 sm:text-xl sm:leading-8">
              {currentQuestion.question_text}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 p-4 sm:p-6">
            {(currentQuestion.options ?? []).map((option, index) => {
              const isSelected = answers[currentQuestion.id] === index;
              const optionLabel = String.fromCharCode(65 + index);

              return (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  type="button"
                  onClick={() =>
                    setAnswers((previous) => ({
                      ...previous,
                      [currentQuestion.id]: index,
                    }))
                  }
                  aria-pressed={isSelected}
                  className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition sm:items-center sm:p-4 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      optionLabel
                    )}
                  </span>
                  <span
                    className={`min-w-0 flex-1 break-words pt-1 text-sm leading-6 sm:pt-0 sm:text-base ${
                      isSelected
                        ? 'font-semibold text-slate-900'
                        : 'text-slate-700'
                    }`}
                  >
                    {option}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCurrentIdx((index) => Math.max(0, index - 1))}
            disabled={currentIdx === 0 || submitting}
            className="h-12 rounded-xl"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentIdx === questions.length - 1 ? (
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Submit test
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() =>
                setCurrentIdx((index) =>
                  Math.min(questions.length - 1, index + 1)
                )
              }
              disabled={submitting}
              className="h-12 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          <Timer className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Your answers are submitted when you select Submit test or when the
            timer reaches zero. Review your selections before submitting.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Question navigator
            </h2>
            <span className="text-xs text-slate-500">
              {answeredCount}/{questions.length} answered
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const isAnswered = answers[question.id] !== undefined;
              const isCurrent = index === currentIdx;

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIdx(index)}
                  aria-label={`Go to question ${index + 1}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold transition ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-200'
                      : isAnswered
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
