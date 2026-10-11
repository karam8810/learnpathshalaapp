'use client';



import { useEffect, useState } from 'react';



import { useRouter } from 'next/navigation';



import Link from 'next/link';



import {



  Loader2,



  BookOpen,



  Video,



  Brain,



  Award,



  TrendingUp,



  ArrowRight,



  Calendar,



  ClipboardCheck,



  GraduationCap,



  PlayCircle,



  Bell,



  Search,



  UserRound,



  Target,



} from 'lucide-react';



import { DashboardShell } from '@/components/dashboard-shell';



import {



  Card,



  CardContent,



  CardHeader,



  CardTitle,



} from '@/components/ui/card';



import { Button } from '@/components/ui/button';



import { Badge } from '@/components/ui/badge';



import { useAuth } from '@/lib/auth-context';



import { supabase } from '@/lib/supabase/client';



type UpcomingClass = {



  id: string;



  title: string;



  start_time: string;



  status: string;



  courses?: { title?: string } | null;



};



type RecentSubmission = {



  id: string;



  score: number;



  total_points: number;



  created_at: string;



  quizzes?: { title?: string } | null;



};



type StudentNotification = {

  id: string;

  notification_id: string;

  is_read: boolean;

  created_at: string;

  notifications: {

    title: string;

    message: string;

    target_url: string | null;

  } | null;

};



type QuickLinkProps = {



  href: string;



  title: string;



  description: string;



  icon: typeof BookOpen;



};



