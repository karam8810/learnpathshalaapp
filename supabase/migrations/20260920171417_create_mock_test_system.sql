/*\n# ShaanAcademy Mock Test System\n\n## Overview\nAdds a complete mock-test workflow for admins, teachers, and students. Admins control publishing, approval, pricing, limits, assignment, and analytics. Teachers create tests and questions, add explanations and images, then submit tests for approval. Students take published tests and receive server-calculated scores and performance history.\n\n## New Tables\n- `mock_tests` - Test series metadata, ownership, approval status, pricing, exam/category/course, timing, and attempt limit.\n- `mock_test_questions` - Student-visible question text, options, explanation, and optional image.\n- `mock_test_answer_keys` - Private answer key used only by the server scorer and authorized staff.\n- `mock_test_attempts` - One scored attempt per student/test run with score, percentage, and timing.\n- `mock_test_answers` - Student selections for each attempt.\n\n## Security\n- RLS is enabled on every new table.\n- Admins can manage all mock-test content and results.\n- Teachers can manage tests they create or that an admin assigns to them.\n- Students can only see published tests, their own attempts, and their own answers.\n- Answer keys are never readable by students.\n- Direct attempt inserts are blocked

 `submit_mock_test` validates publication, attempt limits, ownership, and scoring on the server.\n\n## Important Notes\n1. Correct answers are stored separately from student-visible questions.\n2. Paid/free and price fields are included for catalog control

 payment processing is intentionally not included.\n3. Rankings are calculated from completed attempts and are visible through authorized result queries.\n*/\n\nCREATE TABLE IF NOT EXISTS public.mock_tests (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  title text NOT NULL,\n  description text,\n  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  assigned_teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,\n  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,\n  exam_name text NOT NULL DEFAULT 'General',\n  category text NOT NULL DEFAULT 'General',\n  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'unpublished')),\n  is_free boolean NOT NULL DEFAULT true,\n  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),\n  attempt_limit integer NOT NULL DEFAULT 1 CHECK (attempt_limit > 0 AND attempt_limit <= 100),\n  time_limit_minutes integer NOT NULL DEFAULT 30 CHECK (time_limit_minutes > 0 AND time_limit_minutes <= 600),\n  rejection_reason text,\n  published_at timestamptz,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n)

\n\nCREATE TABLE IF NOT EXISTS public.mock_test_questions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,\n  question_order integer NOT NULL DEFAULT 1 CHECK (question_order > 0),\n  question_text text NOT NULL,\n  options jsonb NOT NULL DEFAULT '[]'::jsonb,\n  explanation text,\n  image_url text,\n  points integer NOT NULL DEFAULT 1 CHECK (points > 0 AND points <= 100),\n  created_at timestamptz NOT NULL DEFAULT now(),\n  UNIQUE(test_id, question_order)\n)

\n\nCREATE TABLE IF NOT EXISTS public.mock_test_answer_keys (\n  question_id uuid PRIMARY KEY REFERENCES public.mock_test_questions(id) ON DELETE CASCADE,\n  correct_answer integer NOT NULL CHECK (correct_answer >= 0),\n  updated_at timestamptz NOT NULL DEFAULT now()\n)

\n\nCREATE TABLE IF NOT EXISTS public.mock_test_attempts (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  attempt_number integer NOT NULL CHECK (attempt_number > 0),\n  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),\n  total_points integer NOT NULL DEFAULT 0 CHECK (total_points >= 0),\n  percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),\n  started_at timestamptz NOT NULL DEFAULT now(),\n  submitted_at timestamptz NOT NULL DEFAULT now(),\n  UNIQUE(test_id, student_id, attempt_number)\n)

\n\nCREATE TABLE IF NOT EXISTS public.mock_test_answers (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  attempt_id uuid NOT NULL REFERENCES public.mock_test_attempts(id) ON DELETE CASCADE,\n  question_id uuid NOT NULL REFERENCES public.mock_test_questions(id) ON DELETE CASCADE,\n  selected_answer integer NOT NULL CHECK (selected_answer >= -1),\n  is_correct boolean NOT NULL DEFAULT false,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  UNIQUE(attempt_id, question_id)\n)

\n\nALTER TABLE public.mock_tests ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_questions ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_answer_keys ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_answers ENABLE ROW LEVEL SECURITY

\n\n-- Tests: public catalog access is restricted to published tests for signed-in students.\nDROP POLICY IF EXISTS "mock_tests_select" ON public.mock_tests

\nCREATE POLICY "mock_tests_select" ON public.mock_tests FOR SELECT TO authenticated USING (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid() OR status = 'published'\n)

\n\nDROP POLICY IF EXISTS "mock_tests_insert" ON public.mock_tests

