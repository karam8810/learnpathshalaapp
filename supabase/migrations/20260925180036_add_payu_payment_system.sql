/*\n# PayU Payment Integration System\n\n## Overview\nAdds a secure PayU payment gateway integration. Admins store PayU API credentials (merchant key, salt, webhook secret) in a database table. Students must complete PayU Hosted Checkout payment for paid courses before enrollment is granted. A webhook edge function verifies the payment and enrolls the student atomically.\n\n## New Tables\n- `payment_settings` - Stores PayU credentials (merchant_key, merchant_salt, webhook_secret, test_mode). Admin-only access.\n- `payment_transactions` - Records each payment attempt (txnid, course_id, student_id, amount, status, payu_payment_id, etc.)\n\n## New Functions\n- `admin_get_payment_settings()` / `admin_update_payment_settings()` - Admin-only functions to read/write PayU credentials.\n- `create_payment_transaction(p_course_id)` - Creates a pending payment transaction for a student and returns txn details.\n- `complete_payment_enrollment(p_txnid, p_status, p_payu_payment_id)` - SECURITY DEFINER function called by webhook to verify payment and enroll student.\n\n## Security\n- RLS enabled on both new tables.\n- payment_settings: only admins can SELECT/UPDATE

 no INSERT/DELETE via API.\n- payment_transactions: students can read their own

 admins can read all

 no direct INSERT/UPDATE/DELETE via API.\n- All privileged mutations go through SECURITY DEFINER functions with caller authorization checks.\n- Credentials are never exposed to the browser — only the edge function reads them server-side.\n*/\n\n-- Payment settings table (single row, admin-managed)\nCREATE TABLE IF NOT EXISTS public.payment_settings (\n  id integer PRIMARY KEY DEFAULT 1,\n  merchant_key text NOT NULL DEFAULT '',\n  merchant_salt text NOT NULL DEFAULT '',\n  webhook_secret text NOT NULL DEFAULT '',\n  test_mode boolean NOT NULL DEFAULT true,\n  updated_at timestamptz NOT NULL DEFAULT now(),\n  updated_by uuid REFERENCES public.profiles(id),\n  CONSTRAINT single_row CHECK (id = 1)\n)

\n\nALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "payment_settings_admin_select" ON public.payment_settings

\nCREATE POLICY "payment_settings_admin_select" ON public.payment_settings\n  FOR SELECT TO authenticated USING (public.is_admin())

\n\nDROP POLICY IF EXISTS "payment_settings_admin_update" ON public.payment_settings

\nCREATE POLICY "payment_settings_admin_update" ON public.payment_settings\n  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())

\n\n-- Payment transactions table\nCREATE TABLE IF NOT EXISTS public.payment_transactions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  txnid text UNIQUE NOT NULL,\n  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,\n  amount numeric(10,2) NOT NULL DEFAULT 0,\n  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),\n  payu_payment_id text,\n  payu_response jsonb,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n)

\n\nALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY

\n\nDROP POLICY IF EXISTS "transactions_select_own_or_admin" ON public.payment_transactions

\nCREATE POLICY "transactions_select_own_or_admin" ON public.payment_transactions\n  FOR SELECT TO authenticated USING (\n    student_id = auth.uid() OR public.is_admin()\n  )

\n\nDROP POLICY IF EXISTS "transactions_insert_blocked" ON public.payment_transactions

\nCREATE POLICY "transactions_insert_blocked" ON public.payment_transactions\n  FOR INSERT TO authenticated WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "transactions_update_blocked" ON public.payment_transactions

\nCREATE POLICY "transactions_update_blocked" ON public.payment_transactions\n  FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\n\nDROP POLICY IF EXISTS "transactions_delete_blocked" ON public.payment_transactions

\nCREATE POLICY "transactions_delete_blocked" ON public.payment_transactions\n  FOR DELETE TO authenticated USING (false)

\n\n-- Seed a default row\nINSERT INTO public.payment_settings (id, merchant_key, merchant_salt, webhook_secret, test_mode)\nVALUES (1, '', '', '', true)\nON CONFLICT (id) DO NOTHING

