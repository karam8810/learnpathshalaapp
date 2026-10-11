/*\n# ShaanAcademy - Full Schema\n\n## Overview\nCreates the complete database schema for ShaanAcademy, an educational platform with three roles: admin, teacher, and student. Features courses, live classes, and quizzes.\n\n## New Tables\n1. **profiles** - Extends auth.users with role (admin/teacher/student), full_name, avatar_url\n2. **courses** - Course catalog with title, description, teacher_id, category, status\n3. **enrollments** - Links students to courses\n4. **live_classes** - Scheduled live class sessions linked to courses\n5. **quizzes** - Quizzes linked to courses with title, description, time_limit\n6. **questions** - Multiple-choice questions for quizzes\n7. **submissions** - Student quiz submissions with score\n8. **answers** - Individual answers within a submission\n\n## Security\n- RLS enabled on every table\n- Students can only see their own enrollments, submissions, answers\n- Teachers can only manage their own courses, live classes, quizzes, questions\n- Admins can manage everything via SECURITY DEFINER helper function\n- All owner columns default to auth.uid()\n\n## Important Notes\n1. Role-based access: profiles.role drives what each user can do\n2. Teachers own courses

 students enroll in courses\n3. Live classes and quizzes belong to courses\n4. Quiz submissions are scored automatically\n*/\n\n-- 1. profiles table (created first so helper function can reference it)\nCREATE TABLE IF NOT EXISTS public.profiles (\n  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,\n  full_name text NOT NULL,\n  email text NOT NULL,\n  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),\n  avatar_url text,\n  bio text,\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "profiles_select_all" ON public.profiles

\nCREATE POLICY "profiles_select_all" ON public.profiles\n  FOR SELECT TO authenticated USING (true)

\n\nDROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles

\nCREATE POLICY "profiles_insert_self" ON public.profiles\n  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)

\n\nDROP POLICY IF EXISTS "profiles_update_self" ON public.profiles

\nCREATE POLICY "profiles_update_self" ON public.profiles\n  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id)

\n\n-- Helper function: is_admin (after profiles exists)\nCREATE OR REPLACE FUNCTION public.is_admin()\nRETURNS boolean\nLANGUAGE sql\nSECURITY DEFINER\nSTABLE\nSET search_path = public\nAS $$\n  SELECT EXISTS (\n    SELECT 1 FROM public.profiles\n    WHERE id = auth.uid() AND role = 'admin'\n  )

\n$$

\n\n-- 2. courses table\nCREATE TABLE IF NOT EXISTS public.courses (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  title text NOT NULL,\n  description text,\n  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  category text DEFAULT 'General',\n  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),\n  image_url text,\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.courses ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "courses_select_all" ON public.courses

\nCREATE POLICY "courses_select_all" ON public.courses\n  FOR SELECT TO authenticated USING (true)

\n\nDROP POLICY IF EXISTS "courses_insert_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_insert_teacher_or_admin" ON public.courses\n  FOR INSERT TO authenticated WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "courses_update_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_update_teacher_or_admin" ON public.courses\n  FOR UPDATE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  ) WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "courses_delete_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_delete_teacher_or_admin" ON public.courses\n  FOR DELETE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\n-- 3. enrollments table\nCREATE TABLE IF NOT EXISTS public.enrollments (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),\n  created_at timestamptz DEFAULT now(),\n  UNIQUE(course_id, student_id)\n)

\n\nALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "enrollments_select" ON public.enrollments

\nCREATE POLICY "enrollments_select" ON public.enrollments\n  FOR SELECT TO authenticated USING (\n    auth.uid() = student_id OR\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "enrollments_insert_self" ON public.enrollments

\nCREATE POLICY "enrollments_insert_self" ON public.enrollments\n  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id)

\n\nDROP POLICY IF EXISTS "enrollments_update_self_or_teacher" ON public.enrollments

