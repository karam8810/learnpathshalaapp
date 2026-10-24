"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  CirclePlay,
  FileVideo,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

type Course = {
  id: string;
  title: string;
  teacher_id: string | null;
};

type Teacher = {
  id: string;
  full_name: string;
  email: string;
};

type Subject = {
  id: string;
  course_id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

type Chapter = {
  id: string;
  course_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

type RecordedClass = {
  id: string;
  course_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  title: string;
  recording_path: string | null;
  recording_url: string | null;
  created_at: string;
  status: string;
};

const BUCKET = "recorded-class-videos";
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export default function AdminCourseContentPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [recordings, setRecordings] = useState<RecordedClass[]>([]);

  const [courseId, setCourseId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  const [subjectName, setSubjectName] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterDescription, setChapterDescription] = useState("");

  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [assignedTeacherId, setAssignedTeacherId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [earningEligible, setEarningEligible] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [savingSubject, setSavingSubject] = useState(false);
  const [savingChapter, setSavingChapter] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "admin")) {
      router.replace("/login");
    }
  }, [loading, user, profile, router]);

  const fetchData = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;

    setPageLoading(true);

    try {
      const [coursesResult, teachersResult, subjectsResult, chaptersResult, recordingsResult] =
        await Promise.all([
          supabase
            .from("courses")
            .select("id, title, teacher_id")
            .order("title"),

          supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("role", "teacher")
            .order("full_name"),

          supabase
            .from("course_subjects")
            .select(
              "id, course_id, name, description, display_order, is_active",
            )
            .order("display_order"),

          supabase
            .from("course_chapters")
            .select(
              "id, course_id, subject_id, title, description, display_order, is_active",
            )
            .order("display_order"),

          supabase
            .from("live_classes")
            .select(
              "id, course_id, subject_id, chapter_id, title, recording_path, recording_url, created_at, status",
            )
            .not("recording_path", "is", null)
            .order("created_at", { ascending: false }),
        ]);

      const firstError =
        coursesResult.error ||
        teachersResult.error ||
        subjectsResult.error ||
        chaptersResult.error ||
        recordingsResult.error;

      if (firstError) throw firstError;

      setCourses((coursesResult.data || []) as Course[]);
      setTeachers((teachersResult.data || []) as Teacher[]);
      setSubjects((subjectsResult.data || []) as Subject[]);
      setChapters((chaptersResult.data || []) as Chapter[]);
      setRecordings((recordingsResult.data || []) as RecordedClass[]);
    } catch (error) {
      console.error("Course content loading error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load course content.",
      );
    } finally {
      setPageLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (profile?.role === "admin") {
      void fetchData();
    }
  }, [profile, fetchData]);

  const filteredSubjects = subjects.filter(
    (subject) => subject.course_id === courseId,
  );

  const filteredChapters = chapters.filter(
    (chapter) =>
      chapter.course_id === courseId && chapter.subject_id === subjectId,
  );

  const selectedCourse = courses.find((course) => course.id === courseId);
  const effectiveTeacherId =
    assignedTeacherId || selectedCourse?.teacher_id || teachers[0]?.id || "";

  const getCourseTitle = (id: string) =>
    courses.find((course) => course.id === id)?.title || "Unknown course";

  const getSubjectName = (id: string | null) =>
    subjects.find((subject) => subject.id === id)?.name || "Unassigned";

  const getChapterTitle = (id: string | null) =>
    chapters.find((chapter) => chapter.id === id)?.title || "Unassigned";

  const handleAddSubject = async () => {
    if (!courseId || !subjectName.trim()) {
      toast.error("Select a course and enter a subject name.");
      return;
    }

    setSavingSubject(true);

    try {
      const { error } = await supabase.from("course_subjects").insert({
        course_id: courseId,
        name: subjectName.trim(),
        description: subjectDescription.trim() || null,
        display_order: filteredSubjects.length + 1,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Subject created successfully.");
      setSubjectName("");
      setSubjectDescription("");

      await fetchData();
    } catch (error) {
      console.error("Create subject error:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not create subject.",
      );
    } finally {
      setSavingSubject(false);
    }
  };

  const handleAddChapter = async () => {
    if (!courseId || !subjectId || !chapterTitle.trim()) {
      toast.error("Select a course, subject, and enter a chapter title.");
      return;
    }

    setSavingChapter(true);

    try {
      const { error } = await supabase.from("course_chapters").insert({
        course_id: courseId,
        subject_id: subjectId,
        title: chapterTitle.trim(),
        description: chapterDescription.trim() || null,
        display_order: filteredChapters.length + 1,
        is_active: true,
      });

      if (error) throw error;

      toast.success("Chapter created successfully.");
      setChapterTitle("");
      setChapterDescription("");

      await fetchData();
    } catch (error) {
      console.error("Create chapter error:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not create chapter.",
      );
    } finally {
      setSavingChapter(false);
    }
  };

  const handleUploadVideo = async () => {
    if (!user) {
      toast.error("Please log in again.");
      return;
    }

    if (!courseId || !subjectId || !chapterId) {
      toast.error("Select a course, subject, and chapter.");
      return;
    }

    if (!videoTitle.trim()) {
      toast.error("Enter a video title.");
      return;
    }

    if (!effectiveTeacherId || !teachers.some((teacher) => teacher.id === effectiveTeacherId)) {
      toast.error("Select a valid teacher for this lecture.");
      return;
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isInteger(parsedDuration) || parsedDuration <= 0 || parsedDuration > 1440) {
      toast.error("Duration must be a whole number between 1 and 1440 minutes.");
      return;
    }

    if (!videoFile) {
      toast.error("Choose a video file.");
      return;
    }

    if (!videoFile.type.startsWith("video/")) {
      toast.error("Please choose a valid video file.");
      return;
    }

    if (videoFile.size > MAX_VIDEO_SIZE) {
      toast.error("Video must be 500 MB or smaller.");
      return;
    }

    setUploading(true);

    let createdClassId: string | null = null;
    let uploadedPath: string | null = null;

    try {
      // Create the recording entry first so the storage path includes its ID.
      const { data: newClass, error: createError } = await supabase
        .from("live_classes")
        .insert({
          course_id: courseId,
          subject_id: subjectId,
          chapter_id: chapterId,
          teacher_id: effectiveTeacherId,
          title: videoTitle.trim(),
          description: videoDescription.trim() || null,
          start_time: new Date().toISOString(),
          duration_minutes: parsedDuration,
          meeting_link: null,
          status: "completed",
          recording_url: null,
          recording_path: null,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      if (!newClass) {
        throw new Error("Could not create the recording entry.");
      }

      createdClassId = newClass.id;

      // Keep the existing storage path convention for your bucket policies.
      const extension = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";

      uploadedPath = `${user.id}/${
        newClass.id
      }/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(uploadedPath, videoFile, {
          cacheControl: "3600",
          contentType: videoFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("live_classes")
        .update({
          recording_path: uploadedPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", newClass.id);

      if (updateError) throw updateError;

      // Link the same uploaded recording to the teacher revenue-share ledger.
      // The course_lectures row is what the contribution summary reads.
      const { error: lectureError } = await supabase
        .from("course_lectures")
        .insert({
          course_id: courseId,
          teacher_id: effectiveTeacherId,
          subject_id: subjectId,
          chapter_id: chapterId,
          title: videoTitle.trim(),
          duration_minutes: parsedDuration,
          lecture_type: "recorded",
          status: "published",
          is_earning_eligible: earningEligible,
          recording_path: uploadedPath,
          recording_url: null,
        });

      if (lectureError) throw lectureError;

      toast.success(
        earningEligible
          ? "Recording uploaded and included in eligible lecture tracking."
          : "Recording uploaded. It is excluded from teacher revenue sharing."
      );

      setVideoTitle("");
      setVideoDescription("");
      setVideoFile(null);
      setDurationMinutes("60");
      setEarningEligible(false);

      const fileInput = document.getElementById(
        "recorded-video-file",
      ) as HTMLInputElement | null;

      if (fileInput) fileInput.value = "";

      await fetchData();
    } catch (error) {
      console.error("Video upload error:", error);

      // Roll back the uploaded file and entry if attaching the recording failed.
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      }

      if (createdClassId) {
        await supabase.from("live_classes").delete().eq("id", createdClassId);
      }

      toast.error(
        error instanceof Error ? error.message : "Could not upload video.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteRecording = async (recording: RecordedClass) => {
    const confirmed = window.confirm(
      `Delete the recording entry "${recording.title}"? This also removes its uploaded video.`,
    );

    if (!confirmed) return;

    setDeletingId(recording.id);

    try {
      // Remove the revenue-sharing row linked to this exact storage object first.
      if (recording.recording_path) {
        const { error: lectureDeleteError } = await supabase
          .from("course_lectures")
          .delete()
          .eq("course_id", recording.course_id)
          .eq("recording_path", recording.recording_path);

        if (lectureDeleteError) throw lectureDeleteError;

        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove([recording.recording_path]);

        if (storageError) throw storageError;
      }

      const { error } = await supabase
        .from("live_classes")
        .delete()
        .eq("id", recording.id);

      if (error) throw error;

      toast.success("Recording deleted.");
      await fetchData();
    } catch (error) {
      console.error("Delete recording error:", error);
      toast.error(
        error instanceof Error ? error.message : "Could not delete recording.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !user || profile?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <DashboardShell role="admin">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
                <BookOpen size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Course Content
                </h1>
                <p className="text-sm text-slate-500">
                  Manage subjects, chapters, and recorded classes.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={pageLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Content hierarchy */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">1. Select course</h2>
          <p className="mt-1 text-sm text-slate-500">
            Subjects and chapters belong to a specific course.
          </p>

          <div className="mt-4">
            <label
              htmlFor="course-select"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Course
            </label>
            <select
              id="course-select"
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setSubjectId("");
                setChapterId("");
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Choose a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            {courses.length === 0 && !pageLoading && (
              <p className="mt-2 text-sm text-amber-700">
                No courses found. Create a course first.
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subjects */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
                <BookOpen size={21} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">2. Subjects</h2>
                <p className="text-xs text-slate-500">
                  {filteredSubjects.length} subject(s) in this course
                </p>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddSubject();
              }}
              className="space-y-3"
            >
              <input
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                placeholder="Subject name (e.g. Mathematics)"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <textarea
                value={subjectDescription}
                onChange={(event) => setSubjectDescription(event.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                disabled={!courseId || savingSubject}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingSubject ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add subject
              </button>
            </form>

            <div className="mt-5 space-y-2">
              {filteredSubjects.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  onClick={() => {
                    setSubjectId(subject.id);
                    setChapterId("");
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                    subjectId === subject.id
                      ? "border-violet-400 bg-violet-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {subject.name}
                    </span>
                    {subject.description && (
                      <span className="mt-1 block text-xs text-slate-500">
                        {subject.description}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-violet-700">
                    {subjectId === subject.id ? "Selected" : "Select"}
                  </span>
                </button>
              ))}

              {courseId && filteredSubjects.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No subjects yet. Add your first subject above.
                </p>
              )}

              {!courseId && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Select a course to manage its subjects.
                </p>
              )}
            </div>
          </section>

          {/* Chapters */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <ChevronDown size={21} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">3. Chapters</h2>
                <p className="text-xs text-slate-500">
                  {filteredChapters.length} chapter(s) in selected subject
                </p>
              </div>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleAddChapter();
              }}
              className="space-y-3"
            >
              <input
                value={chapterTitle}
                onChange={(event) => setChapterTitle(event.target.value)}
                placeholder="Chapter title (e.g. Percentage)"
                required
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <textarea
                value={chapterDescription}
                onChange={(event) => setChapterDescription(event.target.value)}
                placeholder="Chapter description (optional)"
                rows={2}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                disabled={!subjectId || savingChapter}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingChapter ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                Add chapter
              </button>
            </form>

            <div className="mt-5 space-y-2">
              {filteredChapters.map((chapter) => (
                <button
                  type="button"
                  key={chapter.id}
                  onClick={() => setChapterId(chapter.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                    chapterId === chapter.id
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      {chapter.title}
                    </span>
                    {chapter.description && (
                      <span className="mt-1 block text-xs text-slate-500">
                        {chapter.description}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-emerald-700">
                    {chapterId === chapter.id ? "Selected" : "Select"}
                  </span>
                </button>
              ))}

              {subjectId && filteredChapters.length === 0 && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  No chapters yet. Add a chapter above.
                </p>
              )}

              {!subjectId && (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                  Select a subject before adding chapters.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Upload video */}
        <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
              <Upload size={23} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                4. Upload recorded class
              </h2>
              <p className="text-sm text-slate-600">
                The video is saved to the existing recording library and linked to a teacher lecture for revenue-share tracking.
              </p>
            </div>
          </div>

          <div className="mb-5 grid gap-3 rounded-xl border border-blue-100 bg-white p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Course</p>
              <p className="mt-1 font-semibold text-slate-800">
                {selectedCourse?.title || "Not selected"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Subject</p>
              <p className="mt-1 font-semibold text-slate-800">
                {getSubjectName(subjectId || null)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Chapter</p>
              <p className="mt-1 font-semibold text-slate-800">
                {getChapterTitle(chapterId || null)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="video-title"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Video title
              </label>
              <input
                id="video-title"
                value={videoTitle}
                onChange={(event) => setVideoTitle(event.target.value)}
                placeholder="e.g. Percentage - Basic Concepts"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="recorded-video-file"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Video file
              </label>
              <input
                id="recorded-video-file"
                type="file"
                accept="video/*"
                onChange={(event) =>
                  setVideoFile(event.target.files?.[0] || null)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:font-semibold file:text-blue-700"
              />
              <p className="mt-1 text-xs text-slate-500">
                Maximum file size: 500 MB.
              </p>
              {videoFile && (
                <p className="mt-1 break-all text-xs text-slate-600">
                  {videoFile.name} ·{" "}
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="lecture-teacher" className="mb-2 block text-sm font-semibold text-slate-700">
                Assigned teacher
              </label>
              <select
                id="lecture-teacher"
                value={effectiveTeacherId}
                onChange={(event) => setAssignedTeacherId(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Choose teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name} ({teacher.email})
                  </option>
                ))}
              </select>
              {teachers.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">No teacher profiles found. Create/assign a teacher profile first.</p>
              )}
            </div>

            <div>
              <label htmlFor="lecture-duration" className="mb-2 block text-sm font-semibold text-slate-700">
                Duration (minutes)
              </label>
              <input
                id="lecture-duration"
                type="number"
                min={1}
                max={1440}
                step={1}
                required
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-3">
              <input
                id="lecture-earning-eligible"
                type="checkbox"
                checked={earningEligible}
                onChange={(event) => setEarningEligible(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="lecture-earning-eligible" className="ml-3 text-sm text-slate-700">
                <span className="block font-semibold">Eligible for teacher share</span>
                <span className="block text-xs text-slate-500">Leave unchecked for demos/promos.</span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="video-description"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Video description (optional)
            </label>
            <textarea
              id="video-description"
              value={videoDescription}
              onChange={(event) => setVideoDescription(event.target.value)}
              placeholder="What will students learn in this recording?"
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleUploadVideo()}
            disabled={
              uploading || !courseId || !subjectId || !chapterId || !videoFile || !effectiveTeacherId || teachers.length === 0
            }
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading video...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload recorded class
              </>
            )}
          </button>
        </section>

        {/* Existing recordings */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Existing recordings
              </h2>
              <p className="text-sm text-slate-500">
                {recordings.length} recording(s) found in the video library.
              </p>
            </div>
            <FileVideo className="text-slate-400" size={24} />
          </div>

          {pageLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-8 text-center">
              <CirclePlay className="mx-auto text-slate-400" size={36} />
              <p className="mt-3 font-semibold text-slate-700">
                No uploaded recordings found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Upload your first recording using the form above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div
                  key={recording.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">
                      {recording.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getCourseTitle(recording.course_id)} /{" "}
                      {getSubjectName(recording.subject_id)} /{" "}
                      {getChapterTitle(recording.chapter_id)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Added{" "}
                      {new Date(recording.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDeleteRecording(recording)}
                    disabled={deletingId === recording.id}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === recording.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
