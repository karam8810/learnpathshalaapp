
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  BookOpen,
  Search,
  CheckCircle2,
  IndianRupee,
  Tag,
  Sparkles,
  GraduationCap,
  ImageOff,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Course = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  final_price: number | null;
  discount_price: number | null;
  discount_active: boolean | null;
  discount_expires_at: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

type TabValue = 'my' | 'all';

export default function StudentCoursesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>('my');
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'student')) {
      router.replace('/login');
    }
  }, [loading, user, profile, router]);

  const fetchData = useCallback(async () => {
    if (!user || profile?.role !== 'student') return;

    setDataLoading(true);
    setLoadError(false);

    try {
      const [coursesResult, enrollmentsResult] = await Promise.all([
        supabase
          .from('courses')
          .select('*, profiles!courses_teacher_id_fkey(full_name)')
          .eq('admin_status', 'published')
          .order('created_at', { ascending: false }),

        supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', user.id),
      ]);

      if (coursesResult.error) throw coursesResult.error;
      if (enrollmentsResult.error) throw enrollmentsResult.error;

      setAllCourses((coursesResult.data ?? []) as Course[]);

      setEnrolledIds(
        new Set(
          (enrollmentsResult.data ?? []).map((enrollment) => enrollment.course_id)
        )
      );
    } catch (error) {
      console.error('Failed to load student courses:', error);
      setLoadError(true);
      toast.error('Could not load courses. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && user && profile?.role === 'student') {
      void fetchData();
    }
  }, [loading, user, profile, fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');

    if (paymentStatus === 'success') {
      toast.success('Payment successful! Your enrollment will appear once confirmed.');
      void fetchData();
    } else if (paymentStatus === 'failed') {
      toast.error('Payment failed or was cancelled. Please try again.');
    }

    if (paymentStatus) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchData]);

  const getEffectivePrice = useCallback((course: Course): number => {
    const finalPrice = Number(course.final_price ?? 0);

    const discountIsValid =
      course.discount_active === true &&
      Number(course.discount_price ?? 0) > 0 &&
      (!course.discount_expires_at ||
        new Date(course.discount_expires_at).getTime() > Date.now());

    if (discountIsValid) {
      return Math.max(
        0,
        Math.min(finalPrice, Number(course.discount_price))
      );
    }

    return Math.max(0, finalPrice);
  }, []);

  const hasDiscount = useCallback(
    (course: Course): boolean => {
      const finalPrice = Number(course.final_price ?? 0);
      const discountPrice = Number(course.discount_price ?? 0);

      return (
        course.discount_active === true &&
        discountPrice > 0 &&
        discountPrice < finalPrice &&
        (!course.discount_expires_at ||
          new Date(course.discount_expires_at).getTime() > Date.now())
      );
    },
    []
  );

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return allCourses
      .filter((course) =>
        activeTab === 'my' ? enrolledIds.has(course.id) : true
      )
      .filter((course) => {
        if (!query) return true;

        return (
          course.title?.toLowerCase().includes(query) ||
          course.category?.toLowerCase().includes(query) ||
          course.description?.toLowerCase().includes(query) ||
          course.profiles?.full_name?.toLowerCase().includes(query)
        );
      });
  }, [allCourses, enrolledIds, activeTab, search]);

  const handleEnroll = async (course: Course) => {
    if (!user) {
      toast.error('Please log in to enroll.');
      router.push('/login');
      return;
    }

    if (enrolledIds.has(course.id)) {
      toast.info('You are already enrolled in this course.');
      return;
    }

    setEnrolling(course.id);
    const price = getEffectivePrice(course);

    try {
      if (price > 0) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const token = sessionData.session?.access_token;

        if (!token) {
          toast.error('Your session has expired. Please log in again.');
          router.push('/login');
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
          throw new Error('Supabase URL is not configured.');
        }

        const response = await fetch(
          `${supabaseUrl}/functions/v1/payu-create-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ courseId: course.id }),
          }
        );

        const payData = await response.json();

        if (!response.ok || payData.error) {
          throw new Error(
            payData.error || 'Could not start payment. Please try again.'
          );
        }

        const requiredFields = [
          'payu_url',
          'key',
          'txnid',
          'amount',
          'productinfo',
          'firstname',
          'email',
          'surl',
          'curl',
          'hash',
        ];

        const missingFields = requiredFields.filter(
          (field) =>
            payData[field] === undefined ||
            payData[field] === null ||
            payData[field] === ''
        );

        if (missingFields.length > 0) {
          throw new Error(
            `Payment response is missing required fields: ${missingFields.join(', ')}`
          );
        }

        const fields: Record<string, string> = {
          key: String(payData.key),
          txnid: String(payData.txnid),
          amount: String(payData.amount),
          productinfo: String(payData.productinfo),
          firstname: String(payData.firstname),
          email: String(payData.email),
          phone: String(payData.phone ?? ''),
          surl: String(payData.surl),
          curl: String(payData.curl),
          hash: String(payData.hash),
          udf1: '',
          udf2: '',
          udf3: '',
          udf4: '',
          udf5: '',
          udf6: '',
          udf7: '',
          udf8: '',
          udf9: '',
          udf10: '',
        };

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = String(payData.payu_url);
        form.style.display = 'none';

        Object.entries(fields).forEach(([name, value]) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        return;
      }

      const { error } = await supabase.rpc('enroll_in_course', {
        p_course_id: course.id,
      });

      if (error) {
        if (error.message.includes('Already enrolled')) {
          toast.info('You are already enrolled in this course.');
          await fetchData();
          return;
        }

        throw error;
      }

      toast.success('Enrolled successfully!');
      setEnrolledIds((previous) => new Set(previous).add(course.id));
    } catch (error) {
      console.error('Course enrollment failed:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not enroll in this course.'
      );
    } finally {
      setEnrolling(null);
    }
  };

  if (loading || (dataLoading && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || profile?.role !== 'student') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <DashboardShell role="student">
      <div className="-mx-4 -mt-6 min-h-screen bg-slate-50 px-4 pb-28 pt-0 md:mx-0 md:mt-0 md:min-h-0 md:bg-transparent md:px-0 md:pb-0">
        {/* Mobile brand header */}
        <header className="-mx-4 mb-6 rounded-b-3xl bg-gradient-to-br from-[#073B8C] to-[#1767D5] px-4 pb-5 pt-4 text-white shadow-md md:hidden">
          <Link
            href="/dashboard/student"
            className="flex min-w-0 items-center gap-3"
          >
            <img
              src="/learnpathshalalogo.png"
              alt="LearnPathshala logo"
              className="h-12 w-12 shrink-0 rounded-xl bg-white p-1 object-contain"
            />

            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold tracking-tight">
                LearnPathshala
              </h2>
              <p className="mt-0.5 text-xs font-medium text-blue-100">
                Learn • Practice • Succeed
              </p>
            </div>

            <div className="ml-auto rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              My Learning
            </div>
          </Link>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
              Your learning journey
            </p>
            <p className="mt-1 text-xl font-extrabold">Courses</p>
            <p className="mt-1 text-sm leading-5 text-blue-100">
              Continue learning or discover your next course.
            </p>
          </div>
        </header>

        {/* Page heading */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {activeTab === 'my' ? 'My Courses' : 'All Courses'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {activeTab === 'my'
                ? 'Continue learning in the courses you enrolled in'
                : 'Explore all published courses available to you'}
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as TabValue);
              setSearch('');
            }}
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 sm:w-auto">
              <TabsTrigger value="my">
                My Courses
                <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs text-slate-500">
                  {enrolledIds.size}
                </span>
              </TabsTrigger>

              <TabsTrigger value="all">
                All Courses
                <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs text-slate-500">
                  {allCourses.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <Input
            placeholder="Search by course, category or teacher..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-xl border-slate-200 bg-white pl-10"
          />
        </div>

        {/* Error state */}
        {loadError ? (
          <Card className="border-red-100">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-800">
                Unable to load courses
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Check your connection and try again.
              </p>
              <Button className="mt-4" onClick={() => void fetchData()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => {
              const isEnrolled = enrolledIds.has(course.id);
              const price = getEffectivePrice(course);
              const discounted = hasDiscount(course);

              return (
                <Card
                  key={course.id}
                  className="group overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Cover image */}
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-50 to-slate-100 sm:h-52">
                    {course.image_url ? (
                      <img
                        src={course.image_url}
                        alt={`${course.title} course cover`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                          const fallback =
                            event.currentTarget.nextElementSibling as HTMLElement | null;

                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}

                    {/* Fallback for missing or failed images */}
                    <div
                      className={`absolute inset-0 flex-col items-center justify-center gap-2 text-blue-700 ${
                        course.image_url ? 'hidden' : 'flex'
                      }`}
                    >
                      {course.image_url ? (
                        <ImageOff className="h-10 w-10" />
                      ) : (
                        <GraduationCap className="h-12 w-12" />
                      )}
                      <span className="text-sm font-semibold">
                        {course.image_url ? 'Image unavailable' : 'Course Cover'}
                      </span>
                    </div>

                    {/* Category badge */}
                    {course.category && (
                      <div className="absolute bottom-3 left-3 max-w-[75%]">
                        <Badge className="border border-white/70 bg-white/95 text-slate-800 shadow-sm hover:bg-white">
                          <span className="truncate">{course.category}</span>
                        </Badge>
                      </div>
                    )}

                    {/* Discount badge */}
                    {discounted && (
                      <div className="absolute right-3 top-3">
                        <Badge className="border-0 bg-emerald-600 text-white shadow-md">
                          <Tag className="mr-1 h-3 w-3" />
                          Sale
                        </Badge>
                      </div>
                    )}

                    {/* Enrollment badge */}
                    {isEnrolled && (
                      <div className="absolute right-3 bottom-3">
                        <Badge className="border-0 bg-blue-700 text-white shadow-md">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Enrolled
                        </Badge>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-5">
                    {/* Course details */}
                    <div className="min-h-[104px]">
                      <h3 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900">
                        {course.title}
                      </h3>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                        {course.description || 'Explore this course on LearnPathshala.'}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Instructor:{' '}
                        <span className="font-medium text-slate-700">
                          {course.profiles?.full_name || 'LearnPathshala'}
                        </span>
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {price === 0 ? (
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-emerald-600" />
                          <span className="font-semibold text-emerald-700">
                            Free Course
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {discounted && (
                            <span className="text-sm text-slate-400 line-through">
                              ₹{Number(course.final_price ?? 0).toLocaleString('en-IN')}
                            </span>
                          )}

                          <span className="flex items-center text-xl font-extrabold text-slate-900">
                            <IndianRupee className="h-4 w-4" />
                            {price.toLocaleString('en-IN')}
                          </span>

                          {discounted && (
                            <Badge
                              variant="outline"
                              className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700"
                            >
                              Save ₹
                              {(
                                Number(course.final_price ?? 0) - price
                              ).toLocaleString('en-IN')}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Enrollment action */}
                    <div className="mt-4">
                      {isEnrolled ? (
                        <Button
                          variant="outline"
                          className="h-11 w-full border-emerald-200 bg-emerald-50 text-emerald-700"
                          disabled
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Already Enrolled
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void handleEnroll(course)}
                          disabled={enrolling === course.id}
                          className="h-11 w-full bg-amber-500 font-semibold text-white hover:bg-amber-600"
                        >
                          {enrolling === course.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : price > 0 ? (
                            <>
                              Enroll for ₹{price.toLocaleString('en-IN')}
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          ) : (
                            <>
                              Enroll for Free
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Empty state */}
            {filteredCourses.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                  {activeTab === 'my' ? (
                    <GraduationCap className="h-8 w-8 text-blue-600" />
                  ) : (
                    <BookOpen className="h-8 w-8 text-blue-600" />
                  )}
                </div>

                <h3 className="mt-4 font-bold text-slate-900">
                  {search
                    ? 'No matching courses'
                    : activeTab === 'my'
                      ? 'You have not enrolled in any courses yet'
                      : 'No published courses found'}
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  {search
                    ? 'Try another course name, category or instructor.'
                    : activeTab === 'my'
                      ? 'Browse available courses and start learning today.'
                      : 'Published courses will appear here when they are available.'}
                </p>

                {activeTab === 'my' && (
                  <Button
                    className="mt-5 bg-blue-700 text-white hover:bg-blue-800"
                    onClick={() => {
                      setActiveTab('all');
                      setSearch('');
                    }}
                  >
                    Browse All Courses
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}

                {search && (
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => setSearch('')}
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