\nCREATE POLICY "enrollments_update_self_or_teacher" ON public.enrollments\n  FOR UPDATE TO authenticated USING (\n    auth.uid() = student_id OR\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid())\n  ) WITH CHECK (\n    auth.uid() = student_id OR\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.courses WHERE courses.id = enrollments.course_id AND courses.teacher_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "enrollments_delete_self_or_admin" ON public.enrollments

\nCREATE POLICY "enrollments_delete_self_or_admin" ON public.enrollments\n  FOR DELETE TO authenticated USING (\n    auth.uid() = student_id OR public.is_admin()\n  )

\n\n-- 4. live_classes table\nCREATE TABLE IF NOT EXISTS public.live_classes (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,\n  title text NOT NULL,\n  description text,\n  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  start_time timestamptz NOT NULL,\n  duration_minutes int NOT NULL DEFAULT 60,\n  meeting_link text,\n  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.live_classes ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "live_classes_select" ON public.live_classes

\nCREATE POLICY "live_classes_select" ON public.live_classes\n  FOR SELECT TO authenticated USING (true)

\n\nDROP POLICY IF EXISTS "live_classes_insert" ON public.live_classes

\nCREATE POLICY "live_classes_insert" ON public.live_classes\n  FOR INSERT TO authenticated WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "live_classes_update" ON public.live_classes

\nCREATE POLICY "live_classes_update" ON public.live_classes\n  FOR UPDATE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  ) WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "live_classes_delete" ON public.live_classes

\nCREATE POLICY "live_classes_delete" ON public.live_classes\n  FOR DELETE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\n-- 5. quizzes table\nCREATE TABLE IF NOT EXISTS public.quizzes (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,\n  title text NOT NULL,\n  description text,\n  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  time_limit_minutes int DEFAULT 30,\n  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'closed')),\n  created_at timestamptz DEFAULT now(),\n  updated_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "quizzes_select" ON public.quizzes

\nCREATE POLICY "quizzes_select" ON public.quizzes\n  FOR SELECT TO authenticated USING (true)

\n\nDROP POLICY IF EXISTS "quizzes_insert" ON public.quizzes

\nCREATE POLICY "quizzes_insert" ON public.quizzes\n  FOR INSERT TO authenticated WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "quizzes_update" ON public.quizzes

