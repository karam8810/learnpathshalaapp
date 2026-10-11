'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Award,
  TrendingUp,
  Trophy,
  Clock,
  ChevronRight,
  ClipboardCheck,
  Target,
  Medal,
  RefreshCw,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type Attempt = {
  id: string;
  percentage: number | string | null;
  score: number | string | null;
  total_points: number | string | null;
  attempt_number: number | null;
  submitted_at: string | null;
  mock_tests?: {
    title?: string | null;
    exam_name?: string | null;
    category?: string | null;
  } | null;
};

type RankedStudent = {
  id: string;
  name: string;
  bestPercent: number;
  totalScore: number;
  attempts: number;
};

export default function StudentMockTestResultsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [rankings, setRankings] = useState<RankedStudent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'student')) {
      router.replace('/login');
    }
  }, [loading, user, profile?.role, router]);

  useEffect(() => {
    if (loading || !user || profile?.role !== 'student') return;

    const userId = user.id;
    let cancelled = false;

    async function fetchData() {
      setDataLoading(true);
      setLoadError(null);

      try {
        const { data: attemptData, error: attemptsError } = await supabase
          .from('mock_test_attempts')
          .select('*, mock_tests(title, exam_name, category)')
          .eq('student_id', userId)
          .order('submitted_at', { ascending: false });

        if (attemptsError) throw attemptsError;

        const { data: allAttempts, error: rankingsError } = await supabase
          .from('mock_test_attempts')
          .select(
            'student_id, percentage, score, total_points, profiles!mock_test_attempts_student_id_fkey(full_name)'
          )
          .order('percentage', { ascending: false });

        if (rankingsError) throw rankingsError;
        if (cancelled) return;

        const myAttempts = (attemptData ?? []) as Attempt[];
        setAttempts(myAttempts);

        // Ranking is based on each student's best percentage.
        const studentMap: Record<string, RankedStudent> = {};

        (allAttempts ?? []).forEach((attempt: any) => {
          const studentId = String(attempt.student_id);
          const percentage = Number(attempt.percentage) || 0;
          const score = Number(attempt.score) || 0;

          if (!studentMap[studentId]) {
            studentMap[studentId] = {
              id: studentId,
              name: attempt.profiles?.full_name || 'Student',
              bestPercent: percentage,
              totalScore: score,
              attempts: 1,
            };
          } else {
            studentMap[studentId].bestPercent = Math.max(
              studentMap[studentId].bestPercent,
              percentage
            );
            studentMap[studentId].totalScore += score;
            studentMap[studentId].attempts += 1;
          }
        });

        const ranked = Object.values(studentMap)
          .sort(
            (a, b) =>
              b.bestPercent - a.bestPercent || b.totalScore - a.totalScore
          )
          .slice(0, 20);

        setRankings(ranked);
      } catch (error) {
        console.error('Failed to load mock test results:', error);
        setLoadError('We could not load your results right now. Please try again.');
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, profile?.role]);

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || profile?.role !== 'student') return null;

  const myRank = rankings.findIndex((student) => student.id === user.id);
  const myBest = attempts.length
    ? Math.max(...attempts.map((attempt) => Number(attempt.percentage) || 0))
    : 0;
  const avgScore = attempts.length
    ? Math.round(
        attempts.reduce(
          (sum, attempt) => sum + (Number(attempt.percentage) || 0),
          0
        ) / attempts.length
      )
    : 0;

  const statCards = [
    {
      label: 'Tests Taken',
      value: attempts.length,
      icon: ClipboardCheck,
      iconStyle: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Best Score',
      value: `${myBest}%`,
      icon: Award,
      iconStyle: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Average Score',
      value: `${avgScore}%`,
      icon: TrendingUp,
      iconStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Your Rank',
      value: myRank >= 0 ? `#${myRank + 1}` : '—',
      icon: Trophy,
      iconStyle: 'bg-violet-50 text-violet-700',
    },
  ];

  return (
    <DashboardShell role="student">
      <div className="-mx-4 -mt-6 min-h-screen bg-slate-50 px-4 pb-8 pt-5 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Your learning journey
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Performance & Rankings
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Track your mock test progress, celebrate improvements, and see how
            you compare on the leaderboard.
          </p>
        </div>

        {loadError && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-rose-700">{loadError}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-rose-200 bg-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {/* Performance hero */}
        <section className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-600 p-5 text-white shadow-md sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-50">
                <Target className="h-3.5 w-3.5" />
                Your progress at a glance
              </div>
              <h2 className="mt-4 text-xl font-extrabold sm:text-2xl">
                Keep moving forward!
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-blue-100">
                Every practice test is a step closer to your goal. Review your
                scores and keep improving.
              </p>
            </div>
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
              <Trophy className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/student/mock-tests"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-800 transition hover:bg-blue-50"
            >
              Practice more tests
              <ChevronRight className="h-4 w-4" />
            </Link>
            <span className="text-xs text-blue-100">
              {attempts.length} test{attempts.length === 1 ? '' : 's'} completed
            </span>
          </div>
        </section>

        {/* Stats cards */}
        <section className="mb-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-slate-900">
              Your overview
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.label}
                  className="min-w-0 rounded-2xl border-slate-200 bg-white shadow-sm"
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-5 text-slate-500 sm:text-sm">
                          {stat.label}
                        </p>
                        <p className="mt-1 break-words text-2xl font-extrabold text-slate-900 sm:text-3xl">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Attempts and leaderboard */}
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 p-4 sm:p-5">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-5 w-5 text-blue-600" />
                Recent Attempts
              </CardTitle>
              <p className="text-xs text-slate-500">
                Your latest completed mock tests
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              {attempts.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                  <ClipboardCheck className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    No attempts yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Take a mock test to see your results here.
                  </p>
                  <Link
                    href="/dashboard/student/mock-tests"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700"
                  >
                    Browse mock tests <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {attempts.map((attempt) => {
                    const percentage = Number(attempt.percentage) || 0;
                    const passed = percentage >= 70;

                    return (
                      <div
                        key={attempt.id}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            passed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          <Award className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold leading-5 text-slate-900">
                            {attempt.mock_tests?.title || 'Mock Test'}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Attempt {attempt.attempt_number ?? '—'}
                            {attempt.submitted_at
                              ? ` · ${new Date(attempt.submitted_at).toLocaleDateString()}`
                              : ''}
                          </p>
                          {attempt.mock_tests?.exam_name && (
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {attempt.mock_tests.exam_name}
                            </p>
                          )}
                        </div>
                        <Badge
                          className={`shrink-0 border-0 ${
                            passed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {percentage}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 p-4 sm:p-5">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Trophy className="h-5 w-5 text-amber-500" />
                Leaderboard
              </CardTitle>
              <p className="text-xs text-slate-500">
                Top 20 students by best percentage
              </p>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              {rankings.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
                  <Trophy className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-800">
                    No rankings yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Be the first to complete a mock test!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rankings.map((student, index) => {
                    const isMe = student.id === user.id;
                    const medalStyle =
                      index === 0
                        ? 'bg-amber-100 text-amber-800'
                        : index === 1
                          ? 'bg-slate-200 text-slate-700'
                          : index === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-600';

                    return (
                      <div
                        key={student.id}
                        className={`flex min-w-0 items-center gap-3 rounded-2xl p-3 ${
                          isMe
                            ? 'border border-blue-200 bg-blue-50'
                            : 'border border-slate-100 bg-white'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${medalStyle}`}
                        >
                          {index < 3 ? (
                            <Medal className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-bold text-slate-900">
                            {student.name}
                            {isMe && (
                              <span className="ml-1 text-xs font-semibold text-blue-700">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {student.attempts} attempt
                            {student.attempts === 1 ? '' : 's'} ·{' '}
                            {student.totalScore} pts
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 ${
                            student.bestPercent >= 70
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {student.bestPercent}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
