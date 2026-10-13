
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  IndianRupee,
  Tag,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  User,
  Video,
  LogIn,
  GraduationCap,
  ImageOff,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

type Course = {
  id: string;
  slug: string;
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

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();

  const courseSlug =
    typeof params.slug === 'string' ? params.slug : undefined;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState(false);
  const [enrollmentChecked, setEnrollmentChecked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const getCourseRedirect = useCallback(
    () => (courseSlug ? `/courses/${courseSlug}` : '/courses'),
    [courseSlug]
  );

  const redirectToLogin = useCallback(() => {
    router.push(
      `/login?redirect=${encodeURIComponent(getCourseRedirect())}`
    );
  }, [router, getCourseRedirect]);

  const redirectToRegister = useCallback(() => {
    router.push(
      `/register?redirect=${encodeURIComponent(getCourseRedirect())}`
    );
  }, [router, getCourseRedirect]);

  // Load the published course and check enrollment.
  useEffect(() => {
    let cancelled = false;

    async function fetchCourse() {
      if (!courseSlug) {
        setCourse(null);
        setLoading(false);
        setEnrollmentChecked(true);
        return;
      }

      setLoading(true);
      setEnrollmentChecked(false);
      setImageFailed(false);

      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*, profiles!courses_teacher_id_fkey(full_name)')
          .eq('slug', courseSlug)
          .eq('admin_status', 'published')
          .maybeSingle();

        if (error) throw error;
        if (cancelled) return;

        if (!data) {
          setCourse(null);
          setEnrolled(false);
          setEnrollmentChecked(true);
          return;
        }

        setCourse(data as Course);

        if (user) {
          const { data: enrollment, error: enrollmentError } =
            await supabase
              .from('enrollments')
              .select('id, status')
              .eq('course_id', data.id)
              .eq('student_id', user.id)
              .maybeSingle();

          if (enrollmentError) {
            console.error(
              'Enrollment check error:',
              enrollmentError
            );
          }

          if (cancelled) return;

          setEnrolled(
            !!enrollment && enrollment.status !== 'dropped'
          );
        } else {
          setEnrolled(false);
        }

        setEnrollmentChecked(true);
      } catch (error) {
        console.error('Course fetch error:', error);

        if (!cancelled) {
          setCourse(null);
          setEnrolled(false);
          setEnrollmentChecked(true);
          toast.error('Could not load this course.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCourse();

    return () => {
      cancelled = true;
    };
  }, [courseSlug, user]);

  const getEffectivePrice = useCallback(
    (item: Course): number => {
      const finalPrice = Math.max(
        0,
        Number(item.final_price ?? 0)
      );
      const discountPrice = Number(item.discount_price ?? 0);

      const discountIsValid =
        item.discount_active === true &&
        discountPrice > 0 &&
        (!item.discount_expires_at ||
          new Date(item.discount_expires_at).getTime() >
            Date.now());

      return discountIsValid
        ? Math.max(0, Math.min(finalPrice, discountPrice))
        : finalPrice;
    },
    []
  );

  const hasDiscount = useCallback((item: Course): boolean => {
    const finalPrice = Number(item.final_price ?? 0);
    const discountPrice = Number(item.discount_price ?? 0);

    return (
      item.discount_active === true &&
      discountPrice > 0 &&
      discountPrice < finalPrice &&
      (!item.discount_expires_at ||
        new Date(item.discount_expires_at).getTime() >
          Date.now())
    );
  }, []);

  const formatPrice = (amount: number) =>
    amount.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

  const handleEnroll = async () => {
    if (!user) {
      redirectToLogin();
      return;
    }

    if (!course?.id) {
      toast.error('Course information is not available.');
      return;
    }

    if (profile?.role !== 'student') {
      toast.error('Only student accounts can enroll in courses.');
      return;
    }

    if (enrolled) {
      toast.info('You are already enrolled in this course.');
      return;
    }

    if (enrolling) return;

    setEnrolling(true);

    try {
      const courseId = course.id;
      const price = getEffectivePrice(course);

      // Paid enrollment: use the existing PayU Edge Function.
      if (price > 0) {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const token = sessionData.session?.access_token;

        if (!token) {
          toast.error(
            'Your session has expired. Please sign in again.'
          );
          redirectToLogin();
          return;
        }

        const supabaseUrl =
          process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
          throw new Error(
            'Supabase URL is not configured.'
          );
        }

        const response = await fetch(
          `${supabaseUrl}/functions/v1/payu-create-payment`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ courseId }),
          }
        );

        const payData = await response.json();

        if (!response.ok || payData?.error) {
          throw new Error(
            payData?.error ||
              'Could not start payment. Please try again.'
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
          console.error(
            'Incomplete PayU response:',
            missingFields
          );
          throw new Error(
            'The payment gateway returned an incomplete response.'
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

      // Free enrollment.
      const { error } = await supabase.rpc(
        'enroll_in_course',
        { p_course_id: courseId }
      );

      if (error) {
        if (
          error.message.toLowerCase().includes('already enrolled')
        ) {
          setEnrolled(true);
          toast.info('You are already enrolled in this course.');
          return;
        }

        throw error;
      }

      setEnrolled(true);
      toast.success('Enrolled successfully!');
    } catch (error) {
      console.error('Course enrollment error:', error);

      toast.error(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setEnrolling(false);
    }
  };

  if (authLoading || loading || !enrollmentChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin text-[#063B8F]" />
          <p className="text-sm text-slate-500">
            Loading course...
          </p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
            <BookOpen className="h-8 w-8 text-slate-300" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-[#063B8F]">
            Course not found
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            This course may not exist or may no longer be published.
          </p>

          <Link href="/courses" className="mt-6 inline-block">
            <Button
              variant="outline"
              className="border-blue-200 text-[#063B8F]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Browse Courses
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const price = getEffectivePrice(course);
  const discounted = hasDiscount(course);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white text-slate-900">
      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <Link
          href="/courses"
          className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-[#063B8F]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Courses
        </Link>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid items-start gap-7 lg:grid-cols-5 lg:gap-10">
          {/* Main course content */}
          <div className="min-w-0 lg:col-span-3">
            {/* Course cover */}
            <div className="relative mb-7 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 shadow-sm sm:rounded-3xl">
              {course.image_url && !imageFailed ? (
                <img
                  src={course.image_url}
                  alt={`${course.title} course cover`}
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#063B8F]">
                  {imageFailed ? (
                    <ImageOff className="h-12 w-12 text-slate-400" />
                  ) : (
                    <GraduationCap className="h-16 w-16" />
                  )}
                  <span className="text-sm font-semibold">
                    {imageFailed
                      ? 'Course image unavailable'
                      : 'Course Cover'}
                  </span>
                </div>
              )}

              {discounted && (
                <div className="absolute left-4 top-4">
                  <Badge className="border-0 bg-emerald-600 px-3 py-1.5 text-white shadow-md hover:bg-emerald-600">
                    <Tag className="mr-1.5 h-3.5 w-3.5" />
                    Special Offer
                  </Badge>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 text-[#063B8F]"
              >
                {course.category || 'General'}
              </Badge>

              {discounted && (
                <Badge className="border-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  <Tag className="mr-1 h-3 w-3" />
                  Sale
                </Badge>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#062E6F] sm:text-4xl lg:text-5xl">
              {course.title}
            </h1>

            {/* The complete course description appears ONLY here. */}
            <div className="mt-4 whitespace-pre-line text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              {course.description || 'No description available.'}
            </div>

            {/* Course metadata */}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[#063B8F]" />
                <span>
                  {course.profiles?.full_name || 'LearnPathshala'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#063B8F]" />
                <span>{course.category || 'General'}</span>
              </div>

              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-[#F5A623]" />
                <span>Learning resources</span>
              </div>
            </div>

            {/* About card: no repeated course description */}
            <Card className="mt-8 overflow-hidden rounded-2xl border-blue-100 shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <BookOpen className="h-5 w-5 text-[#063B8F]" />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#063B8F]">
                      About This Course
                    </h2>
                    <p className="text-xs text-slate-500">
                      Learn, practice, and progress with LearnPathshala.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-blue-50/70 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      Structured learning
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Learn through the resources provided for your course.
                    </p>
                  </div>

                  <div className="rounded-xl bg-amber-50/70 p-4">
                    <GraduationCap className="h-5 w-5 text-amber-600" />
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      Student access
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Access course content through your student account
                      after enrollment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust information */}
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#063B8F]" />
              <div>
                <p className="text-sm font-semibold text-[#063B8F]">
                  Learn with LearnPathshala
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Your course access is linked to your LearnPathshala
                  student account.
                </p>
              </div>
            </div>
          </div>

          {/* Price and enrollment */}
          <aside className="min-w-0 lg:col-span-2">
            <Card className="overflow-hidden rounded-2xl border-blue-100 bg-white shadow-lg shadow-blue-900/10 lg:sticky lg:top-24">
              <CardContent className="p-5 sm:p-6">
                <p className="text-sm font-semibold text-slate-500">
                  Course price
                </p>

                <div className="mt-3 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-amber-50 p-5">
                  {price === 0 ? (
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                      </div>

                      <div>
                        <p className="text-2xl font-extrabold text-emerald-600">
                          Free Course
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Start learning today
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {discounted && (
                        <p className="text-sm text-slate-400 line-through">
                          ₹{formatPrice(Number(course.final_price ?? 0))}
                        </p>
                      )}

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="flex items-center text-3xl font-extrabold text-[#063B8F]">
                          <IndianRupee className="h-7 w-7" />
                          {formatPrice(price)}
                        </span>
                      </div>

                      {discounted && (
                        <Badge
                          variant="outline"
                          className="mt-3 border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Save ₹
                          {formatPrice(
                            Math.max(
                              0,
                              Number(course.final_price ?? 0) - price
                            )
                          )}
                        </Badge>
                      )}
                    </>
                  )}
                </div>

                {/* Benefits */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    Course access through your student account
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    Structured learning resources
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    Learn at your own pace
                  </div>

                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Clock className="h-5 w-5 shrink-0 text-slate-400" />
                    Access depends on your course enrollment
                  </div>
                </div>

                {/* Primary action */}
                <div className="mt-7">
                  {enrolled ? (
                  
<Link href={`/dashboard/student/courses/${course.slug}`}>
  <Button className="w-full">
    <CheckCircle2 className="mr-2 h-4 w-4" />
    Continue Learning
    <ArrowRight className="ml-auto h-4 w-4" />
  </Button>
</Link>

                  ) : (
                    <Button
                      onClick={() => void handleEnroll()}
                      disabled={enrolling}
                      className="h-12 w-full bg-gradient-to-r from-[#063B8F] to-[#0B63CE] font-bold text-white shadow-md hover:from-[#052f73] hover:to-[#084fa8]"
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : user ? (
                        <>
                          {price > 0
                            ? `Enroll for ₹${formatPrice(price)}`
                            : 'Enroll for Free'}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <LogIn className="mr-2 h-4 w-4" />
                          Sign In to Enroll
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Guest login/register */}
                {!user && !enrolled && (
                  <div className="mt-4 space-y-2 text-center text-xs text-slate-500">
                    <p>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={redirectToLogin}
                        className="font-semibold text-[#063B8F] hover:underline"
                      >
                        Sign in
                      </button>
                    </p>

                    <p>
                      New to LearnPathshala?{' '}
                      <button
                        type="button"
                        onClick={redirectToRegister}
                        className="font-semibold text-[#063B8F] hover:underline"
                      >
                        Register
                      </button>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </section>

      {/* Bottom call to action */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#063B8F] to-[#0B63CE] px-5 py-9 text-center shadow-xl sm:px-10 sm:py-12">
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
            Ready to start learning?
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
            Explore courses on LearnPathshala and take the next step
            in your learning journey.
          </p>

          {!enrolled && (
            <Button
              onClick={() => void handleEnroll()}
              disabled={enrolling}
              className="mt-6 bg-gradient-to-r from-[#F5A623] to-[#FFB52E] font-bold text-[#063B8F] shadow-lg hover:from-[#e99a14] hover:to-[#f2a820]"
            >
              {enrolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {user
                    ? price > 0
                      ? `Enroll for ₹${formatPrice(price)}`
                      : 'Enroll for Free'
                    : 'Continue to Enroll'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
