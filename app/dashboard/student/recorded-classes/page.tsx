

'use client';



import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import {

  ArrowLeft,

  BookOpen,

  CalendarDays,

  CheckCircle2,

  ChevronRight,

  Clock3,

  GraduationCap,

  Layers3,

  Loader2,

  PlayCircle,

  RefreshCw,

  Search,

  UserRound,

  Video,

  Wifi,

} from 'lucide-react';

import learnpathshalalogo from '../../../../public/learnpathshalalogo.png'

import { DashboardShell } from '@/components/dashboard-shell';

import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';

import { Card, CardContent } from '@/components/ui/card';

import { useAuth } from '@/lib/auth-context';

import { supabase } from '@/lib/supabase/client';



const STORAGE_BUCKET = 'recorded-class-videos';

const SIGNED_URL_SECONDS = 60 * 60;

const UNASSIGNED_SUBJECT = '__unassigned__';



type Course = {

  id: string;

  title: string;

  description?: string | null;

};



type Subject = {

  id: string;

  course_id: string;

  name: string;

  description?: string | null;

  display_order: number;

};



type ClassItem = {

  id: string;

  title: string;

  description: string | null;

  course_id: string;

  teacher_id: string | null;

  start_time: string;

  duration_minutes: number | null;

  status: string;

  recording_url: string | null;

  recording_path: string | null;

  subject_id: string | null;

  course_title: string;

  teacher_name: string;

  playback_url?: string | null;

  playback_error?: string | null;

  meeting_link: string | null;

};



type ClassTab = 'recordings' | 'upcoming';