\nCREATE POLICY "mock_tests_insert" ON public.mock_tests FOR INSERT TO authenticated WITH CHECK (\n  public.is_admin() OR (created_by = auth.uid() AND (assigned_teacher_id IS NULL OR assigned_teacher_id = auth.uid()))\n)

\n\nDROP POLICY IF EXISTS "mock_tests_update" ON public.mock_tests

\nCREATE POLICY "mock_tests_update" ON public.mock_tests FOR UPDATE TO authenticated USING (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid()\n) WITH CHECK (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid()\n)

\n\nDROP POLICY IF EXISTS "mock_tests_delete" ON public.mock_tests

\nCREATE POLICY "mock_tests_delete" ON public.mock_tests FOR DELETE TO authenticated USING (\n  public.is_admin() OR (created_by = auth.uid() AND status IN ('draft', 'rejected'))\n)

\n\n-- Questions: students can read questions for published tests, not answer keys.\nDROP POLICY IF EXISTS "mock_questions_select" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_select" ON public.mock_test_questions FOR SELECT TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (t.status = 'published' OR t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_questions_insert" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_insert" ON public.mock_test_questions FOR INSERT TO authenticated WITH CHECK (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_questions_update" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_update" ON public.mock_test_questions FOR UPDATE TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n) WITH CHECK (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_questions_delete" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_delete" ON public.mock_test_questions FOR DELETE TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\n-- Answer keys are only visible to admins and the responsible teacher.\nDROP POLICY IF EXISTS "mock_keys_select" ON public.mock_test_answer_keys

\nCREATE POLICY "mock_keys_select" ON public.mock_test_answer_keys FOR SELECT TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE q.id = mock_test_answer_keys.question_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_keys_insert" ON public.mock_test_answer_keys

\nCREATE POLICY "mock_keys_insert" ON public.mock_test_answer_keys FOR INSERT TO authenticated WITH CHECK (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE q.id = mock_test_answer_keys.question_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_keys_update" ON public.mock_test_answer_keys

\nCREATE POLICY "mock_keys_update" ON public.mock_test_answer_keys FOR UPDATE TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE q.id = mock_test_answer_keys.question_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n) WITH CHECK (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE q.id = mock_test_answer_keys.question_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_keys_delete" ON public.mock_test_answer_keys

\nCREATE POLICY "mock_keys_delete" ON public.mock_test_answer_keys FOR DELETE TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE q.id = mock_test_answer_keys.question_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    AND t.status IN ('draft', 'rejected')\n  )\n)

\n\n-- Attempts: students see their own, staff see attempts for their tests. Inserts are only through the scorer.\nDROP POLICY IF EXISTS "mock_attempts_select" ON public.mock_test_attempts