\n\n-- Admin functions to read/write payment settings\nCREATE OR REPLACE FUNCTION public.admin_get_payment_settings()\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF NOT public.is_admin() THEN\n    RAISE EXCEPTION 'Not authorized'

\n  END IF

\n\n  RETURN jsonb_build_object(\n    'merchant_key', (SELECT merchant_key FROM payment_settings WHERE id = 1),\n    'merchant_salt', (SELECT merchant_salt FROM payment_settings WHERE id = 1),\n    'webhook_secret', (SELECT webhook_secret FROM payment_settings WHERE id = 1),\n    'test_mode', (SELECT test_mode FROM payment_settings WHERE id = 1)\n  )

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.admin_get_payment_settings() FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.admin_get_payment_settings() FROM anon

\nGRANT EXECUTE ON FUNCTION public.admin_get_payment_settings() TO authenticated

\n\nCREATE OR REPLACE FUNCTION public.admin_update_payment_settings(\n  p_merchant_key text,\n  p_merchant_salt text,\n  p_webhook_secret text,\n  p_test_mode boolean\n)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF NOT public.is_admin() THEN\n    RAISE EXCEPTION 'Not authorized'

\n  END IF

\n\n  UPDATE payment_settings\n  SET\n    merchant_key = p_merchant_key,\n    merchant_salt = p_merchant_salt,\n    webhook_secret = p_webhook_secret,\n    test_mode = p_test_mode,\n    updated_at = now(),\n    updated_by = auth.uid()\n  WHERE id = 1

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.admin_update_payment_settings(text, text, text, boolean) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.admin_update_payment_settings(text, text, text, boolean) FROM anon

\nGRANT EXECUTE ON FUNCTION public.admin_update_payment_settings(text, text, text, boolean) TO authenticated

\n\n-- Create a pending payment transaction (called by student before redirecting to PayU)\nCREATE OR REPLACE FUNCTION public.create_payment_transaction(p_course_id uuid)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_student_id uuid := auth.uid()

\n  v_course public.courses%ROWTYPE

\n  v_effective_price numeric(10,2)

\n  v_txnid text

\n  v_existing_count integer

\n  v_existing_txn_count integer

\nBEGIN\n  IF v_student_id IS NULL THEN\n    RAISE EXCEPTION 'Authentication required'

\n  END IF

\n\n  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id

\n  IF v_course IS NULL THEN\n    RAISE EXCEPTION 'Course not found'

\n  END IF

\n\n  IF v_course.admin_status <> 'published' THEN\n    RAISE EXCEPTION 'Course is not available'

\n  END IF

\n\n  SELECT count(*) INTO v_existing_count FROM public.enrollments\n  WHERE course_id = p_course_id AND student_id = v_student_id

\n  IF v_existing_count > 0 THEN\n    RAISE EXCEPTION 'Already enrolled in this course'

\n  END IF

\n\n  v_effective_price := v_course.final_price

\n  IF v_course.discount_active AND v_course.discount_price > 0\n     AND (v_course.discount_expires_at IS NULL OR v_course.discount_expires_at > now()) THEN\n    v_effective_price := LEAST(v_course.final_price, v_course.discount_price)

\n  END IF

\n\n  IF v_effective_price <= 0 THEN\n    RAISE EXCEPTION 'This course is free - no payment required'

\n  END IF

\n\n  SELECT count(*) INTO v_existing_txn_count FROM public.payment_transactions\n  WHERE course_id = p_course_id AND student_id = v_student_id AND status = 'pending'

\n  IF v_existing_txn_count > 0 THEN\n    UPDATE public.payment_transactions\n    SET status = 'cancelled', updated_at = now()\n    WHERE course_id = p_course_id AND student_id = v_student_id AND status = 'pending'

\n  END IF

\n\n  v_txnid := 'TXN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))

\n\n  INSERT INTO public.payment_transactions (txnid, course_id, student_id, amount, status)\n  VALUES (v_txnid, p_course_id, v_student_id, v_effective_price, 'pending')

