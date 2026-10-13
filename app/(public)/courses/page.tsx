
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Search,
  IndianRupee,
  Tag,
  Sparkles,
  BookOpen,
  Loader2,
  GraduationCap,
  ImageOff,
  RefreshCw,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';

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

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, profiles!courses_teacher_id_fkey(full_name)')
        .eq('admin_status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCourses((data ?? []) as Course[]);
    } catch (error) {
      console.error('Error fetching public courses:', error);
      setLoadError(true);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const getEffectivePrice = useCallback((course: Course): number => {
    const finalPrice = Math.max(0, Number(course.final_price ?? 0));
    const discountPrice = Number(course.discount_price ?? 0);

    const discountIsValid =
      course.discount_active === true &&
      discountPrice > 0 &&
      (!course.discount_expires_at ||
        new Date(course.discount_expires_at).getTime() > Date.now());

    return discountIsValid
      ? Math.max(0, Math.min(finalPrice, discountPrice))
      : finalPrice;
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
    const term = search.trim().toLowerCase();

    if (!term) return courses;

    return courses.filter((course) =>
      [
        course.title,
        course.category,
        course.description,
        course.profiles?.full_name,
      ].some((value) => value?.toLowerCase().includes(term))
    );
  }, [courses, search]);

  const formatPrice = (price: number) =>
    price.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white text-slate-900">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-24 h-72 w-72 rounded-full bg-amber-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-[#063B8F] shadow-sm">
              <BookOpen className="h-4 w-4 text-[#F5A623]" />
              LearnPathshala Courses
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#063B8F] sm:text-5xl">
              Explore Our Courses
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Browse our courses, learn from experienced teachers, and build
              the skills you need for your academic and competitive journey.
            </p>
          </div>
        </div>
      </section>

      {/* Course listing */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#063B8F] sm:text-2xl">
              Available Courses
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Find the right course for your goals.
            </p>
          </div>

          <div className="relative w-full sm:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <Input
              placeholder="Search courses, categories or teachers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 rounded-xl border-slate-200 bg-white pl-11 shadow-sm focus-visible:ring-[#063B8F]"
            />
          </div>
        </div>

        {!loading && !loadError && (
          <p className="mb-5 text-sm font-medium text-slate-500">
            {filteredCourses.length}{' '}
            {filteredCourses.length === 1 ? 'course' : 'courses'} found
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex min-h-[350px] items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-9 w-9 animate-spin text-[#063B8F]" />
              <p className="text-sm font-medium text-slate-500">
                Loading courses...
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-white px-5 text-center">
            <BookOpen className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-[#063B8F]">
              Could not load courses
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Please check your connection and try again.
            </p>
            <Button
              onClick={() => void fetchCourses()}
              className="mt-5 bg-[#063B8F] hover:bg-[#0B63CE]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {/* Cards */}
        {!loading && !loadError && (
          <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {filteredCourses.map((course) => {
                const price = getEffectivePrice(course);
                const discounted = hasDiscount(course);

                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.slug}`}
                    className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#063B8F] focus-visible:ring-offset-2"
                  >
                    <Card className="h-full overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:shadow-xl">
                      <CardContent className="p-0">
                        {/* Course cover image */}
                        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-amber-50 sm:h-52">
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

                          {/* Image fallback */}
                          <div
                            className={`absolute inset-0 flex-col items-center justify-center gap-2 text-[#063B8F] ${
                              course.image_url ? 'hidden' : 'flex'
                            }`}
                          >
                            {course.image_url ? (
                              <ImageOff className="h-10 w-10" />
                            ) : (
                              <GraduationCap className="h-12 w-12" />
                            )}

                            <span className="text-sm font-semibold">
                              {course.image_url
                                ? 'Image unavailable'
                                : 'Course Cover'}
                            </span>
                          </div>

                          {/* Sale badge */}
                          {discounted && (
                            <div className="absolute right-3 top-3">
                              <Badge className="border-0 bg-emerald-600 text-white shadow-md hover:bg-emerald-600">
                                <Tag className="mr-1 h-3 w-3" />
                                Sale
                              </Badge>
                            </div>
                          )}

                          {/* Category badge */}
                          <div className="absolute bottom-3 left-3 max-w-[80%]">
                            <Badge className="border border-white/70 bg-white/95 text-[#063B8F] shadow-sm hover:bg-white">
                              <span className="truncate">
                                {course.category || 'General'}
                              </span>
                            </Badge>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="p-5">
                          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-[#063B8F] transition-colors group-hover:text-[#0B63CE]">
                            {course.title}
                          </h3>

                          <p className="mt-2 line-clamp-3 min-h-[60px] text-sm leading-6 text-slate-500">
                            {course.description ||
                              'Explore this course on LearnPathshala.'}
                          </p>

                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                            <span className="text-xs font-medium text-slate-400">
                              Instructor
                            </span>

                            <span className="max-w-[65%] truncate text-xs font-semibold text-slate-600">
                              {course.profiles?.full_name || 'LearnPathshala'}
                            </span>
                          </div>

                          {/* Price */}
                          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                            {price === 0 ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
                                    <Sparkles className="h-4 w-4 text-emerald-600" />
                                  </div>

                                  <div>
                                    <p className="text-sm font-bold text-emerald-600">
                                      Free Course
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      Start learning today
                                    </p>
                                  </div>
                                </div>

                                <ArrowRight className="h-5 w-5 text-emerald-500 transition-transform group-hover:translate-x-1" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  {discounted && (
                                    <p className="mb-1 text-xs font-medium text-slate-400 line-through">
                                      ₹{formatPrice(Number(course.final_price ?? 0))}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-1">
                                    <IndianRupee className="h-5 w-5 text-[#063B8F]" />
                                    <span className="text-xl font-extrabold text-[#063B8F]">
                                      {formatPrice(price)}
                                    </span>
                                  </div>
                                </div>

                                {discounted && (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
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
                              </div>
                            )}
                          </div>

                          {/* View course */}
                          <div className="mt-5 flex items-center justify-between">
                            <span className="text-sm font-bold text-[#063B8F]">
                              View Course
                            </span>

                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 transition-all group-hover:bg-[#063B8F]">
                              <ArrowRight className="h-4 w-4 text-[#063B8F] transition-all group-hover:translate-x-0.5 group-hover:text-white" />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Empty state */}
            {filteredCourses.length === 0 && (
              <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
                    <Search className="h-7 w-7 text-[#063B8F]" />
                  </div>

                  <h3 className="mt-5 text-xl font-bold text-[#063B8F]">
                    No courses found
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Try another course name or category.
                  </p>

                  {search && (
                    <Button
                      variant="outline"
                      onClick={() => setSearch('')}
                      className="mt-4"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