export default function StudentOverviewPage() {



  const { user, profile, loading } = useAuth();



  const router = useRouter();



  const [stats, setStats] = useState({



    enrolled: 0,



    upcomingClasses: 0,



    quizzesTaken: 0,



    avgScore: 0,



  });



  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);



  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);



  const [dataLoading, setDataLoading] = useState(true);



  const [notifications, setNotifications] = useState<StudentNotification[]>([]);

  const [notificationOpen, setNotificationOpen] = useState(false);

  const [notificationError, setNotificationError] = useState("");

  const unreadCount = notifications.filter((item) => !item.is_read).length;



  useEffect(() => {

    if (loading || !user || profile?.role !== 'student') return;



    let cancelled = false;

    const userId = user.id;



    const loadNotifications = async () => {

      const { data, error } = await supabase

        .from('notification_recipients')

        .select(`

          id,

          notification_id,

          is_read,

          created_at,

          notifications (

            title,

            message,

            target_url

          )

        `)

        .eq('student_id', userId)

        .order('created_at', { ascending: false })

        .limit(30);



      if (cancelled) return;

      if (error) {

        console.error('Notification fetch failed:', error);

        setNotificationError('Could not load notifications. Please try again.');

        return;

      }



      setNotificationError('');

      setNotifications((data ?? []) as unknown as StudentNotification[]);

    };



    void loadNotifications();

    const interval = window.setInterval(() => void loadNotifications(), 30000);



    return () => {

      cancelled = true;

      window.clearInterval(interval);

    };

  }, [loading, user?.id, profile?.role]);



  const handleNotificationClick = async (item: StudentNotification) => {

    if (!user || !item.notifications) return;



    if (!item.is_read) {

      const { error } = await supabase

        .from('notification_recipients')

        .update({ is_read: true, read_at: new Date().toISOString() })

        .eq('id', item.id)

        .eq('student_id', user.id);



      if (error) {

        console.error('Mark notification read failed:', error);

        setNotificationError('Could not mark notification as read. Please try again.');

        return;

      }



      setNotifications((previous) =>

        previous.map((notification) =>

          notification.id === item.id

            ? { ...notification, is_read: true }

            : notification

        )

      );

    }



    setNotificationOpen(false);

    const target = item.notifications.target_url;

    if (target?.startsWith('/') && !target.startsWith('//')) {

      router.push(target);

    }

  };





  useEffect(() => {



    if (!loading && (!user || profile?.role !== 'student')) {



      router.replace('/login');



    }



  }, [loading, user, profile?.role, router]);



  useEffect(() => {



    if (loading || !user || profile?.role !== 'student') return;



    // Capture the authenticated user ID before entering the async function.



    // TypeScript does not always preserve the `user` null check inside closures.



    const userId = user.id;



    let cancelled = false;



    async function fetchData() {



      setDataLoading(true);



      try {



        const { data: enrollments, error: enrollmentError } = await supabase



          .from('enrollments')



          .select('course_id, courses(id, title)')



          .eq('student_id', userId);



        if (enrollmentError) throw enrollmentError;



        const courseIds = (enrollments ?? []).map((enrollment) => enrollment.course_id);



        let liveClasses: UpcomingClass[] = [];



        if (courseIds.length > 0) {



          const { data, error } = await supabase



            .from('live_classes')



            .select('*, courses(title)')



            .in('course_id', courseIds)



            .gte('start_time', new Date().toISOString())



            .order('start_time', { ascending: true })



            .limit(5);



          if (error) throw error;



          liveClasses = (data ?? []) as UpcomingClass[];



        }



        const { data: submissions, error: submissionsError } = await supabase



          .from('submissions')



          .select('*, quizzes(title)')



          .eq('student_id', userId)



          .order('created_at', { ascending: false })



          .limit(5);



        if (submissionsError) throw submissionsError;



        const recent = (submissions ?? []) as RecentSubmission[];



        const avgScore = recent.length



          ? Math.round(



              recent.reduce(



                (total, submission) =>



                  total +



                  (submission.total_points > 0



                    ? (submission.score / submission.total_points) * 100



                    : 0),



                0,



              ) / recent.length,



            )



          : 0;



        if (cancelled) return;



        setStats({



          enrolled: enrollments?.length ?? 0,



          upcomingClasses: liveClasses.length,



          quizzesTaken: recent.length,



          avgScore,



        });



        setUpcomingClasses(liveClasses);



        setRecentSubmissions(recent);



      } catch (error) {



        console.error('Failed to load student dashboard:', error);



      } finally {



        if (!cancelled) setDataLoading(false);



      }



    }



    void fetchData();



    return () => {



      cancelled = true;



    };



  }, [loading, profile?.role, user?.id]);



  if (loading || (profile?.role === 'student' && dataLoading)) {



    return (



      <div className="flex min-h-screen items-center justify-center bg-slate-50">



        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />



      </div>



    );



  }



  if (!user || profile?.role !== 'student') return null;



  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Student';



  const statCards = [



    {



      label: 'Enrolled Courses',



      value: stats.enrolled,



      icon: BookOpen,



      color: 'from-blue-500 to-blue-700',



    },



    {



      label: 'Upcoming Classes',



      value: stats.upcomingClasses,



      icon: Video,



      color: 'from-cyan-500 to-blue-500',



    },



    {



      label: 'Quizzes Taken',



      value: stats.quizzesTaken,



      icon: Brain,



      color: 'from-violet-500 to-purple-600',



    },



    {



      label: 'Average Score',



      value: `${stats.avgScore}%`,



      icon: Award,



      color: 'from-emerald-500 to-green-600',



    },



  ];



  return (



    <DashboardShell role="student">



      {/* Mobile app-style home. Header and bottom navigation belong to DashboardShell. */}



      <div className="-mx-4 -mt-6 min-h-screen bg-white pb-8 md:hidden">



        {/* Blue branded header */}



        <header className="bg-gradient-to-br from-[#073B8C] to-[#1767D5] px-4 pb-5 pt-4 text-white">



          <div className="flex items-center justify-between gap-3">



            <Link href="/dashboard/student" className="flex min-w-0 items-center gap-3">



              <img



                src="/learnpathshalalogo.png"



                alt="LearnPathshala logo"



                className="h-11 w-11 shrink-0 rounded-xl bg-white p-1 object-contain"



              />



              <span className="min-w-0">



                <span className="block truncate text-lg font-extrabold">



                  LearnPathshala



                </span>



                <span className="block text-xs text-blue-100">



                  Learn. Practice. Succeed.



                </span>



              </span>



            </Link>



            <div className="flex shrink-0 items-center gap-2">



              <div className="relative">

                <button

                  type="button"

                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}

                  aria-expanded={notificationOpen}

                  onClick={() => setNotificationOpen((value) => !value)}

                  className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10"

                >

                  <Bell size={20} />

                  {unreadCount > 0 && (

                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">

                      {unreadCount > 99 ? '99+' : unreadCount}

                    </span>

                  )}

                </button>



                {notificationOpen && (

                  <>

                    <button

                      type="button"

                      aria-label="Close notifications"

                      className="fixed inset-0 z-40 cursor-default"

                      onClick={() => setNotificationOpen(false)}

                    />

                    <section className="fixed right-3 top-[72px] z-[100] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl sm:right-4">

                      <div className="border-b border-slate-100 p-4">

                        <p className="font-bold">Notifications</p>

                        <p className="text-xs text-slate-500">{unreadCount} unread</p>

                      </div>

                      <div className="max-h-80 overflow-y-auto">

                        {notificationError ? (

                          <p className="p-4 text-sm text-red-600">{notificationError}</p>

                        ) : notifications.length === 0 ? (

                          <p className="p-5 text-center text-sm text-slate-500">No notifications yet.</p>

                        ) : (

                          notifications.map((item) => {

                            if (!item.notifications) return null;

                            return (

                              <button

                                key={item.id}

                                type="button"

                                onClick={() => void handleNotificationClick(item)}

                                className={`flex w-full gap-3 border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${!item.is_read ? 'bg-blue-50' : ''}`}

                              >

                                <span className="min-w-0 flex-1">

                                  <span className="block text-sm font-semibold">{item.notifications.title}</span>

                                  <span className="mt-1 block text-xs text-slate-600">{item.notifications.message}</span>

                                  <span className="mt-2 block text-[10px] text-slate-400">

                                    {new Date(item.created_at).toLocaleString()}

                                  </span>

                                </span>

                                {!item.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}

                              </button>

                            );

                          })

                        )}

                      </div>

                    </section>

                  </>

                )}

              </div>



              <Link



                href="/dashboard/student/profile"



                aria-label="My profile"



                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-700"



              >



                {firstName.charAt(0).toUpperCase()}



              </Link>



            </div>



          </div>



          <form



            className="mt-5 flex items-center gap-3 rounded-2xl border border-white/20 bg-white px-4 py-3 text-slate-500 shadow-sm"



            onSubmit={(event) => {



              event.preventDefault();



              router.push('/dashboard/student/mock-tests');



            }}



          >



            <Search size={19} className="shrink-0" />



            <input



              type="search"



              aria-label="Search courses and mock tests"



              placeholder="Search courses, mock tests..."



              className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"



            />



          </form>



        </header>



        <div className="space-y-8 px-4 py-5">



          {/* Welcome */}



          <section>



            <p className="text-sm text-slate-500">Welcome back,</p>



            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">



              {firstName} 👋



            </h1>



            <p className="mt-1 text-sm text-slate-500">



              Your next achievement starts here.



            </p>



          </section>



          {/* Promotional banner */}



          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-5 text-white shadow-lg">



            <div className="relative z-10 max-w-[78%]">



              <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">



                Prepare smarter



              </span>



              <h2 className="mt-3 text-2xl font-extrabold leading-tight">



                Your exam. Your success.



              </h2>



              <p className="mt-2 text-sm leading-5 text-blue-100">



                Practice mock tests and track your preparation.



              </p>



              <Link



                href="/dashboard/student/mock-tests"



                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700"



              >



                Start practising <ArrowRight size={16} />



              </Link>



            </div>



            <GraduationCap



              size={112}



              className="absolute -bottom-3 -right-4 text-white/15"



              aria-hidden="true"



            />



          </section>



          {/* Featured mock tests */}



          <section>



            <div className="mb-4 flex items-center justify-between">



              <div className="border-l-4 border-rose-500 pl-3">



                <h2 className="text-lg font-extrabold text-slate-900">



                  Featured for You



                </h2>



                <p className="text-xs text-slate-500">



                  Continue your exam preparation



                </p>



              </div>



              <Link



                href="/dashboard/student/mock-tests"



                className="text-xs font-bold text-blue-700"



              >



                View all



              </Link>



            </div>



            <Link



              href="/dashboard/student/mock-tests"



              className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"



            >



              <div className="bg-gradient-to-r from-amber-50 to-orange-100 p-4">



                <div className="flex items-center justify-between">



                  <span className="rounded-full bg-amber-400 px-3 py-1 text-[10px] font-extrabold uppercase text-amber-950">



                    Start today



                  </span>



                  <ClipboardCheck size={28} className="text-blue-700" />



                </div>



                <h3 className="mt-3 text-lg font-extrabold text-slate-900">



                  Mock Test Series



                </h3>



                <p className="mt-1 text-sm text-slate-600">



                  Practise questions and improve your score.



                </p>



                <div className="mt-4 flex items-center justify-between">



                  <span className="text-sm font-bold text-blue-700">



                    Explore test series



                  </span>



                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm">



                    <ArrowRight size={18} />



                  </span>



                </div>



              </div>



            </Link>



          </section>



          {/* Exam categories */}



          <section>



            <div className="mb-4 border-l-4 border-rose-500 pl-3">



              <h2 className="text-lg font-extrabold text-slate-900">Find by Exam</h2>



              <p className="text-xs text-slate-500">Choose your preparation category</p>



            </div>



            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">



              {[



                { name: 'SSC', symbol: 'S', color: 'bg-blue-50 text-blue-700' },



                { name: 'Banking', symbol: '₹', color: 'bg-emerald-50 text-emerald-700' },



                { name: 'Railway', symbol: 'R', color: 'bg-orange-50 text-orange-700' },



                { name: 'Teaching', symbol: 'T', color: 'bg-violet-50 text-violet-700' },



                { name: 'Haryana', symbol: 'H', color: 'bg-rose-50 text-rose-700' },



              ].map((exam) => (



                <Link



                  key={exam.name}



                  href="/dashboard/student/mock-tests"



                  className="flex min-w-[88px] flex-col items-center rounded-2xl border border-slate-100 bg-white px-3 py-4 shadow-sm"



                >



                  <span className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold ${exam.color}`}>



                    {exam.symbol}



                  </span>



                  <span className="mt-2 text-xs font-semibold text-slate-700">



                    {exam.name}



                  </span>



                </Link>



              ))}



            </div>



          </section>



          {/* Products */}



          <section>



            <div className="mb-4 border-l-4 border-rose-500 pl-3">



              <h2 className="text-lg font-extrabold text-slate-900">Browse by Product</h2>



              <p className="text-xs text-slate-500">Everything you need to learn</p>



            </div>



            <div className="space-y-3">



              <MobileQuickLink



                href="/dashboard/student/mock-tests"



                title="Mock Tests"



                description="Practice questions and analyse your preparation"



                icon={ClipboardCheck}



              />



              <MobileQuickLink



                href="/dashboard/student/courses"



                title="My Courses"



                description="Continue your enrolled courses"



                icon={BookOpen}



              />



              <MobileQuickLink



                href="/dashboard/student/live-classes"



                title="Live Classes"



                description="Check your upcoming classes"



                icon={Video}



              />



              <MobileQuickLink



                href="/dashboard/student/recorded-classes"



                title="Recorded Classes"



                description="Learn at your own pace"



                icon={PlayCircle}



              />



            </div>



          </section>



          {/* Progress */}



          <section>



            <div className="mb-4 border-l-4 border-rose-500 pl-3">



              <h2 className="text-lg font-extrabold text-slate-900">Your Progress</h2>



            </div>



            <div className="grid grid-cols-2 gap-3">



              {statCards.map((stat) => {



                const Icon = stat.icon;



                return (



                  <div



                    key={stat.label}



                    className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"



                  >



                    <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} text-white`}>



                      <Icon size={20} />



                    </div>



                    <p className="text-xs text-slate-500">{stat.label}</p>



                    <p className="mt-1 text-2xl font-extrabold text-slate-900">



                      {stat.value}



                    </p>



                  </div>



                );



              })}



            </div>



          </section>



          {/* Upcoming classes */}



          <section>



            <div className="mb-4 flex items-center justify-between">



              <h2 className="text-lg font-extrabold text-slate-900">Upcoming Classes</h2>



              <Link href="/dashboard/student/live-classes" className="text-xs font-bold text-blue-700">



                View all



              </Link>



            </div>



            {upcomingClasses.length === 0 ? (



              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">



                <Video size={28} className="mx-auto text-slate-400" />



                <p className="mt-2 text-sm font-semibold text-slate-700">No upcoming classes</p>



                <p className="mt-1 text-xs text-slate-500">



                  Enroll in a course to see scheduled classes here.



                </p>



              </div>



            ) : (



              <div className="space-y-3">



                {upcomingClasses.map((item) => (



                  <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3">



                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">



                      <Video size={20} />



                    </span>



                    <div className="min-w-0 flex-1">



                      <p className="text-sm font-bold text-slate-900">{item.title}</p>



                      <p className="mt-1 text-xs text-slate-500">{item.courses?.title}</p>



                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">



                        <Calendar size={13} />



                        {new Date(item.start_time).toLocaleString()}



                      </p>



                      {item.status === 'live' && (



                        <Badge variant="destructive" className="mt-2">Live now</Badge>



                      )}



                    </div>



                  </div>



                ))}



              </div>



            )}



          </section>



          {/* Recent results */}



          <section className="pb-3">



            <div className="mb-4 flex items-center justify-between">



              <h2 className="text-lg font-extrabold text-slate-900">Recent Results</h2>



              <Link href="/dashboard/student/quizzes" className="text-xs font-bold text-blue-700">



                View all



              </Link>



            </div>



            {recentSubmissions.length === 0 ? (



              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center">



                <Award size={28} className="mx-auto text-slate-400" />



                <p className="mt-2 text-sm font-semibold text-slate-700">No results yet</p>



                <p className="mt-1 text-xs text-slate-500">



                  Your quiz results will appear here.



                </p>



              </div>



            ) : (



              <div className="space-y-3">



                {recentSubmissions.map((submission) => {



                  const score = submission.total_points > 0



                    ? Math.round((submission.score / submission.total_points) * 100)



                    : 0;



                  return (



                    <div key={submission.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">



                      <Award className="shrink-0 text-blue-600" size={24} />



                      <div className="min-w-0 flex-1">



                        <p className="truncate text-sm font-bold text-slate-900">



                          {submission.quizzes?.title || 'Quiz'}



                        </p>



                        <p className="text-xs text-slate-500">



                          {new Date(submission.created_at).toLocaleDateString()}



                        </p>



                      </div>



                      <span className="rounded-lg bg-blue-50 px-2 py-1 text-sm font-bold text-blue-700">



                        {score}%



                      </span>



                    </div>



                  );



                })}



              </div>



            )}



          </section>



        </div>



      </div>



      {/* Desktop dashboard remains separate and unchanged in layout */}



      <div className="hidden md:block">



        <div className="mb-8">



          <h1 className="text-2xl font-bold text-slate-900">



            Welcome back, {firstName}!



          </h1>



          <p className="text-sm text-slate-500">Continue your learning journey</p>



        </div>



        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">



          {statCards.map((stat) => {



            const Icon = stat.icon;



            return (



              <Card key={stat.label} className="border-slate-200 shadow-sm">



                <CardContent className="p-5">



                  <div className="flex items-center justify-between">



                    <div>



                      <p className="text-sm font-medium text-slate-500">{stat.label}</p>



                      <p className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</p>



                    </div>



                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color} shadow-lg`}>



                      <Icon className="h-6 w-6 text-white" />



                    </div>



                  </div>



                </CardContent>



              </Card>



            );



          })}



        </div>



        <div className="mt-8 grid gap-6 lg:grid-cols-2">



          <Card className="border-slate-200 shadow-sm">



            <CardHeader>



              <CardTitle className="flex items-center gap-2 text-lg">



                <Video className="h-5 w-5 text-red-500" />



                Upcoming Live Classes



              </CardTitle>



            </CardHeader>



            <CardContent>



              <div className="space-y-3">



                {upcomingClasses.length === 0 ? (



                  <p className="text-sm text-slate-500">



                    No upcoming classes. Enroll in a course to see classes here.



                  </p>



                ) : (



                  upcomingClasses.map((item) => (



                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">



                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">



                        <Video className="h-5 w-5 text-red-500" />



                      </div>



                      <div className="flex-1">



                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>



                        <div className="text-xs text-slate-500">



                          {item.courses?.title} - {new Date(item.start_time).toLocaleString()}



                        </div>



                      </div>



                      {item.status === 'live' && <span className="live-dot" />}



                      <Badge variant={item.status === 'live' ? 'destructive' : 'outline'}>



                        {item.status}



                      </Badge>



                    </div>



                  ))



                )}



              </div>



              <Link href="/dashboard/student/live-classes" className="mt-4 block">



                <Button variant="outline" className="w-full">



                  View all classes <ArrowRight className="ml-2 h-4 w-4" />



                </Button>



              </Link>



            </CardContent>



          </Card>



          <Card className="border-slate-200 shadow-sm">



            <CardHeader>



              <CardTitle className="flex items-center gap-2 text-lg">



                <TrendingUp className="h-5 w-5 text-emerald-500" />



                Recent Quiz Results



              </CardTitle>



            </CardHeader>



            <CardContent>



              <div className="space-y-3">



                {recentSubmissions.length === 0 ? (



                  <p className="text-sm text-slate-500">



                    No quizzes taken yet. Take your first quiz!



                  </p>



                ) : (



                  recentSubmissions.map((submission) => {



                    const score = submission.total_points > 0



                      ? Math.round((submission.score / submission.total_points) * 100)



                      : 0;



                    return (



                      <div key={submission.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">



                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${score >= 70 ? 'bg-emerald-100' : 'bg-amber-100'}`}>



                          <Award className={`h-5 w-5 ${score >= 70 ? 'text-emerald-600' : 'text-amber-600'}`} />



                        </div>



                        <div className="flex-1">



                          <div className="text-sm font-semibold text-slate-900">



                            {submission.quizzes?.title || 'Quiz'}



                          </div>



                          <div className="text-xs text-slate-500">



                            {new Date(submission.created_at).toLocaleDateString()}



                          </div>



                        </div>



                        <Badge



                          variant={score >= 70 ? 'default' : 'secondary'}



                          className={score >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}



                        >



                          {score}%



                        </Badge>



                      </div>



                    );



                  })



                )}



              </div>



              <Link href="/student/mock-tests/results" className="mt-4 block">



                <Button variant="outline" className="w-full">



                  View all quizzes <ArrowRight className="ml-2 h-4 w-4" />



                </Button>



              </Link>



            </CardContent>



          </Card>



        </div>



      </div>



    </DashboardShell>



  );



}



function MobileQuickLink({ href, title, description, icon: Icon }: QuickLinkProps) {



  return (



    <Link



      href={href}



      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition active:scale-[0.99]"



    >



      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">



        <Icon size={22} />



      </span>



      <span className="min-w-0 flex-1">



        <span className="block text-sm font-bold text-slate-900">{title}</span>



        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>



      </span>



      <ArrowRight size={17} className="shrink-0 text-slate-400" />



    </Link>



  );



}
