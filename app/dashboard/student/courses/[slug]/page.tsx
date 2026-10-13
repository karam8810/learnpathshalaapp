
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  ImageOff,
  Loader2,
  LockKeyhole,
  PlayCircle,
  Video,
  ClipboardCheck,
  RefreshCw,
  UserRound,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

type Course = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  profiles: { full_name: string | null } | null;
};

type PageStatus =
  | 'loading'
  | 'ready'
  | 'not-found'
  | 'not-enrolled'
  | 'error';

type CourseQueryResult = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  profiles:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
};

export default function StudentCourseLearningPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [imageFailed, setImageFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const loadCourse = useCallback(async () => {
    if (!user || profile?.role !== 'student' || !slug) {
      return;
    }

    setPageStatus('loading');
    setCourse(null);
    setImageFailed(false);

    try {
      // Look up the course using the URL slug.
      const { data, error: courseError } = await supabase
        .from('courses')
        .select(
          'id, slug, title, description, category, image_url, profiles!courses_teacher_id_fkey(full_name)'
        )
        .eq('slug', slug)
        .maybeSingle();

      if (courseError) throw courseError;

      if (!data) {
        setPageStatus('not-found');
        return;
      }

      // Normalize the relationship because Supabase may infer
      // profiles as an object or an array.
      const result = data as unknown as CourseQueryResult;
      const rawProfile = result.profiles;

      const normalizedCourse: Course = {
        id: result.id,
        slug: result.slug,
        title: result.title,
        description: result.description,
        category: result.category,
        image_url: result.image_url,
        profiles: Array.isArray(rawProfile)
          ? rawProfile[0] ?? null
          : rawProfile ?? null,
      };

      // Verify enrollment using the course UUID and current student UUID.
      const { data: enrollment, error: enrollmentError } =
        await supabase
          .from('enrollments')
          .select('id, status')
          .eq('course_id', normalizedCourse.id)
          .eq('student_id', user.id)
          .maybeSingle();

      if (enrollmentError) throw enrollmentError;

      if (!enrollment || enrollment.status === 'dropped') {
        setPageStatus('not-enrolled');
        return;
      }

      setCourse(normalizedCourse);
      setPageStatus('ready');
    } catch (error) {
      console.error('Student course loading error:', error);
      setPageStatus('error');
    }
  }, [user, profile?.role, slug]);

  useEffect(() => {
    if (authLoading) return;

    if (!user || profile?.role !== 'student') {
      router.replace('/login');
      return;
    }

    void loadCourse();
  }, [
    authLoading,
    user,
    profile?.role,
    router,
    loadCourse,
    retryCount,
  ]);

  const renderMessage = (
    icon: ReactNode,
    title: string,
    description: string,
    action: ReactNode
  ) => (
    <DashboardShell role="student">
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-lg rounded-2xl border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              {icon}
            </div>

            <h1 className="mt-5 text-xl font-bold text-slate-900">
              {title}
            </h1>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {description}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {action}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );

  if (authLoading || pageStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-blue-700" />
          <p className="mt-3 text-sm text-slate-500">
            Loading your course...
          </p>
        </div>
      </div>
    );
  }

  if (!user || profile?.role !== 'student') {
    return null;
  }

  if (pageStatus === 'not-found') {
    return renderMessage(
      <BookOpen className="h-8 w-8" />,
      'Course not found',
      'We could not find this course. It may have been removed or its URL may have changed.',
      <>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/student/courses')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          My Courses
        </Button>
        <Button onClick={() => router.push('/courses')}>
          Browse Courses
        </Button>
      </>
    );
  }

  if (pageStatus === 'not-enrolled') {
    return renderMessage(
      <LockKeyhole className="h-8 w-8" />,
      'Course access required',
      'This course is not linked to your student account. If you purchased it, confirm that payment and enrollment have completed successfully.',
      <>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/student/courses')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          My Courses
        </Button>
        <Button onClick={() => router.push(`/courses/${slug}`)}>
          View Course
        </Button>
      </>
    );
  }

  if (pageStatus === 'error') {
    return renderMessage(
      <RefreshCw className="h-8 w-8" />,
      'Unable to load your course',
      'There was a problem checking your course access. Please try again.',
      <>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/student/courses')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          My Courses
        </Button>
        <Button onClick={() => setRetryCount((count) => count + 1)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </>
    );
  }

  if (pageStatus !== 'ready' || !course) {
    return null;
  }

  return (
    <DashboardShell role="student">
      <main className="min-h-screen bg-slate-50 px-4 py-5 md:min-h-0 md:bg-transparent md:px-0 md:py-0">
        <Link
          href="/dashboard/student/courses"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Courses
        </Link>

        {/* Course cover and title */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative aspect-[16/7] min-h-48 max-h-[380px] overflow-hidden bg-gradient-to-br from-blue-100 to-slate-100">
            {course.image_url && !imageFailed ? (
              <img
                src={course.image_url}
                alt={`${course.title} course cover`}
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-blue-700">
                {imageFailed ? (
                  <ImageOff className="h-12 w-12 text-slate-400" />
                ) : (
                  <GraduationCap className="h-14 w-14" />
                )}
                <span className="text-sm font-semibold">
                  {imageFailed
                    ? 'Course image unavailable'
                    : 'Course cover'}
                </span>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-5 pt-16 sm:p-8 sm:pt-20">
              <Badge className="mb-3 border-0 bg-emerald-500 text-white hover:bg-emerald-500">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Enrolled
              </Badge>

              <h1 className="max-w-3xl text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
                {course.title}
              </h1>

              {course.category && (
                <p className="mt-2 text-sm font-medium text-blue-100">
                  {course.category}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Your Course
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Available in your student account
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Enrollment Verified
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Course linked to your account
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Course description */}
        <section className="mt-6 grid items-start gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      About Your Course
                    </h2>
                    <p className="text-xs text-slate-500">
                      Course overview and details
                    </p>
                  </div>
                </div>

                <div className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">
                  {course.description ||
                    'No course description is available yet.'}
                </div>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                  <span className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-blue-700" />
                    {course.profiles?.full_name || 'LearnPathshala'}
                  </span>

                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-700" />
                    Learn at your own pace
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Learning resource links */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">
                  Learning Resources
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Open available learning sections on LearnPathshala.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link
                    href="/dashboard/student/recorded-classes"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <PlayCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        Recorded Classes
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Watch available lessons
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
                  </Link>

                  <Link
                    href="/dashboard/student/live-classes"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        Live Classes
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        View scheduled classes
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
                  </Link>

                  <Link
                    href="/dashboard/student/mock-tests"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        Mock Tests
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Practice your exam skills
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
                  </Link>

                  <Link
                    href="/dashboard/student"
                    className="group flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">
                        Student Dashboard
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Return to your overview
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card className="rounded-2xl border-blue-100 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      You're enrolled
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Access is linked to your account.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-5 w-full"
                  onClick={() =>
                    router.push('/dashboard/student/courses')
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to My Courses
                </Button>
              </CardContent>
            </Card>

            <div className="rounded-2xl bg-gradient-to-br from-[#073B8C] to-[#1767D5] p-5 text-white shadow-sm">
              <GraduationCap className="h-8 w-8 text-blue-100" />
              <h3 className="mt-4 font-bold">Keep learning</h3>
              <p className="mt-2 text-sm leading-6 text-blue-100">
                Make steady progress toward your learning goals with
                LearnPathshala.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </DashboardShell>
  );
}
