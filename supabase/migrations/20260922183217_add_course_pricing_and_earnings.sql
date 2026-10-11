/*\n# Course Pricing, Approval & Teacher Earnings\n\n## Overview\nAdds a full course approval workflow: teachers set a suggested price and submit courses for review

 admins set the final price, approve/reject, publish/unpublish, and manage discounts. A teacher_earnings table tracks revenue share for each paid enrollment.\n\n## Modified Tables\n- `courses` - Added columns: suggested_price, final_price, discount_price, discount_active, discount_expires_at, admin_status, rejection_reason, published_at. Changed status semantics: now tracks admin approval state (draft, pending_review, approved, rejected, published, unpublished).\n\n## New Tables\n- `teacher_earnings` - Records each paid enrollment's earnings split (teacher share, platform share, amount).\n\n## Security\n- RLS enabled on teacher_earnings.\n- Column-level UPDATE restrictions on courses: teachers can only set suggested_price (not final_price, discount_price, admin_status, published_at).\n- A SECURITY DEFINER function `enroll_in_course` handles paid enrollment atomically.\n\n## Important Notes\n1. Teachers cannot publish courses or set final prices — only admins can.\n2. Students see final_price (or discount_price if active) on published courses.\n3. Teacher earnings are calculated as a configurable percentage (default 70%) of the final price.\n4. Free courses (final_price = 0) bypass payment and enroll directly.\n*/\n\nALTER TABLE public.courses\n  ADD COLUMN IF NOT EXISTS suggested_price numeric(10,2) DEFAULT 0,\n  ADD COLUMN IF NOT EXISTS final_price numeric(10,2) DEFAULT 0,\n  ADD COLUMN IF NOT EXISTS discount_price numeric(10,2) DEFAULT 0,\n  ADD COLUMN IF NOT EXISTS discount_active boolean DEFAULT false,\n  ADD COLUMN IF NOT EXISTS discount_expires_at timestamptz,\n  ADD COLUMN IF NOT EXISTS admin_status text DEFAULT 'draft' CHECK (admin_status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'unpublished')),\n  ADD COLUMN IF NOT EXISTS rejection_reason text,\n  ADD COLUMN IF NOT EXISTS published_at timestamptz

\n\nCREATE TABLE IF NOT EXISTS public.teacher_earnings (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,\n  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,\n  enrollment_id uuid NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,\n  course_price numeric(10,2) NOT NULL DEFAULT 0,\n  teacher_share_percent integer NOT NULL DEFAULT 70 CHECK (teacher_share_percent >= 0 AND teacher_share_percent <= 100),\n  teacher_earnings numeric(10,2) NOT NULL DEFAULT 0,\n  platform_earnings numeric(10,2) NOT NULL DEFAULT 0,\n  created_at timestamptz NOT NULL DEFAULT now()\n)

\n\nALTER TABLE public.teacher_earnings ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "earnings_select" ON public.teacher_earnings

\nCREATE POLICY "earnings_select" ON public.teacher_earnings FOR SELECT TO authenticated USING (\n  teacher_id = auth.uid() OR student_id = auth.uid() OR public.is_admin()\n)

\n\nDROP POLICY IF EXISTS "earnings_insert_blocked" ON public.teacher_earnings

\nCREATE POLICY "earnings_insert_blocked" ON public.teacher_earnings FOR INSERT TO authenticated WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "earnings_update_blocked" ON public.teacher_earnings

\nCREATE POLICY "earnings_update_blocked" ON public.teacher_earnings FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "earnings_delete_admin" ON public.teacher_earnings

\nCREATE POLICY "earnings_delete_admin" ON public.teacher_earnings FOR DELETE TO authenticated USING (public.is_admin())

\n\nREVOKE UPDATE ON public.courses FROM authenticated

\nGRANT UPDATE (title, description, category, image_url, suggested_price) ON public.courses TO authenticated

\n\nDROP POLICY IF EXISTS "courses_select_all" ON public.courses