\nCREATE POLICY "quizzes_update" ON public.quizzes\n  FOR UPDATE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  ) WITH CHECK (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\nDROP POLICY IF EXISTS "quizzes_delete" ON public.quizzes

\nCREATE POLICY "quizzes_delete" ON public.quizzes\n  FOR DELETE TO authenticated USING (\n    public.is_admin() OR auth.uid() = teacher_id\n  )

\n\n-- 6. questions table\nCREATE TABLE IF NOT EXISTS public.questions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,\n  question_text text NOT NULL,\n  options jsonb NOT NULL DEFAULT '[]',\n  correct_answer int NOT NULL DEFAULT 0,\n  points int NOT NULL DEFAULT 1,\n  created_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.questions ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "questions_select" ON public.questions

\nCREATE POLICY "questions_select" ON public.questions\n  FOR SELECT TO authenticated USING (true)

\n\nDROP POLICY IF EXISTS "questions_insert" ON public.questions

\nCREATE POLICY "questions_insert" ON public.questions\n  FOR INSERT TO authenticated WITH CHECK (\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.teacher_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "questions_update" ON public.questions

\nCREATE POLICY "questions_update" ON public.questions\n  FOR UPDATE TO authenticated USING (\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.teacher_id = auth.uid())\n  ) WITH CHECK (\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.teacher_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "questions_delete" ON public.questions

\nCREATE POLICY "questions_delete" ON public.questions\n  FOR DELETE TO authenticated USING (\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = questions.quiz_id AND quizzes.teacher_id = auth.uid())\n  )

\n\n-- 7. submissions table\nCREATE TABLE IF NOT EXISTS public.submissions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  score int NOT NULL DEFAULT 0,\n  total_points int NOT NULL DEFAULT 0,\n  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed')),\n  started_at timestamptz DEFAULT now(),\n  completed_at timestamptz,\n  created_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "submissions_select" ON public.submissions

\nCREATE POLICY "submissions_select" ON public.submissions\n  FOR SELECT TO authenticated USING (\n    auth.uid() = student_id OR\n    public.is_admin() OR\n    EXISTS (SELECT 1 FROM public.quizzes WHERE quizzes.id = submissions.quiz_id AND quizzes.teacher_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "submissions_insert_self" ON public.submissions

\nCREATE POLICY "submissions_insert_self" ON public.submissions\n  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id)

\n\nDROP POLICY IF EXISTS "submissions_update_self" ON public.submissions

\nCREATE POLICY "submissions_update_self" ON public.submissions\n  FOR UPDATE TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id)

\n\nDROP POLICY IF EXISTS "submissions_delete_self_or_admin" ON public.submissions

\nCREATE POLICY "submissions_delete_self_or_admin" ON public.submissions\n  FOR DELETE TO authenticated USING (\n    auth.uid() = student_id OR public.is_admin()\n  )

\n\n-- 8. answers table\nCREATE TABLE IF NOT EXISTS public.answers (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,\n  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,\n  selected_answer int NOT NULL,\n  is_correct boolean NOT NULL DEFAULT false,\n  created_at timestamptz DEFAULT now()\n)

\n\nALTER TABLE public.answers ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "answers_select" ON public.answers

\nCREATE POLICY "answers_select" ON public.answers\n  FOR SELECT TO authenticated USING (\n    EXISTS (SELECT 1 FROM public.submissions WHERE submissions.id = answers.submission_id AND submissions.student_id = auth.uid()) OR\n    public.is_admin() OR\n    EXISTS (\n      SELECT 1 FROM public.submissions\n      JOIN public.quizzes ON quizzes.id = submissions.quiz_id\n      WHERE submissions.id = answers.submission_id AND quizzes.teacher_id = auth.uid()\n    )\n  )

\n\nDROP POLICY IF EXISTS "answers_insert_self" ON public.answers

\nCREATE POLICY "answers_insert_self" ON public.answers\n  FOR INSERT TO authenticated WITH CHECK (\n    EXISTS (SELECT 1 FROM public.submissions WHERE submissions.id = answers.submission_id AND submissions.student_id = auth.uid())\n  )

\n\nDROP POLICY IF EXISTS "answers_delete_self_or_admin" ON public.answers

\nCREATE POLICY "answers_delete_self_or_admin" ON public.answers\n  FOR DELETE TO authenticated USING (\n    EXISTS (SELECT 1 FROM public.submissions WHERE submissions.id = answers.submission_id AND submissions.student_id = auth.uid()) OR\n    public.is_admin()\n  )

\n\n-- Indexes\nCREATE INDEX IF NOT EXISTS idx_courses_teacher ON public.courses(teacher_id)

\nCREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments(student_id)

\nCREATE INDEX IF NOT EXISTS idx_enrollments_course ON public.enrollments(course_id)

\nCREATE INDEX IF NOT EXISTS idx_live_classes_course ON public.live_classes(course_id)

\nCREATE INDEX IF NOT EXISTS idx_live_classes_teacher ON public.live_classes(teacher_id)

\nCREATE INDEX IF NOT EXISTS idx_live_classes_start_time ON public.live_classes(start_time)

\nCREATE INDEX IF NOT EXISTS idx_quizzes_course ON public.quizzes(course_id)

\nCREATE INDEX IF NOT EXISTS idx_quizzes_teacher ON public.quizzes(teacher_id)

\nCREATE INDEX IF NOT EXISTS idx_questions_quiz ON public.questions(quiz_id)

\nCREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id)

\nCREATE INDEX IF NOT EXISTS idx_submissions_quiz ON public.submissions(quiz_id)

\nCREATE INDEX IF NOT EXISTS idx_answers_submission ON public.answers(submission_id)

\n\n-- Trigger: auto-update updated_at\nCREATE OR REPLACE FUNCTION public.handle_updated_at()\nRETURNS trigger\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  NEW.updated_at = now()

\n  RETURN NEW

\nEND

\n$$

\n\nDROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles

\nCREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles\n  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()

\n\nDROP TRIGGER IF EXISTS courses_updated_at ON public.courses

\nCREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses\n  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()

\n\nDROP TRIGGER IF EXISTS live_classes_updated_at ON public.live_classes

\nCREATE TRIGGER live_classes_updated_at BEFORE UPDATE ON public.live_classes\n  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()

\n\nDROP TRIGGER IF EXISTS quizzes_updated_at ON public.quizzes

\nCREATE TRIGGER quizzes_updated_at BEFORE UPDATE ON public.quizzes\n  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()

\n\n-- Trigger: auto-create profile on signup\nCREATE OR REPLACE FUNCTION public.handle_new_user()\nRETURNS trigger\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.profiles (id, full_name, email, role)\n  VALUES (\n    NEW.id,\n    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),\n    NEW.email,\n    COALESCE(NEW.raw_user_meta_data->>'role', 'student')\n  )

\n  RETURN NEW

\nEND

\n$$

\n\nDROP TRIGGER IF EXISTS on_auth_user_created ON auth.users

\nCREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users\n  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()
