'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ClipboardCheck,
  GraduationCap,
  Layers,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react';

import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Series = {
  id: string;
  title: string;
  description: string | null;
  exam_name: string;
  category: string;
  price: number;
  original_price: number;
  validity_days: number;
  is_free: boolean;
  status: string;
  subjects?: string[];
  testCount?: number;
};

type MockTest = {
  id: string;
  title: string;
  exam_name?: string | null;
  category?: string | null;
  time_limit_minutes: number;
  attempt_limit: number;
  is_free?: boolean;
  status?: string;
  [key: string]: any;
};

type Purchase = {
  series_id: string;
  status: string;
  expires_at: string;
  [key: string]: any;
};

export default function StudentMockTestsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [series, setSeries] = useState<Series[]>([]);
  const [tests, setTests] = useState<MockTest[]>([]);
  const [attempts, setAttempts] = useState<Record<string, any[]>>({});
  const [purchased, setPurchased] = useState<Record<string, Purchase>>({});
  const [seriesTestIds, setSeriesTestIds] = useState<Record<string, string[]>>({});
  const [previewTestIds, setPreviewTestIds] = useState<string[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [detailsSeries, setDetailsSeries] = useState<Series | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'about' | 'benefits' | 'faq'>('about');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'student')) {
      router.replace('/login');
    }
  }, [loading, user, profile?.role, router]);

  const fetchData = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    try {
      const [
        { data: seriesData, error: seriesError },
        { data: subjectData, error: subjectsError },
        { data: linkData, error: linksError },
        { data: purchaseData, error: purchasesError },
        { data: testData, error: testsError },
        { data: attemptData, error: attemptsError },
      ] = await Promise.all([
        supabase.from('mock_test_series').select('*').eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('mock_test_series_subjects').select('series_id, name').order('subject_order'),
        supabase.from('mock_test_series_tests').select('series_id, test_id, is_free_preview'),
        supabase.from('mock_test_series_purchases').select('*').eq('student_id', userId),
        supabase.from('mock_tests').select('*').eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('mock_test_attempts').select('*').eq('student_id', userId),
      ]);

      const errors = [seriesError, subjectsError, linksError, purchasesError, testsError, attemptsError].filter(Boolean);
      if (errors.length) {
        console.error('Could not load mock test data:', errors);
        toast.error('Some mock test data could not be loaded. Please refresh.');
      }

      const subjectsBySeries: Record<string, string[]> = {};
      (subjectData || []).forEach((row: any) => {
        subjectsBySeries[row.series_id] = [...(subjectsBySeries[row.series_id] || []), row.name];
      });

      const counts: Record<string, number> = {};
      const linkedTests: Record<string, string[]> = {};
      const freePreviewIds: string[] = [];

      (linkData || []).forEach((row: any) => {
        counts[row.series_id] = (counts[row.series_id] || 0) + 1;
        linkedTests[row.series_id] = [...(linkedTests[row.series_id] || []), row.test_id];
        if (row.is_free_preview) freePreviewIds.push(row.test_id);
      });

      const activePurchases: Record<string, Purchase> = {};
      (purchaseData || []).forEach((purchase: any) => {
        if (purchase.status === 'active' && new Date(purchase.expires_at) > new Date()) {
          activePurchases[purchase.series_id] = purchase;
        }
      });

      const attemptMap: Record<string, any[]> = {};
      (attemptData || []).forEach((attempt: any) => {
        attemptMap[attempt.test_id] = [...(attemptMap[attempt.test_id] || []), attempt];
      });

      const mappedSeries: Series[] = (seriesData || []).map((item: any) => ({
        ...item,
        subjects: subjectsBySeries[item.id] || [],
        testCount: counts[item.id] || 0,
      }));

      setSeries(mappedSeries);
      setSeriesTestIds(linkedTests);
      setPreviewTestIds(freePreviewIds);
      setPurchased(activePurchases);
      setTests((testData || []) as MockTest[]);
      setAttempts(attemptMap);
      setSelectedSeriesId((current) => current && mappedSeries.some((item) => item.id === current)
        ? current
        : mappedSeries[0]?.id ?? null);
    } catch (error) {
      console.error('Unexpected error loading mock tests:', error);
      toast.error('Unable to load mock tests. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile?.role === 'student' && user?.id) {
      void fetchData();
    } else if (!loading && (!user || profile?.role !== 'student')) {
      setDataLoading(false);
    }
  }, [profile?.role, user?.id, loading, fetchData]);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('payment');
    if (status === 'success') toast.success('Payment successful! Your mock test series is unlocked.');
    if (status === 'failed') toast.error('Payment failed or was cancelled.');
    if (status) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const submitPayU = async (seriesId: string) => {
    setBuying(seriesId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error('Your session expired. Please log in again.');
        router.push('/login');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/payu-create-series-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ seriesId }),
        }
      );

      const data = await response.json();
      if (!response.ok || data.error) {
        toast.error(data.error || 'Could not start payment.');
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.payu_url;
      form.style.display = 'none';

      const fields: Record<string, string> = {
        key: data.key,
        txnid: data.txnid,
        amount: String(data.amount),
        productinfo: data.productinfo,
        firstname: data.firstname,
        email: data.email,
        phone: data.phone || '',
        surl: data.surl,
        curl: data.curl,
        hash: data.hash,
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

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error('PayU checkout error:', error);
      toast.error('Could not connect to payment gateway.');
      setBuying(null);
    }
  };

  const freeTests = useMemo(
    () => tests.filter((test) => test.is_free || previewTestIds.includes(test.id)),
    [tests, previewTestIds]
  );

  const unlockedTests = useMemo(
    () => tests.filter((test) => !test.is_free && Object.keys(purchased).some(
      (seriesId) => (seriesTestIds[seriesId] || []).includes(test.id)
    )),
    [tests, purchased, seriesTestIds]
  );

  const selectedSeries = series.find((item) => item.id === selectedSeriesId) || series[0] || null;
  const selectedOwned = selectedSeries ? purchased[selectedSeries.id] : null;
  const selectedDiscount = selectedSeries && selectedSeries.original_price > selectedSeries.price && selectedSeries.price > 0;
  const faqs = [
    {
      question: 'What is a mock test series?',
      answer: 'A test series groups practice tests for an exam so you can prepare in a structured way and review your performance.',
    },
    {
      question: 'How do I unlock a paid test series?',
      answer: 'Choose a series, select Buy Now, and complete the payment through the secure payment page. Your access is shown here after purchase confirmation.',
    },
    {
      question: 'How long will I have access?',
      answer: `Access validity is shown on each series card. This series offers ${selectedSeries?.validity_days ?? 'the listed'} days of access.`,
    },
    {
      question: 'Where can I see my scores?',
      answer: 'Complete a mock test and open Results & Rankings from this page to review your performance.',
    },
  ];

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user || profile?.role !== 'student') return null;

  return (
    <DashboardShell role="student">
      <div className="-mx-4 -mt-6 min-h-screen bg-white pb-32 text-slate-900 md:mx-0 md:mt-0 md:min-h-0 md:bg-slate-50 md:px-5 md:pb-10 md:pt-5">
        {/* Brand header: keep the logo and LearnPathshala name visible on mobile and desktop */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl md:static md:mb-5 md:rounded-2xl md:border md:px-5">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <Link href="/dashboard/student" className="flex min-w-0 items-center gap-3">
              <Image
                src="/learnpathshalalogo.png"
                alt="LearnPathshala logo"
                width={48}
                height={48}
                priority
                className="h-11 w-11 shrink-0 rounded-xl object-contain"
              />
              <span className="min-w-0">
                <span className="block truncate text-lg font-extrabold tracking-tight text-slate-900">
                  Learn<span className="text-blue-700">Pathshala</span>
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                  Learn · Practice · Succeed
                </span>
              </span>
            </Link>
            <Link
              href="/dashboard/student/profile"
              aria-label="Student profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-800 ring-1 ring-blue-100"
            >
              {(profile?.full_name || 'S').trim().charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl">
          {/* Test Prime-inspired hero */}
          <section className="relative mx-4 overflow-hidden rounded-[26px] bg-gradient-to-br from-[#063B8F] via-[#0B56B5] to-[#1976E8] px-5 py-6 text-white shadow-lg md:mx-0 md:px-8 md:py-9">
            <div className="pointer-events-none absolute -right-8 -top-12 h-48 w-48 rounded-full border-[24px] border-white/10" />
            <div className="pointer-events-none absolute bottom-[-60px] right-24 h-40 w-40 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0 max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  LearnPathshala Test Prime
                </div>
                <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  All your mock tests.
                  <span className="block text-amber-300">One learning journey.</span>
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                  Prepare with exam-focused test series, practice at your pace, and track your progress in one place.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2"><ClipboardCheck className="h-4 w-4" /> Timed mock tests</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2"><TrendingUp className="h-4 w-4" /> Track your scores</span>
                </div>
              </div>
              <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 sm:flex">
                <GraduationCap className="h-10 w-10 text-amber-300" />
              </div>
            </div>
            <a href="#test-series" className="relative mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-blue-950 shadow-sm transition hover:bg-amber-200">
              Explore test series <ChevronRight className="h-4 w-4" />
            </a>
          </section>

          {/* Product highlights inspired by the supplied reference */}
          <section className="px-4 pt-7 md:px-0 md:pt-8">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Why practice here?</p>
                <h2 className="mt-1 text-xl font-extrabold sm:text-2xl">What will you get</h2>
              </div>
              <Badge variant="outline" className="shrink-0 border-blue-100 bg-blue-50 text-blue-800">Student focused</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: ClipboardCheck, title: 'Exam-style tests', copy: 'Practice with timed tests' },
                { icon: TrendingUp, title: 'Score tracking', copy: 'Review your progress' },
                { icon: Clock, title: 'Flexible practice', copy: 'Study at your pace' },
                { icon: ShieldCheck, title: 'Secure access', copy: 'Your purchased series' },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900">{feature.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{feature.copy}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Series list */}
          <section id="test-series" className="scroll-mt-24 px-4 pt-8 md:px-0">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold sm:text-2xl">Complete Test Series</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a package for your exam preparation.</p>
              </div>
              <Badge className="shrink-0 bg-amber-100 text-amber-800 hover:bg-amber-100">Best value</Badge>
            </div>

            {series.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-300">
                <CardContent className="px-5 py-10 text-center">
                  <Layers className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-800">No test series available yet</p>
                  <p className="mt-1 text-sm text-slate-500">Published test series will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {series.map((item) => {
                  const owned = purchased[item.id];
                  const isSelected = selectedSeries?.id === item.id;
                  const discounted = item.original_price > item.price && item.price > 0;
                  const includedTests = tests.filter((test) => (seriesTestIds[item.id] || []).includes(test.id));

                  return (
                    <Card
                      key={item.id}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                        isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
                      }`}
                    >
                      <div className="h-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Badge variant="outline" className="max-w-full border-blue-100 bg-blue-50 text-blue-800">{item.exam_name}</Badge>
                            <h3 className="mt-3 break-words text-lg font-extrabold leading-6 text-slate-900">{item.title}</h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
                              {item.description || 'A complete mock test package for focused exam preparation.'}
                            </p>
                          </div>
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Layers className="h-5 w-5" />
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                          <div><p className="text-lg font-extrabold text-slate-900">{item.testCount ?? 0}</p><p className="text-[11px] text-slate-500">Tests</p></div>
                          <div><p className="text-lg font-extrabold text-slate-900">{item.validity_days}</p><p className="text-[11px] text-slate-500">Days access</p></div>
                          <div><p className="text-lg font-extrabold text-slate-900">{item.subjects?.length || 0}</p><p className="text-[11px] text-slate-500">Subjects</p></div>
                        </div>

                        {item.subjects && item.subjects.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.subjects.slice(0, 4).map((subject) => (
                              <Badge key={subject} variant="secondary" className="bg-slate-100 text-slate-600">{subject}</Badge>
                            ))}
                            {item.subjects.length > 4 && <Badge variant="secondary">+{item.subjects.length - 4}</Badge>}
                          </div>
                        )}

                        {includedTests.length > 0 && (
                          <div className="mt-4 rounded-xl border border-slate-200 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Included tests</span>
                              {!owned && <span className="text-[11px] text-slate-400">Purchase to unlock</span>}
                            </div>
                            <div className="space-y-2">
                              {includedTests.slice(0, 3).map((test) => {
                                const available = Boolean(owned) || Boolean(test.is_free) || previewTestIds.includes(test.id);
                                const remaining = Number(test.attempt_limit || 0) - (attempts[test.id] || []).length;
                                return (
                                  <div key={test.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-slate-800">{test.title}</p>
                                      <p className="text-xs text-slate-500">{test.time_limit_minutes} min · {test.attempt_limit} attempts</p>
                                    </div>
                                    {available ? (
                                      <Link href={remaining > 0 ? `/dashboard/student/mock-tests/${test.id}` : '#'} className="shrink-0">
                                        <Button size="sm" variant="outline" disabled={remaining <= 0} className="h-8 px-2.5 text-xs">
                                          {remaining > 0 ? 'Attempt' : 'Completed'}
                                        </Button>
                                      </Link>
                                    ) : <LockKeyhole className="h-4 w-4 shrink-0 text-slate-400" />}
                                  </div>
                                );
                              })}
                            </div>
                            {includedTests.length > 3 && <p className="mt-2 text-center text-xs text-slate-400">+ {includedTests.length - 3} more tests</p>}
                          </div>
                        )}

                        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <Button variant="outline" size="sm" onClick={() => setDetailsSeries(item)} className="w-full sm:w-auto">
                            <ClipboardCheck className="mr-2 h-4 w-4" /> View all tests
                          </Button>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <div>
                              {item.is_free ? (
                                <span className="text-xl font-extrabold text-emerald-700">Free</span>
                              ) : (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-2xl font-black text-slate-900">₹{item.price}</span>
                                  {discounted && <span className="text-sm text-slate-400 line-through">₹{item.original_price}</span>}
                                </div>
                              )}
                              {owned && <p className="mt-0.5 text-xs text-emerald-700">Expires {new Date(owned.expires_at).toLocaleDateString()}</p>}
                            </div>
                            {owned ? (
                              <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Purchased</Badge>
                            ) : (
                              <Button
                                onClick={() => item.is_free ? toast.success('Free series unlocked!') : submitPayU(item.id)}
                                disabled={buying === item.id}
                                className="bg-blue-700 text-white hover:bg-blue-800"
                              >
                                {buying === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : item.is_free ? <Sparkles className="mr-2 h-4 w-4" /> : null}
                                {item.is_free ? 'Unlock free' : 'Select plan'}
                              </Button>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSeriesId(item.id)}
                          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                            isSelected ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {isSelected ? 'Selected plan' : 'Choose this plan'}
                        </button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* About / overview / benefits / FAQ tabs */}
          <section className="px-4 pt-9 md:px-0">
            <div className="flex gap-5 overflow-x-auto border-b border-slate-200 text-sm font-bold">
              {([
                ['about', 'About'],
                ['benefits', 'Benefits'],
                ['faq', 'FAQs'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`shrink-0 border-b-2 px-1 pb-3 transition ${
                    activeSection === key ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeSection === 'about' && (
              <div className="py-5">
                <h2 className="text-lg font-extrabold">About LearnPathshala Test Prime</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Prepare for your target exam with structured mock test series. Choose the package that matches your exam, attempt the available tests, and use your results to identify topics that need more practice.
                </p>
              </div>
            )}

            {activeSection === 'benefits' && (
              <div className="grid gap-3 py-5 sm:grid-cols-2">
                {[
                  ['Practice with purpose', 'Use exam-focused tests to build familiarity with question formats.'],
                  ['Review your performance', 'Check your score after attempting a test and monitor your progress.'],
                  ['Choose a relevant series', 'Compare subjects, test counts, validity, and prices before purchasing.'],
                  ['Continue at your pace', 'Return to your dashboard and access tests available to your account.'],
                ].map(([title, copy]) => (
                  <div key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                    <div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-sm leading-6 text-slate-500">{copy}</p></div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'faq' && (
              <div className="space-y-2 py-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-extrabold">Frequently asked questions</h2>
                  <button type="button" onClick={() => setExpandedFaq(expandedFaq === -1 ? 0 : -1)} className="text-xs font-bold text-blue-700">
                    {expandedFaq === -1 ? 'Expand all' : 'Collapse'}
                  </button>
                </div>
                {faqs.map((faq, index) => (
                  <div key={faq.question} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-semibold text-slate-800"
                    >
                      <span>{index + 1}. {faq.question}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition ${expandedFaq === index || expandedFaq === -1 ? 'rotate-180' : ''}`} />
                    </button>
                    {(expandedFaq === index || expandedFaq === -1) && (
                      <p className="border-t border-slate-100 px-4 py-4 text-sm leading-6 text-slate-600">{faq.answer}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Free tests */}
          <section className="px-4 pt-8 md:px-0">
            <div className="mb-4">
              <h2 className="text-xl font-extrabold">Free Practice Tests</h2>
              <p className="mt-1 text-sm text-slate-500">Try available free tests before choosing a series.</p>
            </div>
            {freeTests.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-slate-300">
                <CardContent className="py-8 text-center text-sm text-slate-500">
                  <LockKeyhole className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  Free previews will appear here when available.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {freeTests.map((test) => {
                  const taken = attempts[test.id] || [];
                  const left = Number(test.attempt_limit || 0) - taken.length;
                  return (
                    <Card key={test.id} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardCheck className="h-5 w-5" /></div>
                          <Badge className="bg-emerald-100 text-emerald-800">Free</Badge>
                        </div>
                        <h3 className="mt-3 font-bold text-slate-900">{test.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{test.exam_name} · {test.category}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.time_limit_minutes} min</span><span>{test.attempt_limit} attempts</span></div>
                        <Link href={left > 0 ? `/dashboard/student/mock-tests/${test.id}` : '#'} className="block">
                          <Button disabled={left <= 0} variant="outline" className="mt-4 w-full">{left > 0 ? 'Start test' : 'No attempts left'}<ChevronRight className="ml-2 h-4 w-4" /></Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Unlocked tests */}
          {unlockedTests.length > 0 && (
            <section className="px-4 pt-8 md:px-0">
              <div className="mb-4">
                <h2 className="text-xl font-extrabold">Your Unlocked Tests</h2>
                <p className="mt-1 text-sm text-slate-500">Start tests included in your purchased series.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unlockedTests.map((test) => {
                  const taken = attempts[test.id] || [];
                  const left = Number(test.attempt_limit || 0) - taken.length;
                  const bestScore = taken.length ? Math.max(...taken.map((attempt) => Number(attempt.percentage) || 0)) : 0;
                  return (
                    <Card key={test.id} className="rounded-2xl border-emerald-100 bg-white shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><ClipboardCheck className="h-5 w-5" /></div>
                          <Badge className="bg-emerald-100 text-emerald-800">Unlocked</Badge>
                        </div>
                        <h3 className="mt-3 font-bold text-slate-900">{test.title}</h3>
                        <p className="mt-1 text-xs text-slate-500">{test.exam_name} · {test.category}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {test.time_limit_minutes} min</span><span>{test.attempt_limit} attempts</span>{taken.length > 0 && <span>Best {bestScore}%</span>}</div>
                        <Link href={left > 0 ? `/dashboard/student/mock-tests/${test.id}` : '#'} className="block">
                          <Button disabled={left <= 0} className="mt-4 w-full bg-blue-700 text-white hover:bg-blue-800">{left > 0 ? 'Start MCQ test' : 'No attempts left'}<ChevronRight className="ml-2 h-4 w-4" /></Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {Object.keys(attempts).length > 0 && (
            <div className="px-4 pt-7 md:px-0">
              <Link href="/dashboard/student/mock-tests/results">
                <Button variant="outline" className="w-full sm:w-auto"><Trophy className="mr-2 h-4 w-4" /> View Results & Rankings</Button>
              </Link>
            </div>
          )}

          {/* Support footer */}
          <section className="mx-4 mt-9 rounded-2xl bg-slate-100 p-5 text-center md:mx-0">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm"><BookOpen className="h-5 w-5" /></div>
            <h2 className="mt-3 text-lg font-extrabold">Need help choosing a test series?</h2>
            <p className="mt-1 text-sm text-slate-500">Compare the available plans above, or contact the LearnPathshala team for assistance.</p>
            <Link href="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-700">Contact us <ChevronRight className="h-4 w-4" /></Link>
          </section>
        </main>

        {/* Mobile sticky purchase bar, similar to the reference screenshots */}
        {selectedSeries && (
          <div className="fixed inset-x-0 bottom-[68px] z-40 border-t border-slate-200 bg-white/95 px-4 pb-3 pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => document.getElementById('test-series')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-[11px] font-medium text-slate-500">Selected plan</span>
                <span className="block truncate text-sm font-bold text-slate-900">{selectedSeries.title}</span>
                <span className="mt-0.5 flex items-baseline gap-2">
                  {selectedSeries.is_free ? <span className="text-lg font-black text-emerald-700">Free</span> : <span className="text-xl font-black text-slate-900">₹{selectedSeries.price}</span>}
                  {!selectedSeries.is_free && selectedDiscount && <span className="text-xs text-slate-400 line-through">₹{selectedSeries.original_price}</span>}
                </span>
              </button>
              {selectedOwned ? (
                <Badge className="shrink-0 bg-emerald-100 px-3 py-2 text-emerald-800"><CheckCircle2 className="mr-1 h-4 w-4" /> Purchased</Badge>
              ) : (
                <Button
                  onClick={() => selectedSeries.is_free ? toast.success('Free series unlocked!') : submitPayU(selectedSeries.id)}
                  disabled={buying === selectedSeries.id}
                  className="min-h-12 shrink-0 rounded-xl bg-rose-500 px-5 font-extrabold text-white hover:bg-rose-600"
                >
                  {buying === selectedSeries.id ? <Loader2 className="h-4 w-4 animate-spin" /> : selectedSeries.is_free ? 'Unlock free' : 'Buy now'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Full test list dialog */}
        {detailsSeries && (
          <Dialog open={Boolean(detailsSeries)} onOpenChange={(open) => { if (!open) setDetailsSeries(null); }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
              <DialogHeader><DialogTitle>{detailsSeries.title}</DialogTitle></DialogHeader>
              <div className="space-y-5 py-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-600">{detailsSeries.description || 'Complete exam preparation with multiple mock tests.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{(detailsSeries.subjects || []).map((subject) => <Badge key={subject} variant="secondary">{subject}</Badge>)}</div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white p-2"><p className="font-extrabold">{detailsSeries.testCount || 0}</p><p className="text-xs text-slate-500">Tests</p></div>
                    <div className="rounded-lg bg-white p-2"><p className="font-extrabold">{detailsSeries.validity_days}</p><p className="text-xs text-slate-500">Days</p></div>
                    <div className="rounded-lg bg-white p-2"><p className="font-extrabold">{detailsSeries.subjects?.length || 0}</p><p className="text-xs text-slate-500">Subjects</p></div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-lg font-bold">Included mock tests</h3>
                  <div className="space-y-3">
                    {tests.filter((test) => (seriesTestIds[detailsSeries.id] || []).includes(test.id)).map((test) => {
                      const available = Boolean(purchased[detailsSeries.id]) || detailsSeries.is_free || Boolean(test.is_free) || previewTestIds.includes(test.id);
                      const remaining = Number(test.attempt_limit || 0) - (attempts[test.id] || []).length;
                      return (
                        <div key={test.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{test.title}</p>{test.is_free || previewTestIds.includes(test.id) ? <Badge className="bg-emerald-100 text-emerald-800">Free preview</Badge> : null}</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{test.exam_name} · {test.category} · {test.time_limit_minutes} minutes · {test.attempt_limit} attempts</p>
                          </div>
                          {available ? (
                            <Link href={remaining > 0 ? `/dashboard/student/mock-tests/${test.id}` : '#'} onClick={() => setDetailsSeries(null)} className="shrink-0">
                              <Button size="sm" disabled={remaining <= 0}>{remaining > 0 ? 'Attempt now' : 'Completed'}</Button>
                            </Link>
                          ) : <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400"><LockKeyhole className="h-4 w-4" /> Locked</div>}
                        </div>
                      );
                    })}
                    {tests.filter((test) => (seriesTestIds[detailsSeries.id] || []).includes(test.id)).length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Tests for this series are being prepared.</p>}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardShell>
  );
}