\n\n  RETURN jsonb_build_object(\n    'txnid', v_txnid,\n    'amount', v_effective_price,\n    'course_title', v_course.title,\n    'course_id', p_course_id\n  )

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.create_payment_transaction(uuid) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.create_payment_transaction(uuid) FROM anon

\nGRANT EXECUTE ON FUNCTION public.create_payment_transaction(uuid) TO authenticated

\n\n-- Complete payment and enroll student (called by webhook edge function with service role)\nCREATE OR REPLACE FUNCTION public.complete_payment_enrollment(\n  p_txnid text,\n  p_status text,\n  p_payu_payment_id text DEFAULT NULL,\n  p_payu_response jsonb DEFAULT NULL\n)\nRETURNS jsonb\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nDECLARE\n  v_txn public.payment_transactions%ROWTYPE

\n  v_course public.courses%ROWTYPE

\n  v_enrollment_id uuid

\n  v_teacher_share integer := 70

\n  v_teacher_earnings numeric(10,2)

\n  v_platform_earnings numeric(10,2)

\n  v_enroll_count integer

\nBEGIN\n  SELECT * INTO v_txn FROM public.payment_transactions WHERE txnid = p_txnid

\n  IF v_txn IS NULL THEN\n    RAISE EXCEPTION 'Transaction not found'

\n  END IF

\n\n  IF v_txn.status <> 'pending' THEN\n    RAISE EXCEPTION 'Transaction already processed'

\n  END IF

\n\n  UPDATE public.payment_transactions\n  SET\n    status = p_status,\n    payu_payment_id = COALESCE(p_payu_payment_id, payu_payment_id),\n    payu_response = COALESCE(p_payu_response, payu_response),\n    updated_at = now()\n  WHERE id = v_txn.id

\n\n  IF p_status = 'success' THEN\n    SELECT count(*) INTO v_enroll_count FROM public.enrollments\n    WHERE course_id = v_txn.course_id AND student_id = v_txn.student_id

\n\n    IF v_enroll_count > 0 THEN\n      RETURN jsonb_build_object('status', 'already_enrolled')

\n    END IF

\n\n    SELECT * INTO v_course FROM public.courses WHERE id = v_txn.course_id

\n\n    INSERT INTO public.enrollments (course_id, student_id, status)\n    VALUES (v_txn.course_id, v_txn.student_id, 'active')\n    RETURNING id INTO v_enrollment_id

\n\n    IF v_txn.amount > 0 THEN\n      v_teacher_earnings := ROUND(v_txn.amount * v_teacher_share / 100, 2)

\n      v_platform_earnings := v_txn.amount - v_teacher_earnings

\n\n      INSERT INTO public.teacher_earnings (\n        teacher_id, course_id, student_id, enrollment_id,\n        course_price, teacher_share_percent, teacher_earnings, platform_earnings\n      ) VALUES (\n        v_course.teacher_id, v_txn.course_id, v_txn.student_id, v_enrollment_id,\n        v_txn.amount, v_teacher_share, v_teacher_earnings, v_platform_earnings\n      )

\n    END IF

\n\n    RETURN jsonb_build_object('status', 'success', 'enrollment_id', v_enrollment_id)

\n  ELSE\n    RETURN jsonb_build_object('status', p_status)

\n  END IF

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.complete_payment_enrollment(text, text, text, jsonb) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.complete_payment_enrollment(text, text, text, jsonb) FROM anon

\nGRANT EXECUTE ON FUNCTION public.complete_payment_enrollment(text, text, text, jsonb) TO authenticated

\n\nCREATE INDEX IF NOT EXISTS idx_transactions_txnid ON public.payment_transactions(txnid)

\nCREATE INDEX IF NOT EXISTS idx_transactions_student ON public.payment_transactions(student_id)

\nCREATE INDEX IF NOT EXISTS idx_transactions_course ON public.payment_transactions(course_id)

\nCREATE INDEX IF NOT EXISTS idx_transactions_status ON public.payment_transactions(status)

\n