export default function StudentRecordedClassesPage() {

  const { user, profile, loading } = useAuth();

  const router = useRouter();



  const [courses, setCourses] = useState<Course[]>([]);

  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>([]);



  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const [activeTab, setActiveTab] = useState<ClassTab>('recordings');



  const [search, setSearch] = useState('');

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);



  const [dataLoading, setDataLoading] = useState(true);

  const [playerLoading, setPlayerLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');



  // ---------------------------------------------------------

  // AUTH

  // ---------------------------------------------------------



  useEffect(() => {

    if (!loading && (!user || profile?.role !== 'student')) {

      router.replace('/login');

    }

  }, [loading, user, profile, router]);



  // ---------------------------------------------------------

  // FETCH COURSES, SUBJECTS, CLASSES AND TEACHERS

  // ---------------------------------------------------------



  const fetchData = useCallback(async () => {

    if (!user) return;



    setDataLoading(true);

    setErrorMessage('');



    try {

      // 1. Get the student's enrolled course IDs.

      const { data: enrollmentRows, error: enrollmentError } =

        await supabase

          .from('enrollments')

          .select('course_id')
          .eq('student_id', user.id)
          .in('status', ['active', 'completed']);



      if (enrollmentError) throw enrollmentError;



      const courseIds = Array.from(

        new Set(

          (enrollmentRows ?? [])

            .map((row) => row.course_id)

            .filter((id): id is string => Boolean(id))

        )

      );



      if (courseIds.length === 0) {

        setCourses([]);

        setSubjects([]);

        setClasses([]);

        setSelectedCourseId('');

        setSelectedSubjectId('');

        return;

      }



      // 2. Load enrolled courses.

      const { data: courseRows, error: courseError } =

        await supabase

          .from('courses')

          .select('id, title, description')

          .in('id', courseIds)

          .order('title');



      if (courseError) throw courseError;



      const courseList = (courseRows ?? []) as Course[];



      setCourses(courseList);



      // Keep the current selection when possible.

      const currentCourseStillExists = courseList.some(

        (course) => course.id === selectedCourseId

      );



      const activeCourseId = currentCourseStillExists

        ? selectedCourseId

        : courseList[0]?.id ?? '';



      setSelectedCourseId(activeCourseId);



      if (!activeCourseId) {

        setSubjects([]);

        setClasses([]);

        return;

      }



      // 3. Load subjects for enrolled courses.

      // "as any" allows this to compile even when your local

      // Supabase Database type has not been regenerated yet.

      const { data: subjectRows, error: subjectError } =

        await (supabase.from('course_subjects' as any) as any)

          .select(

            'id, course_id, name, description, display_order'

          )

          .in('course_id', courseIds)

          .eq('is_active', true)

          .order('display_order', { ascending: true });



      if (subjectError) throw subjectError;



      const subjectList = (subjectRows ?? []) as Subject[];



      setSubjects(subjectList);



      // 4. Load classes from the student's enrolled courses.

      // Select * so the new subject_id column is included.

      const { data: classRows, error: classError } =

        await supabase

          .from('live_classes')

          .select('*, courses(title)')

          .in('course_id', courseIds)

          .order('start_time', { ascending: false });



      if (classError) throw classError;



      const rows = (classRows ?? []) as any[];



      // 5. Load teacher names separately to avoid relying on

      // a particular Supabase relationship name.

      const teacherIds = Array.from(

        new Set(

          rows

            .map((item) => item.teacher_id)

            .filter(Boolean)

        )

      );



      const teacherMap = new Map<string, string>();



      if (teacherIds.length > 0) {

        const { data: teachers, error: teacherError } =

          await supabase

            .from('profiles')

            .select('id, full_name')

            .in('id', teacherIds);



        if (teacherError) {

          console.warn('Teacher lookup failed:', teacherError.message);

        } else {

          (teachers ?? []).forEach((teacher) => {

            teacherMap.set(

              teacher.id,

              teacher.full_name || 'Teacher'

            );

          });

        }

      }

const classList: ClassItem[] = rows.map((item) => ({

  id: item.id,

  title: item.title || 'Recorded Class',

  description: item.description || null,

  course_id: item.course_id,

  teacher_id: item.teacher_id || null,

  start_time: item.start_time,

  duration_minutes: item.duration_minutes ?? null,

  status: item.status || 'scheduled',

  meeting_link: item.meeting_link || null,

  recording_url: item.recording_url || null,

  recording_path: item.recording_path || null,

  subject_id: item.subject_id || null,

  course_title: item.courses?.title || 'Course',

  teacher_name: item.teacher_id

    ? teacherMap.get(item.teacher_id) || 'Teacher'

    : 'Teacher',

}));



      setClasses(classList);



      // Preserve the selected subject if it still exists.

      setSelectedSubjectId((current) => {

        if (!current) return '';



        const exists = subjectList.some(

          (subject) =>

            subject.course_id === activeCourseId &&

            subject.id === current

        );



        if (

          current === UNASSIGNED_SUBJECT &&

          classList.some(

            (item) =>

              item.course_id === activeCourseId &&

              !item.subject_id

          )

        ) {

          return current;

        }



        return exists ? current : '';

      });

    } catch (error: any) {

      console.error('Recorded classes fetch failed:', error);



      setErrorMessage(

        error?.message || 'Unable to load your classes.'

      );

    } finally {

      setDataLoading(false);

    }

  }, [user, selectedCourseId]);



  useEffect(() => {

    if (profile?.role === 'student' && user) {

      fetchData();

    }

  }, [profile?.role, user, fetchData]);



  // ---------------------------------------------------------

  // FILTER SUBJECTS AND CLASSES

  // ---------------------------------------------------------



  const courseSubjects = useMemo(

    () =>

      subjects.filter(

        (subject) => subject.course_id === selectedCourseId

      ),

    [subjects, selectedCourseId]

  );



  const courseClasses = useMemo(

    () =>

      classes.filter(

        (item) => item.course_id === selectedCourseId

      ),

    [classes, selectedCourseId]

  );



  const hasUnassignedClasses = courseClasses.some(

    (item) => !item.subject_id

  );



  const visibleClasses = useMemo(() => {

    const now = Date.now();



    return courseClasses.filter((item) => {

      // Subject filter.

      if (

        selectedSubjectId &&

        selectedSubjectId !== UNASSIGNED_SUBJECT &&

        item.subject_id !== selectedSubjectId

      ) {

        return false;

      }



      if (

        selectedSubjectId === UNASSIGNED_SUBJECT &&

        item.subject_id

      ) {

        return false;

      }



      // Recordings and upcoming classes use different filters.

      if (activeTab === 'recordings') {

        const hasRecording = Boolean(

          item.recording_path || item.recording_url

        );



        if (item.status !== 'completed' || !hasRecording) {

          return false;

        }

      } else {

        const isUpcoming =

          item.status === 'scheduled' ||

          item.status === 'live' ||

          (

            new Date(item.start_time).getTime() >= now &&

            item.status !== 'completed' &&

            item.status !== 'cancelled'

          );



        if (!isUpcoming) return false;

      }



      const query = search.trim().toLowerCase();



      if (!query) return true;



      const subjectName =

        subjects.find((s) => s.id === item.subject_id)?.name || '';



      return [

        item.title,

        item.description || '',

        item.course_title,

        item.teacher_name,

        subjectName,

      ].some((value) => value.toLowerCase().includes(query));

    });

  }, [

    courseClasses,

    activeTab,

    selectedSubjectId,

    search,

    subjects,

  ]);



  const recordingsCount = courseClasses.filter(

    (item) =>

      item.status === 'completed' &&

      Boolean(item.recording_path || item.recording_url)

  ).length;



  const upcomingCount = courseClasses.filter(

    (item) =>

      item.status === 'live' ||

      (

        item.status === 'scheduled' &&

        new Date(item.start_time).getTime() >= Date.now()

      )

  ).length;



  // ---------------------------------------------------------

  // OPEN A RECORDING WITH A FRESH SIGNED URL

  // ---------------------------------------------------------



  const openRecording = async (item: ClassItem) => {
    if (!user) {
      setErrorMessage('Please sign in to watch this recording.');
      return;
    }

    if (item.status !== 'completed') {
      setErrorMessage('This recording is not available yet.');
      return;
    }

    setPlayerLoading(true);
    setErrorMessage('');

    try {
      // Private recordings must use their Storage path and a signed URL.
      // Supabase Storage RLS remains the server-side authorization boundary.
      if (!item.recording_path) {
        throw new Error(
          'This recording does not have a private storage path. Please contact your teacher.'
        );
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(item.recording_path, SIGNED_URL_SECONDS);

      if (error) throw error;
      if (!data?.signedUrl) {
        throw new Error('Supabase did not return a video link.');
      }

      setSelectedClass({
        ...item,
        playback_url: data.signedUrl,
        playback_error: null,
      });
    } catch (error: unknown) {
      console.error('Could not open recording:', error);
      const message = error instanceof Error
        ? error.message
        : 'Unable to open this recording.';

      setSelectedClass({
        ...item,
        playback_url: null,
        playback_error: message,
      });
    } finally {
      setPlayerLoading(false);
    }
  };

    const getYouTubeEmbedUrl = (url: string) => {

    try {

      const parsed = new URL(url);

      let videoId: string | null = null;



      if (parsed.hostname.includes('youtu.be')) {

        videoId = parsed.pathname.split('/').filter(Boolean)[0];

      } else if (parsed.hostname.includes('youtube.com')) {

        videoId =

          parsed.searchParams.get('v') ||

          parsed.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1] ||

          null;

      }



      return videoId

        ? `https://www.youtube-nocookie.com/embed/${videoId}`

        : null;

    } catch {

      return null;

    }

  };



  // ---------------------------------------------------------

  // LOADING AND AUTH STATES

  // ---------------------------------------------------------



  if (loading || (dataLoading && !classes.length && !errorMessage)) {

    return (

      <div className="flex min-h-screen items-center justify-center bg-slate-50">

        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />

      </div>

    );

  }



  if (!user || profile?.role !== 'student') {

    return null;

  }



  // ---------------------------------------------------------

  // PLAYER VIEW

  // ---------------------------------------------------------



  if (selectedClass) {

 const videoUrl = selectedClass.playback_url || '';

const youtubeEmbedUrl = videoUrl

  ? getYouTubeEmbedUrl(videoUrl)

  : null;



    const subjectName =

      subjects.find((s) => s.id === selectedClass.subject_id)?.name;



    return (

      <DashboardShell role="student" hideMobileHeader>

        <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">

          <button

            type="button"

            onClick={() => setSelectedClass(null)}

            className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-blue-700 hover:text-blue-900"

          >

            <ArrowLeft className="h-4 w-4" />

            Back to classes

          </button>



          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">

            <img

              src={learnpathshalalogo.src}

              alt="LearnPathshala logo"

              className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-contain p-1"

            />

            <div className="min-w-0">

              <h1 className="text-lg font-bold text-slate-900">

                LearnPathshala

              </h1>

              <p className="text-xs text-slate-500">

                Learn. Practice. Achieve.

              </p>

            </div>

          </div>



          <div className="space-y-2">

            <div className="flex flex-wrap gap-2">

              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">

                Recorded class

              </Badge>

              {subjectName && (

                <Badge variant="outline">{subjectName}</Badge>

              )}

            </div>



            <h2 className="text-2xl font-bold leading-tight text-slate-900">

              {selectedClass.title}

            </h2>



            <p className="text-sm text-slate-500">

              {selectedClass.course_title}

            </p>



            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs text-slate-500">

              <span className="inline-flex items-center gap-1.5">

                <UserRound className="h-4 w-4" />

                {selectedClass.teacher_name}

              </span>



              <span className="inline-flex items-center gap-1.5">

                <CalendarDays className="h-4 w-4" />

                {new Date(selectedClass.start_time).toLocaleDateString()}

              </span>



              <span className="inline-flex items-center gap-1.5">

                <Clock3 className="h-4 w-4" />

                {selectedClass.duration_minutes || 0} minutes

              </span>

            </div>

          </div>



          {selectedClass.playback_error && (

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">

              <p className="font-semibold">Recording unavailable</p>

              <p className="mt-1 break-words">

                {selectedClass.playback_error}

              </p>

              <Button

                variant="outline"

                size="sm"

                className="mt-3"

                onClick={() => openRecording(selectedClass)}

              >

                Try again

              </Button>

            </div>

          )}



          {youtubeEmbedUrl !== null ? (

  <div

    className="overflow-hidden rounded-2xl bg-black shadow-lg"

    style={{ aspectRatio: '16 / 9' }}

  >

    <iframe

      src={youtubeEmbedUrl}

      title={selectedClass.title}

      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"

      allowFullScreen

      className="h-full w-full"

    />

  </div>

          ) : videoUrl ? (

            <div

              className="overflow-hidden rounded-2xl bg-black shadow-lg"

              style={{ aspectRatio: '16 / 9' }}

              onContextMenu={(event) => event.preventDefault()}

            >

              <video

                src={videoUrl}

                controls

                controlsList="nodownload noremoteplayback"

                disablePictureInPicture

                playsInline

                preload="metadata"

                onContextMenu={(event) => event.preventDefault()}

                className="h-full w-full"

              >

                Your browser does not support video playback.

              </video>

            </div>

          ) : (

            <div className="flex aspect-video flex-col items-center justify-center rounded-2xl bg-slate-950 p-6 text-center text-white">

              <Video className="mb-3 h-12 w-12 text-blue-300" />

              <p className="font-semibold">

                The video could not be loaded

              </p>

              <p className="mt-2 max-w-sm text-sm text-slate-300">

                Check your internet connection or try generating the video link again.

              </p>

            </div>

          )}



          <Card className="border-slate-200 shadow-sm">

            <CardContent className="p-4 sm:p-5">

              <h3 className="font-bold text-slate-900">About this class</h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">

                {selectedClass.description ||

                  'Watch this lesson and continue your preparation.'}

              </p>

            </CardContent>

          </Card>

        </div>

      </DashboardShell>

    );

  }



  // ---------------------------------------------------------

  // MAIN RECORDED CLASSES PAGE

  // ---------------------------------------------------------



  return (

    <DashboardShell role="student" hideMobileHeader>

      <div className="mx-auto w-full max-w-7xl space-y-6 pb-6">

        {/* LearnPathshala branded header */}

        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-1 py-3 sm:px-3">

          <div className="flex min-w-0 items-center gap-3">

            <img

              src={learnpathshalalogo.src}

              alt="LearnPathshala logo"

              className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"

            />

            <div className="min-w-0">

              <h1 className="truncate text-base font-extrabold tracking-tight text-blue-950 sm:text-lg">

                LearnPathshala

              </h1>

              <p className="text-xs text-slate-500">

                Learn. Practice. Achieve.

              </p>

            </div>

          </div>



          <Badge className="shrink-0 bg-blue-50 text-blue-700 hover:bg-blue-50">

            <GraduationCap className="mr-1 h-4 w-4" />

            Student

          </Badge>

        </header>



        {/* Page introduction */}

        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-800 via-blue-700 to-blue-500 p-5 text-white shadow-md sm:p-7">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">

            Your learning space

          </p>



          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">

            Recorded Classes

          </h2>



          <p className="mt-2 max-w-xl text-sm leading-6 text-blue-50">

            Learn at your own pace. Choose your course, explore a subject,

            and continue watching your lessons.

          </p>



          <div className="mt-5 flex flex-wrap gap-3">

            <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm">

              <PlayCircle className="h-5 w-5" />

              <span>

                {recordingsCount} recording{recordingsCount === 1 ? '' : 's'}

              </span>

            </div>



            <div className="flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm">

              <CalendarDays className="h-5 w-5" />

              <span>{upcomingCount} upcoming/live</span>

            </div>

          </div>

        </section>



        {/* Errors */}

        {errorMessage && (

          <div className="rounded-xl border border-red-200 bg-red-50 p-4">

            <p className="text-sm font-semibold text-red-800">

              Could not load classes

            </p>

            <p className="mt-1 break-words text-sm text-red-700">

              {errorMessage}

            </p>

            <Button

              size="sm"

              variant="outline"

              className="mt-3"

              onClick={fetchData}

            >

              <RefreshCw className="mr-2 h-4 w-4" />

              Try again

            </Button>

          </div>

        )}



        {/* Course selector */}

        <section className="space-y-3">

          <div className="flex items-center justify-between gap-3">

            <div>

              <h2 className="text-lg font-bold text-slate-900">

                My courses

              </h2>

              <p className="text-xs text-slate-500">

                Select a course to explore its classes

              </p>

            </div>



            <button

              type="button"

              aria-label="Refresh classes"

              onClick={fetchData}

              disabled={dataLoading}

              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"

            >

              <RefreshCw

                className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`}

              />

            </button>

          </div>



          {courses.length === 0 ? (

            <Card className="border-dashed border-slate-300 shadow-none">

              <CardContent className="flex flex-col items-center px-5 py-9 text-center">

                <BookOpen className="h-10 w-10 text-slate-300" />

                <h3 className="mt-3 font-semibold text-slate-800">

                  No enrolled courses yet

                </h3>

                <p className="mt-1 max-w-sm text-sm text-slate-500">

                  Your recorded classes will appear here after you enroll

                  in a course.

                </p>

              </CardContent>

            </Card>

          ) : (

            <div className="flex gap-3 overflow-x-auto pb-2">

              {courses.map((course) => {

                const isActive = course.id === selectedCourseId;



                const count = classes.filter(

                  (item) =>

                    item.course_id === course.id &&

                    item.status === 'completed' &&

                    Boolean(item.recording_path || item.recording_url)

                ).length;



                return (

                  <button

                    key={course.id}

                    type="button"

                    onClick={() => {

                      setSelectedCourseId(course.id);

                      setSelectedSubjectId('');

                      setSearch('');

                    }}

                    className={`min-w-[220px] max-w-[280px] flex-1 rounded-2xl border p-4 text-left transition ${

                      isActive

                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-200'

                        : 'border-slate-200 bg-white hover:border-blue-300'

                    }`}

                  >

                    <div className="flex items-start justify-between gap-3">

                      <div

                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${

                          isActive

                            ? 'bg-blue-600 text-white'

                            : 'bg-blue-50 text-blue-600'

                        }`}

                      >

                        <BookOpen className="h-5 w-5" />

                      </div>



                      {isActive && (

                        <CheckCircle2 className="h-5 w-5 text-blue-600" />

                      )}

                    </div>



                    <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-900">

                      {course.title}

                    </p>



                    <p className="mt-1 text-xs text-slate-500">

                      {count} recorded lesson{count === 1 ? '' : 's'}

                    </p>

                  </button>

                );

              })}

            </div>

          )}

        </section>



        {selectedCourseId && (

          <>

            {/* Subject navigation */}

            <section className="space-y-3">

              <div>

                <h2 className="text-lg font-bold text-slate-900">

                  Subject-wise classes

                </h2>

                <p className="text-xs text-slate-500">

                  Choose a subject or browse every class in this course.

                </p>

              </div>



              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">

                <button

                  type="button"

                  onClick={() => setSelectedSubjectId('')}

                  className={`flex min-h-[84px] items-center gap-3 rounded-xl border p-3 text-left transition ${

                    !selectedSubjectId

                      ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-200'

                      : 'border-slate-200 bg-white hover:border-blue-300'

                  }`}

                >

                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">

                    <Layers3 className="h-5 w-5" />

                  </span>

                  <span className="min-w-0 flex-1">

                    <span className="block text-sm font-semibold text-slate-900">

                      All subjects

                    </span>

                    <span className="mt-1 block text-xs text-slate-500">

                      Browse all

                    </span>

                  </span>

                </button>



                {courseSubjects.map((subject) => {

                  const isActive = selectedSubjectId === subject.id;



                  return (

                    <button

                      key={subject.id}

                      type="button"

                      onClick={() => setSelectedSubjectId(subject.id)}

                      className={`flex min-h-[84px] items-center gap-3 rounded-xl border p-3 text-left transition ${

                        isActive

                          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-200'

                          : 'border-slate-200 bg-white hover:border-blue-300'

                      }`}

                    >

                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-blue-700">

                        {subject.name.slice(0, 1).toUpperCase()}

                      </span>



                      <span className="min-w-0 flex-1">

                        <span className="block line-clamp-2 text-sm font-semibold text-slate-900">

                          {subject.name}

                        </span>

                        <span className="mt-1 block text-xs text-slate-500">

                          View classes

                        </span>

                      </span>



                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />

                    </button>

                  );

                })}



                {hasUnassignedClasses && (

                  <button

                    type="button"

                    onClick={() =>

                      setSelectedSubjectId(UNASSIGNED_SUBJECT)

                    }

                    className={`flex min-h-[84px] items-center gap-3 rounded-xl border p-3 text-left ${

                      selectedSubjectId === UNASSIGNED_SUBJECT

                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-200'

                        : 'border-slate-200 bg-white'

                    }`}

                  >

                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">

                      <Video className="h-5 w-5" />

                    </span>

                    <span className="min-w-0">

                      <span className="block text-sm font-semibold text-slate-900">

                        Other classes

                      </span>

                      <span className="mt-1 block text-xs text-slate-500">

                        Not categorized

                      </span>

                    </span>

                  </button>

                )}

              </div>

            </section>



            {/* Recordings / Upcoming tabs */}

            <section className="space-y-4">

              <div className="flex items-center justify-between gap-3">

                <div>

                  <h2 className="text-lg font-bold text-slate-900">

                    Classes

                  </h2>

                  <p className="text-xs text-slate-500">

                    Watch lessons or check your schedule

                  </p>

                </div>

              </div>



              <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">

                <button

                  type="button"

                  onClick={() => setActiveTab('recordings')}

                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${

                    activeTab === 'recordings'

                      ? 'bg-white text-blue-700 shadow-sm'

                      : 'text-slate-600'

                  }`}

                >

                  <PlayCircle className="h-4 w-4" />

                  Recordings

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">

                    {recordingsCount}

                  </span>

                </button>



                <button

                  type="button"

                  onClick={() => setActiveTab('upcoming')}

                  className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${

                    activeTab === 'upcoming'

                      ? 'bg-white text-blue-700 shadow-sm'

                      : 'text-slate-600'

                  }`}

                >

                  <CalendarDays className="h-4 w-4" />

                  Upcoming

                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">

                    {upcomingCount}

                  </span>

                </button>

              </div>



              {/* Search */}

              <div className="relative">

                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input

                  type="search"

                  value={search}

                  onChange={(event) => setSearch(event.target.value)}

                  placeholder="Search classes, teachers or subjects..."

                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

                />

              </div>



              {/* Class cards */}

              {playerLoading && (

                <div className="flex items-center justify-center gap-2 py-4 text-sm text-blue-700">

                  <Loader2 className="h-4 w-4 animate-spin" />

                  Preparing video...

                </div>

              )}



              {visibleClasses.length === 0 ? (

                <Card className="border-dashed border-slate-300 shadow-none">

                  <CardContent className="flex flex-col items-center px-5 py-12 text-center">

                    {activeTab === 'recordings' ? (

                      <PlayCircle className="h-12 w-12 text-slate-300" />

                    ) : (

                      <CalendarDays className="h-12 w-12 text-slate-300" />

                    )}



                    <h3 className="mt-4 font-semibold text-slate-800">

                      {activeTab === 'recordings'

                        ? 'No recordings found'

                        : 'No upcoming classes'}

                    </h3>



                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">

                      {activeTab === 'recordings'

                        ? 'Recordings will appear here when your teacher uploads a video for a completed class.'

                        : 'Your scheduled or live classes will appear here.'}

                    </p>



                    {search && (

                      <Button

                        variant="outline"

                        className="mt-4"

                        onClick={() => setSearch('')}

                      >

                        Clear search

                      </Button>

                    )}

                  </CardContent>

                </Card>

              ) : (

                <>

                  <p className="text-xs text-slate-500">

                    Showing {visibleClasses.length}{' '}

                    {visibleClasses.length === 1 ? 'class' : 'classes'}

                  </p>



                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

                    {visibleClasses.map((item) => {

                      const subjectName =

                        subjects.find(

                          (subject) => subject.id === item.subject_id

                        )?.name;



                      const isLive = item.status === 'live';

                      const meetingLink = item.meeting_link;



                      return (

                        <Card

                          key={item.id}

                          className="group overflow-hidden rounded-2xl border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"

                        >

                          {/* Thumbnail */}

                          <button

                            type="button"

                           onClick={() => {

  if (activeTab === 'recordings') {

    void openRecording(item);

    return;

  }



  const link = item.meeting_link?.trim();



  if (link) {

    window.open(link, '_blank', 'noopener,noreferrer');

  }

}}

                            disabled={

                              activeTab === 'recordings' &&

                              playerLoading

                            }

                            className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 text-white"

                          >

                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_55%)]" />



                            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/15 backdrop-blur transition group-hover:scale-110">

                              {activeTab === 'recordings' ? (

                                <PlayCircle className="h-10 w-10" />

                              ) : isLive ? (

                                <Wifi className="h-8 w-8" />

                              ) : (

                                <Video className="h-8 w-8" />

                              )}

                            </div>



                            <div className="absolute bottom-3 left-3">

                              <Badge className="border-0 bg-white/95 text-blue-800 hover:bg-white">

                                {activeTab === 'recordings'

                                  ? 'Recording'

                                  : isLive

                                    ? 'Live now'

                                    : 'Scheduled'}

                              </Badge>

                            </div>



                            {item.duration_minutes && (

                              <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">

                                {item.duration_minutes} min

                              </div>

                            )}

                          </button>



                          <CardContent className="p-4">

                            {subjectName && (

                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">

                                {subjectName}

                              </p>

                            )}



                            <h3 className="line-clamp-2 min-h-12 font-bold leading-6 text-slate-900">

                              {item.title}

                            </h3>



                            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">

                              {item.description ||

                                'Continue your preparation with this class.'}

                            </p>



                            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">

                              <div className="flex items-center gap-2">

                                <BookOpen className="h-4 w-4 shrink-0 text-blue-600" />

                                <span className="truncate">

                                  {item.course_title}

                                </span>

                              </div>



                              <div className="flex items-center gap-2">

                                <UserRound className="h-4 w-4 shrink-0 text-blue-600" />

                                <span className="truncate">

                                  {item.teacher_name}

                                </span>

                              </div>



                              <div className="flex items-center gap-2">

                                <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />

                                <span>

                                  {new Date(

                                    item.start_time

                                  ).toLocaleDateString()}

                                </span>

                              </div>



                              {activeTab === 'upcoming' && (

                                <div className="flex items-center gap-2">

                                  <Clock3 className="h-4 w-4 shrink-0 text-blue-600" />

                                  <span>

                                    {new Date(

                                      item.start_time

                                    ).toLocaleTimeString([], {

                                      hour: '2-digit',

                                      minute: '2-digit',

                                    })}

                                  </span>

                                </div>

                              )}

                            </div>



                            {activeTab === 'recordings' ? (

                              <Button

                                className="mt-4 w-full bg-blue-600 text-white hover:bg-blue-700"

                                onClick={() => openRecording(item)}

                                disabled={playerLoading}

                              >

                                <PlayCircle className="mr-2 h-4 w-4" />

                                Watch recording

                              </Button>

                            ) : meetingLink  ? (

                              <Button

                                className={`mt-4 w-full ${

                                  isLive

                                    ? 'bg-red-600 hover:bg-red-700'

                                    : 'bg-blue-600 hover:bg-blue-700'

                                } text-white`}

                              onClick={() => {

  if (!meetingLink) return;



  window.open(

    meetingLink,

    '_blank',

    'noopener,noreferrer'

  );

}}

                              >

                                <Video className="mr-2 h-4 w-4" />

                                {isLive ? 'Join live class' : 'Meeting link'}

                              </Button>

                            ) : (

                              <Button

                                className="mt-4 w-full"

                                variant="outline"

                                disabled

                              >

                                <Clock3 className="mr-2 h-4 w-4" />

                                Awaiting meeting link

                              </Button>

                            )}

                          </CardContent>

                        </Card>

                      );

                    })}

                  </div>

                </>

              )}

            </section>

          </>

        )}

      </div>

    </DashboardShell>

  );

}