\nCREATE POLICY "mock_attempts_select" ON public.mock_test_attempts FOR SELECT TO authenticated USING (\n  student_id = auth.uid() OR public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_attempts.test_id\n    AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_attempts_insert_blocked" ON public.mock_test_attempts

\nCREATE POLICY "mock_attempts_insert_blocked" ON public.mock_test_attempts FOR INSERT TO authenticated WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "mock_attempts_update_blocked" ON public.mock_test_attempts

\nCREATE POLICY "mock_attempts_update_blocked" ON public.mock_test_attempts FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "mock_attempts_delete_own_or_admin" ON public.mock_test_attempts

\nCREATE POLICY "mock_attempts_delete_own_or_admin" ON public.mock_test_attempts FOR DELETE TO authenticated USING (student_id = auth.uid() OR public.is_admin())

\n\n-- Answers follow the attempt visibility rules.\nDROP POLICY IF EXISTS "mock_answers_select" ON public.mock_test_answers

\nCREATE POLICY "mock_answers_select" ON public.mock_test_answers FOR SELECT TO authenticated USING (\n  EXISTS (\n    SELECT 1 FROM public.mock_test_attempts a\n    WHERE a.id = mock_test_answers.attempt_id\n    AND (a.student_id = auth.uid() OR public.is_admin() OR EXISTS (\n      SELECT 1 FROM public.mock_tests t\n      WHERE t.id = a.test_id AND (t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n    ))\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_answers_insert_blocked" ON public.mock_test_answers

\nCREATE POLICY "mock_answers_insert_blocked" ON public.mock_test_answers FOR INSERT TO authenticated WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "mock_answers_update_blocked" ON public.mock_test_answers

\nCREATE POLICY "mock_answers_update_blocked" ON public.mock_test_answers FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "mock_answers_delete_own_or_admin" ON public.mock_test_answers

\nCREATE POLICY "mock_answers_delete_own_or_admin" ON public.mock_test_answers FOR DELETE TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_test_attempts a WHERE a.id = mock_test_answers.attempt_id AND a.student_id = auth.uid()\n  )\n)

\n\n-- Server-side scorer. The client sends only question IDs and selected option indexes.\nCREATE OR REPLACE FUNCTION public.submit_mock_test(p_test_id uuid, p_answers jsonb)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_student_id uuid := auth.uid()

\n  v_attempt_count integer

\n  v_attempt_limit integer

\n  v_attempt_number integer

\n  v_attempt_id uuid

\n  v_score integer := 0

\n  v_total integer := 0

\n  v_question record

\n  v_answer jsonb

\n  v_selected integer

\n  v_correct boolean

\n  v_percentage numeric(5,2)

\nBEGIN\n  IF v_student_id IS NULL THEN\n    RAISE EXCEPTION 'Authentication required'

\n  END IF

\n\n  IF jsonb_typeof(p_answers) <> 'array' THEN\n    RAISE EXCEPTION 'Invalid answers'

\n  END IF

\n\n  SELECT attempt_limit INTO v_attempt_limit\n  FROM public.mock_tests\n  WHERE id = p_test_id AND status = 'published'

\n\n  IF v_attempt_limit IS NULL THEN\n    RAISE EXCEPTION 'Test unavailable'

\n  END IF

\n\n  SELECT count(*)::integer INTO v_attempt_count\n  FROM public.mock_test_attempts\n  WHERE test_id = p_test_id AND student_id = v_student_id

\n\n  IF v_attempt_count >= v_attempt_limit THEN\n    RAISE EXCEPTION 'Attempt limit reached'

\n  END IF

\n\n  v_attempt_number := v_attempt_count + 1

\n  INSERT INTO public.mock_test_attempts (test_id, student_id, attempt_number)\n  VALUES (p_test_id, v_student_id, v_attempt_number)\n  RETURNING id INTO v_attempt_id

\n\n  FOR v_question IN\n    SELECT q.id, q.points, k.correct_answer\n    FROM public.mock_test_questions q\n    JOIN public.mock_test_answer_keys k ON k.question_id = q.id\n    WHERE q.test_id = p_test_id\n    ORDER BY q.question_order\n  LOOP\n    v_total := v_total + v_question.points

\n    v_answer := COALESCE((SELECT item FROM jsonb_array_elements(p_answers) item WHERE item->>'question_id' = v_question.id::text LIMIT 1), '{}'::jsonb)

\n    v_selected := COALESCE((v_answer->>'selected_answer')::integer, -1)

\n    v_correct := v_selected = v_question.correct_answer

\n    IF v_correct THEN\n      v_score := v_score + v_question.points

\n    END IF

\n\n    INSERT INTO public.mock_test_answers (attempt_id, question_id, selected_answer, is_correct)\n    VALUES (v_attempt_id, v_question.id, v_selected, v_correct)

\n  END LOOP

\n\n  v_percentage := CASE WHEN v_total = 0 THEN 0 ELSE round((v_score::numeric / v_total::numeric) * 100, 2) END

\n\n  UPDATE public.mock_test_attempts\n  SET score = v_score, total_points = v_total, percentage = v_percentage, submitted_at = now()\n  WHERE id = v_attempt_id

\n\n  RETURN jsonb_build_object(\n    'attempt_id', v_attempt_id,\n    'score', v_score,\n    'total_points', v_total,\n    'percentage', v_percentage,\n    'attempt_number', v_attempt_number\n  )

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.submit_mock_test(uuid, jsonb) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.submit_mock_test(uuid, jsonb) FROM anon

\nGRANT EXECUTE ON FUNCTION public.submit_mock_test(uuid, jsonb) TO authenticated

\n\n-- Admin/teacher catalog and results indexes.\nCREATE INDEX IF NOT EXISTS idx_mock_tests_status ON public.mock_tests(status)

\nCREATE INDEX IF NOT EXISTS idx_mock_tests_created_by ON public.mock_tests(created_by)

\nCREATE INDEX IF NOT EXISTS idx_mock_tests_assigned_teacher ON public.mock_tests(assigned_teacher_id)

\nCREATE INDEX IF NOT EXISTS idx_mock_tests_course ON public.mock_tests(course_id)

\nCREATE INDEX IF NOT EXISTS idx_mock_questions_test_order ON public.mock_test_questions(test_id, question_order)

\nCREATE INDEX IF NOT EXISTS idx_mock_attempts_test ON public.mock_test_attempts(test_id)

\nCREATE INDEX IF NOT EXISTS idx_mock_attempts_student ON public.mock_test_attempts(student_id)

\n\nCREATE OR REPLACE FUNCTION public.update_mock_test_updated_at()\nRETURNS trigger\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  NEW.updated_at = now()

\n  RETURN NEW

\nEND

\n$$

\n\nDROP TRIGGER IF EXISTS mock_tests_updated_at ON public.mock_tests

\nCREATE TRIGGER mock_tests_updated_at BEFORE UPDATE ON public.mock_tests\nFOR EACH ROW EXECUTE FUNCTION public.update_mock_test_updated_at()
