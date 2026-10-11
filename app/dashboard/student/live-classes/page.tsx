'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Video,
  Calendar,
  Clock,
  Link2,
  BookOpen,
  Radio,
  CalendarDays,
  RefreshCw,
  PlayCircle,
  Search,
  GraduationCap,
  Users,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

type LiveClass = {
  id: string;
  title: string;
  description?: string | null;
  start_time: string;
  duration_minutes?: number | null;
  status: string;
  meeting_link?: string | null;
  courses?: { title?: string | null } | null;
  profiles?: { full_name?: string | null } | null;
};

const statusStyles: Record<string, string> = {
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  live: 'border-rose-200 bg-rose-50 text-rose-700',
  completed: 'border-slate-200 bg-slate-100 text-slate-600',
  cancelled: 'border-amber-200 bg-amber-50 text-amber-700',
};

export default function StudentLiveClassesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'student')) {
      router.replace('/login');
    }
  }, [loading, user, profile?.role, router]);

  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setLoadError('');

    try {
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id);

      if (enrollmentError) throw enrollmentError;

      const courseIds = (enrollments ?? []).map((enrollment) => enrollment.course_id);

      if (courseIds.length === 0) {
        setClasses([]);
        return;
      }

      const { data, error } = await supabase
        .from('live_classes')
        .select('*, courses(title), profiles!live_classes_teacher_id_fkey(full_name)')
        .in('course_id', courseIds)
        .order('start_time', { ascending: true });

      if (error) throw error;

      setClasses((data ?? []) as LiveClass[]);
    } catch (error) {
      console.error('Failed to load live classes:', error);
      setLoadError('We could not load your classes. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!loading && user && profile?.role === 'student') {
      void fetchData();
    }
  }, [loading, user, profile?.role, fetchData]);

  const now = Date.now();

  const upcoming = useMemo(
    () => classes.filter((item) => new Date(item.start_time).getTime() >= now || item.status === 'live'),
    [classes, now]
  );

  const past = useMemo(
    () => classes.filter((item) => new Date(item.start_time).getTime() < now && item.status !== 'live'),
    [classes, now]
  );

  const visibleClasses = useMemo(() => {
    const base =
      activeTab === 'upcoming'
        ? upcoming
        : activeTab === 'past'
          ? past
          : classes;

    const term = search.trim().toLowerCase();
    if (!term) return base;

    return base.filter((item) =>
      [item.title, item.description, item.courses?.title, item.profiles?.full_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [activeTab, upcoming, past, classes, search]);

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));

  const formatTime = (date: string) =>
    new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(date));

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || profile?.role !== 'student') return null;

  const liveCount = classes.filter((item) => item.status === 'live').length;
  const upcomingCount = upcoming.filter((item) => item.status !== 'live').length;

  return (
    <DashboardShell role="student">
      <div className="-mx-4 -mt-6 min-h-screen bg-slate-50 px-4 pb-8 pt-5 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0">
        {/* Branded page heading; the shared shell remains responsible for global navigation. */}
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            LearnPathshala live learning
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Live Classes
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Join your scheduled sessions and keep learning with your teachers.
          </p>
        </header>

        {/* Summary banner */}
        <section className="mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-600 p-5 text-white shadow-md sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-100">
                Your classroom
              </p>
              <h2 className="mt-1 text-lg font-extrabold sm:text-xl">
                Learn live, achieve more
              </h2>
              <p className="mt-1 text-sm leading-6 text-blue-100">
                Join on time, ask questions, and make every session count.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-blue-100">
                <Radio className="h-4 w-4" />
                <span className="text-xs font-medium">Live now</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold">{liveCount}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <div className="flex items-center gap-2 text-blue-100">
                <CalendarDays className="h-4 w-4" />
                <span className="text-xs font-medium">Upcoming</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold">{upcomingCount}</p>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {([
            ['upcoming', 'Upcoming'],
            ['past', 'Past classes'],
            ['all', 'All classes'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`min-h-10 rounded-xl px-2 text-xs font-bold transition sm:text-sm ${
                activeTab === value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              aria-pressed={activeTab === value}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search classes or teachers..."
            className="h-12 rounded-xl border-slate-200 bg-white pl-10"
            aria-label="Search live classes"
          />
        </div>

        {loadError && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">{loadError}</p>
            <Button variant="outline" onClick={() => void fetchData()} className="mt-3 bg-white">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {classes.length === 0 && !loadError ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center sm:py-14">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <Video className="h-7 w-7 text-blue-600" />
            </div>
            <h2 className="mt-4 text-base font-extrabold text-slate-900">
              No live classes yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Enroll in a course to see its scheduled live sessions here.
            </p>
          </div>
        ) : visibleClasses.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-800">No matching classes</p>
            <p className="mt-1 text-xs text-slate-500">Try a different search or tab.</p>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleClasses.map((item) => {
              const isLive = item.status === 'live';
              const isPast =
                new Date(item.start_time).getTime() < Date.now() && !isLive;

              return (
                <Card
                  key={item.id}
                  className={`min-w-0 overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition hover:shadow-md ${
                    isPast ? 'opacity-80' : ''
                  }`}
                >
                  <div className={`h-1.5 ${isLive ? 'bg-rose-500' : isPast ? 'bg-slate-300' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`} />
                  <CardContent className="p-4 sm:p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        isLive ? 'bg-rose-50 text-rose-600' : isPast ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isLive ? <Radio className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                      </div>
                      <Badge
                        variant="outline"
                        className={`max-w-[130px] shrink-0 capitalize ${statusStyles[item.status] || statusStyles.scheduled}`}
                      >
                        {isLive && <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-rose-500" />}
                        {item.status}
                      </Badge>
                    </div>

                    <h3 className="break-words text-base font-extrabold leading-6 text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-slate-500">
                      {item.description || 'Join this session to continue your course.'}
                    </p>

                    <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800">{formatDate(item.start_time)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatTime(item.start_time)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm text-slate-600">
                        <Clock className="h-4 w-4 shrink-0 text-blue-600" />
                        <span>{item.duration_minutes || '—'} minutes</span>
                      </div>
                      <div className="flex items-start gap-2.5 text-sm text-slate-600">
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <p className="break-words font-medium text-slate-800">{item.courses?.title || 'Course session'}</p>
                          <p className="mt-0.5 break-words text-xs text-slate-500">
                            {item.profiles?.full_name || 'Instructor'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {isLive && item.meeting_link ? (
                      <a
                        href={item.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block"
                      >
                        <Button className="h-11 w-full rounded-xl bg-rose-600 font-bold text-white hover:bg-rose-700">
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Join live class
                        </Button>
                      </a>
                    ) : item.status === 'scheduled' && item.meeting_link ? (
                      <a
                        href={item.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block"
                      >
                        <Button variant="outline" className="h-11 w-full rounded-xl border-blue-200 font-bold text-blue-700 hover:bg-blue-50">
                          <Link2 className="mr-2 h-4 w-4" />
                          Open meeting link
                        </Button>
                      </a>
                    ) : (
                      <div className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-slate-50 px-3 text-center text-xs font-medium text-slate-500">
                        {isPast ? 'This session has ended' : 'Meeting link not available yet'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