\nCREATE POLICY "courses_select_all" ON public.courses FOR SELECT TO authenticated USING (\n  public.is_admin() OR teacher_id = auth.uid() OR admin_status = 'published'\n)

\n\nDROP POLICY IF EXISTS "courses_insert_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_insert_teacher_or_admin" ON public.courses FOR INSERT TO authenticated WITH CHECK (\n  public.is_admin() OR auth.uid() = teacher_id\n)

\n\nDROP POLICY IF EXISTS "courses_update_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_update_teacher_or_admin" ON public.courses FOR UPDATE TO authenticated USING (\n  public.is_admin() OR auth.uid() = teacher_id\n) WITH CHECK (\n  public.is_admin() OR auth.uid() = teacher_id\n)

\n\nDROP POLICY IF EXISTS "courses_delete_teacher_or_admin" ON public.courses

\nCREATE POLICY "courses_delete_teacher_or_admin" ON public.courses FOR DELETE TO authenticated USING (\n  public.is_admin() OR (auth.uid() = teacher_id AND admin_status IN ('draft', 'rejected'))\n)

\n\nCREATE OR REPLACE FUNCTION public.enroll_in_course(p_course_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_student_id uuid := auth.uid()

\n  v_course public.courses%ROWTYPE

\n  v_effective_price numeric(10,2)

\n  v_enrollment_id uuid

\n  v_teacher_share integer := 70

\n  v_teacher_earnings numeric(10,2)

\n  v_platform_earnings numeric(10,2)

\n  v_existing_count integer

\nBEGIN\n  IF v_student_id IS NULL THEN\n    RAISE EXCEPTION 'Authentication required'

\n  END IF

\n\n  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id

\n\n  IF v_course IS NULL THEN\n    RAISE EXCEPTION 'Course not found'

\n  END IF

\n\n  IF v_course.admin_status <> 'published' THEN\n    RAISE EXCEPTION 'Course is not available for enrollment'

\n  END IF

\n\n  SELECT count(*) INTO v_existing_count FROM public.enrollments\n  WHERE course_id = p_course_id AND student_id = v_student_id

\n\n  IF v_existing_count > 0 THEN\n    RAISE EXCEPTION 'Already enrolled in this course'

\n  END IF

\n\n  v_effective_price := v_course.final_price

\n  IF v_course.discount_active AND v_course.discount_price > 0\n     AND (v_course.discount_expires_at IS NULL OR v_course.discount_expires_at > now()) THEN\n    v_effective_price := LEAST(v_course.final_price, v_course.discount_price)

\n  END IF

\n\n  INSERT INTO public.enrollments (course_id, student_id, status)\n  VALUES (p_course_id, v_student_id, 'active')\n  RETURNING id INTO v_enrollment_id

\n\n  IF v_effective_price > 0 THEN\n    v_teacher_earnings := ROUND(v_effective_price * v_teacher_share / 100, 2)

\n    v_platform_earnings := v_effective_price - v_teacher_earnings

\n\n    INSERT INTO public.teacher_earnings (\n      teacher_id, course_id, student_id, enrollment_id,\n      course_price, teacher_share_percent, teacher_earnings, platform_earnings\n    ) VALUES (\n      v_course.teacher_id, p_course_id, v_student_id, v_enrollment_id,\n      v_effective_price, v_teacher_share, v_teacher_earnings, v_platform_earnings\n    )

\n  END IF

\n\n  RETURN jsonb_build_object(\n    'enrollment_id', v_enrollment_id,\n    'price_paid', v_effective_price\n  )

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.enroll_in_course(uuid) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.enroll_in_course(uuid) FROM anon

\nGRANT EXECUTE ON FUNCTION public.enroll_in_course(uuid) TO authenticated

\n\nCREATE INDEX IF NOT EXISTS idx_earnings_teacher ON public.teacher_earnings(teacher_id)

\nCREATE INDEX IF NOT EXISTS idx_earnings_course ON public.teacher_earnings(course_id)

\nCREATE INDEX IF NOT EXISTS idx_earnings_student ON public.teacher_earnings(student_id)
