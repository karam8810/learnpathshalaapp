'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Wallet, Clock, CheckCircle2, Banknote, RefreshCw, ArrowRight,
  Loader2, Users, BookOpen, Gift, AlertCircle,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';

type CourseEarning = {
  id: string;
  course_id: string;
  course_price: number;
  teacher_earnings: number;
  earning_status: string | null;
  created_at: string;
  available_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  contribution_percent?: number | null;
  teacher_pool_percent?: number | null;
  contribution_lectures?: number | null;
  contribution_minutes?: number | null;
  revenue_model?: string | null;
  calculation_snapshot?: Record<string, unknown> | null;
};

type ReferralCommission = {
  id: string;
  teacher_id: string;
  student_id: string;
  product_type: 'course' | 'mock_test_series' | string;
  transaction_id: string;
  product_id: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  available_at: string | null;
  created_at: string;
};

type Reservation = { earning_id: string; amount: number; status: string };
type StudentProfile = { id: string; full_name: string | null; email?: string | null };
type Course = { id: string; title: string };
type MockSeries = { id: string; title: string };

type HistoryRow = {
  id: string;
  kind: 'Course contribution' | 'Referral commission';
  product: string;
  date: string;
  amount: number;
  status: string;
  rate?: number;
  gross?: number;
  reference?: string | null;
  availableAt?: string | null;
  paidAt?: string | null;
  allocation?: string;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isFuture = (value?: string | null) => !!value && new Date(value).getTime() > Date.now();

function referralStatus(commission: ReferralCommission) {
  if (commission.status === 'paid') return 'Paid';
  if (commission.status === 'cancelled' || commission.status === 'reversed') return commission.status === 'cancelled' ? 'Cancelled' : 'Reversed';
  if (commission.status === 'available') return 'Available';
  if (isFuture(commission.available_at)) return 'Settlement hold';
  if (commission.status === 'pending') return 'Pending';
  return commission.status ? commission.status.replace(/_/g, ' ') : 'Pending';
}

function statusVariant(status: string): 'default' | 'outline' | 'secondary' | 'destructive' {
  if (status.toLowerCase() === 'paid' || status.toLowerCase() === 'available') return 'default';
  if (['cancelled', 'reversed'].includes(status.toLowerCase())) return 'destructive';
  return 'outline';
}

export default function TeacherEarningsPage() {
  const { user, profile, loading } = useAuth();
  const [earnings, setEarnings] = useState<CourseEarning[]>([]);
  const [commissions, setCommissions] = useState<ReferralCommission[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [courseNames, setCourseNames] = useState<Record<string, string>>({});
  const [seriesNames, setSeriesNames] = useState<Record<string, string>>({});
  const [studentNames, setStudentNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [referralError, setReferralError] = useState('');

  const load = useCallback(async () => {
    if (!user || profile?.role !== 'teacher') return;
    setBusy(true);
    setError('');
    setReferralError('');

    try {
      const [courseResult, commissionResult] = await Promise.all([
        supabase
          .from('teacher_earnings')
          .select('id, course_id, course_price, teacher_earnings, earning_status, created_at, available_at, paid_at, payout_reference, contribution_percent, teacher_pool_percent, contribution_lectures, contribution_minutes, revenue_model, calculation_snapshot')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('teacher_referral_commissions')
          .select('id, teacher_id, student_id, product_type, transaction_id, product_id, gross_amount, commission_rate, commission_amount, status, available_at, created_at')
          .eq('teacher_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (courseResult.error) throw courseResult.error;
      if (commissionResult.error) {
        // Course earnings can still be displayed if referral table access/policy needs fixing.
        console.error('Referral commissions load failed:', commissionResult.error);
        setReferralError('Referral commissions could not be loaded. Check the teacher SELECT policy on teacher_referral_commissions.');
      }

      const courseRows = (courseResult.data || []) as CourseEarning[];
      const commissionRows = (commissionResult.data || []) as ReferralCommission[];
      setEarnings(courseRows);
      setCommissions(commissionRows);

      const earningIds = courseRows.map((row) => row.id);
      if (earningIds.length) {
        const { data, error: reservationsError } = await supabase
          .from('teacher_withdrawal_items')
          .select('earning_id, amount, status')
          .in('earning_id', earningIds);
        if (reservationsError) throw reservationsError;
        setReservations((data || []) as Reservation[]);
      } else {
        setReservations([]);
      }

      const courseIds = Array.from(new Set(courseRows.map((row) => row.course_id).filter(Boolean)));
      const referralCourseIds = commissionRows.filter((row) => row.product_type === 'course' && row.product_id).map((row) => row.product_id as string);
      const allCourseIds = Array.from(new Set([...courseIds, ...referralCourseIds]));
      if (allCourseIds.length) {
        const { data, error: coursesError } = await supabase.from('courses').select('id, title').in('id', allCourseIds);
        if (coursesError) console.error('Course names load failed:', coursesError);
        const names: Record<string, string> = {};
        ((data || []) as Course[]).forEach((course) => { names[course.id] = course.title; });
        setCourseNames(names);
      } else setCourseNames({});

      const seriesIds = Array.from(new Set(commissionRows.filter((row) => row.product_type === 'mock_test_series' && row.product_id).map((row) => row.product_id as string)));
      if (seriesIds.length) {
        const { data, error: seriesError } = await supabase.from('mock_test_series').select('id, title').in('id', seriesIds);
        if (seriesError) console.error('Mock series names load failed:', seriesError);
        const names: Record<string, string> = {};
        ((data || []) as MockSeries[]).forEach((series) => { names[series.id] = series.title; });
        setSeriesNames(names);
      } else setSeriesNames({});

      const studentIds = Array.from(new Set(commissionRows.map((row) => row.student_id).filter(Boolean)));
      if (studentIds.length) {
        const { data, error: studentsError } = await supabase.from('profiles').select('id, full_name').in('id', studentIds);
        if (studentsError) console.error('Student names load failed:', studentsError);
        const names: Record<string, string> = {};
        ((data || []) as StudentProfile[]).forEach((student) => { names[student.id] = student.full_name || 'Student'; });
        setStudentNames(names);
      } else setStudentNames({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load earnings.');
    } finally {
      setBusy(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== 'teacher')) {
      window.location.href = '/login';
      return;
    }
    if (user && profile?.role === 'teacher') void load();
  }, [loading, user, profile, load]);

  const reservedIds = useMemo(() => new Set(
    reservations.filter((row) => ['reserved', 'paid'].includes(row.status)).map((row) => row.earning_id)
  ), [reservations]);

  const courseStats = useMemo(() => {
    const total = earnings.reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    const paid = earnings.filter((row) => row.earning_status === 'paid').reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    const pending = earnings.filter((row) => row.earning_status !== 'paid').reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    const onHold = earnings.filter((row) => row.earning_status !== 'paid' && isFuture(row.available_at || new Date(new Date(row.created_at).getTime() + 7 * 86400000).toISOString())).reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    const available = earnings.filter((row) => row.earning_status !== 'paid' && !reservedIds.has(row.id) && !isFuture(row.available_at || new Date(new Date(row.created_at).getTime() + 7 * 86400000).toISOString())).reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    const reserved = earnings.filter((row) => row.earning_status !== 'paid' && reservedIds.has(row.id)).reduce((sum, row) => sum + Number(row.teacher_earnings || 0), 0);
    return { total, paid, pending, onHold, available, reserved };
  }, [earnings, reservedIds]);

  const referralStats = useMemo(() => {
    const valid = commissions.filter((row) => !['cancelled', 'reversed'].includes(row.status));
    const total = valid.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
    const paid = valid.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
    const unpaid = valid.filter((row) => row.status !== 'paid').reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
    const onHold = valid.filter((row) => row.status !== 'paid' && isFuture(row.available_at)).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
    const available = valid.filter((row) => row.status !== 'paid' && !isFuture(row.available_at) && ['pending', 'available'].includes(row.status)).reduce((sum, row) => sum + Number(row.commission_amount || 0), 0);
    return { total, paid, unpaid, onHold, available, records: valid.length };
  }, [commissions]);

  const history = useMemo<HistoryRow[]>(() => {
    const courseRows: HistoryRow[] = earnings.map((row) => ({
      id: `course-${row.id}`,
      kind: 'Course contribution',
      product: courseNames[row.course_id] || 'Course',
      date: row.created_at,
      amount: Number(row.teacher_earnings || 0),
      status: row.earning_status === 'paid' ? 'Paid' : reservedIds.has(row.id) ? 'Reserved' : isFuture(row.available_at || new Date(new Date(row.created_at).getTime() + 7 * 86400000).toISOString()) ? 'Settlement hold' : 'Pending',
      reference: row.payout_reference,
      availableAt: row.available_at,
      paidAt: row.paid_at,
      allocation: [
        row.contribution_percent != null ? `${Number(row.contribution_percent)}% teacher contribution` : null,
        row.teacher_pool_percent != null ? `${Number(row.teacher_pool_percent)}% teacher pool` : null,
        row.contribution_lectures != null ? `${row.contribution_lectures} eligible lecture(s)` : null,
        row.contribution_minutes != null ? `${row.contribution_minutes} eligible minute(s)` : null,
      ].filter(Boolean).join(' · ') || (row.revenue_model ? `Allocation: ${row.revenue_model}` : 'Allocation details not recorded'),
    }));
    const referralRows: HistoryRow[] = commissions.map((row) => {
      const isCourse = row.product_type === 'course';
      const product = isCourse
        ? (courseNames[row.product_id || ''] || 'Course referral')
        : row.product_type === 'mock_test_series'
          ? (seriesNames[row.product_id || ''] || 'Mock-test series referral')
          : `${row.product_type.replace(/_/g, ' ')} referral`;
      return {
        id: `referral-${row.id}`,
        kind: 'Referral commission',
        product,
        date: row.created_at,
        amount: Number(row.commission_amount || 0),
        status: referralStatus(row),
        rate: Number(row.commission_rate || 0),
        gross: Number(row.gross_amount || 0),
        reference: row.transaction_id,
        availableAt: row.available_at,
        allocation: `${Number(row.commission_rate || 0)}% referral rate`,
      };
    });
    return [...courseRows, ...referralRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [earnings, commissions, courseNames, seriesNames, reservedIds]);

  if (loading || busy) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sky-600" /></div>;
  }

  const totalCombined = courseStats.total + referralStats.total;
  const totalPaid = courseStats.paid + referralStats.paid;
  const totalUnpaid = courseStats.pending + referralStats.unpaid;

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Earnings</h1>
            <p className="mt-1 text-sm text-slate-500">Track course contributions, referral commissions, and payout status.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {error && <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
        {referralError && <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertCircle className="h-5 w-5 shrink-0" /><span>{referralError}</span></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total earnings" value={money(totalCombined)} icon={Wallet} detail="Course earnings + referral commissions" />
          <StatCard label="Unpaid earnings" value={money(totalUnpaid)} icon={Clock} detail="Not yet marked as paid" />
          <StatCard label="Course balance available" value={money(courseStats.available)} icon={CheckCircle2} detail="Course earnings past hold, not reserved" />
          <StatCard label="Total paid" value={money(totalPaid)} icon={Banknote} detail="Course earnings and referral commissions marked paid" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Course earnings" value={money(courseStats.total)} icon={BookOpen} detail={`${earnings.length} course earning records`} />
          <StatCard label="Referral commissions" value={money(referralStats.total)} icon={Gift} detail={`${referralStats.records} valid referral records`} />
          <StatCard label="Referral on hold" value={money(referralStats.onHold)} icon={Clock} detail="Waiting for the referral settlement date" />
          <StatCard label="Referral past hold" value={money(referralStats.available)} icon={Users} detail="Past hold; payout eligibility depends on withdrawal setup" />
        </div>

        <Card>
          <CardHeader><CardTitle>Earnings history</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No course earnings or referral commissions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead><tr className="border-b bg-slate-50 text-slate-500">
                    <th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Product</th><th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Purchase amount</th><th className="p-3 font-medium">Rate / allocation</th><th className="p-3 font-medium">Your earning</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Reference</th>
                  </tr></thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3"><span className="whitespace-nowrap">{row.kind}</span></td>
                        <td className="max-w-[240px] p-3 font-medium text-slate-800">{row.product}</td>
                        <td className="whitespace-nowrap p-3">{dateLabel(row.date)}</td>
                        <td className="whitespace-nowrap p-3">{row.gross === undefined ? '—' : money(row.gross)}</td>
                        <td className="min-w-[220px] p-3">
                          {row.rate === undefined
                            ? <span className="text-xs text-slate-600">{row.allocation || '—'}</span>
                            : <div><div>{`${row.rate}% commission`}</div><div className="mt-1 text-xs text-slate-500">{row.allocation || 'Referral commission'}</div></div>}
                        </td>
                        <td className="whitespace-nowrap p-3 font-semibold">{money(row.amount)}</td>
                        <td className="p-3"><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
                        <td className="max-w-[180px] break-all p-3 text-xs text-slate-500">{row.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild><Link href="/dashboard/teacher/withdrawals">Request withdrawal <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
              <Button variant="outline" asChild><Link href="/dashboard/teacher/bank-accounts">Manage bank accounts</Link></Button>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Referral commissions are displayed from their separate ledger. They are included in the totals above, but the existing withdrawal flow may only support course earnings until referral commissions are explicitly connected to withdrawals.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function StatCard({ label, value, icon: Icon, detail }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; detail: string }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900">{value}</p><p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p></div>
        <div className="rounded-xl bg-sky-50 p-3 text-sky-700"><Icon className="h-6 w-6" /></div>
      </CardContent>
    </Card>
  );
}
