/*\n# Add Mock Series Purchases and Access Rules\n\n## Overview\nAdds student ownership records and secure server functions for purchasing complete mock-test series through PayU.\n\n## New Table\n- `mock_test_series_purchases` - Student ownership, paid amount, status, and expiry date.\n\n## Security\n- RLS is enabled and students can only read their own purchases.\n- Payment creation and completion are restricted to server functions.\n- Paid test access is granted only through an active, unexpired series purchase.\n*/\nCREATE TABLE IF NOT EXISTS public.mock_test_series_purchases (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  series_id uuid NOT NULL REFERENCES public.mock_test_series(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  transaction_id uuid REFERENCES public.mock_series_payment_transactions(id) ON DELETE SET NULL,\n  amount_paid numeric(10,2) NOT NULL DEFAULT 0,\n  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded')),\n  purchased_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,\n  UNIQUE(series_id, student_id)\n)

\nALTER TABLE public.mock_test_series_purchases ENABLE ROW LEVEL SECURITY

\nDROP POLICY IF EXISTS "series_purchases_select_own_or_admin" ON public.mock_test_series_purchases

\nCREATE POLICY "series_purchases_select_own_or_admin" ON public.mock_test_series_purchases FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_admin())

\nDROP POLICY IF EXISTS "series_purchases_insert_blocked" ON public.mock_test_series_purchases

\nCREATE POLICY "series_purchases_insert_blocked" ON public.mock_test_series_purchases FOR INSERT TO authenticated WITH CHECK (false)

\nDROP POLICY IF EXISTS "series_purchases_update_blocked" ON public.mock_test_series_purchases

\nCREATE POLICY "series_purchases_update_blocked" ON public.mock_test_series_purchases FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\nDROP POLICY IF EXISTS "series_purchases_delete_admin" ON public.mock_test_series_purchases

\nCREATE POLICY "series_purchases_delete_admin" ON public.mock_test_series_purchases FOR DELETE TO authenticated USING (public.is_admin())

\n\nDROP POLICY IF EXISTS "mock_tests_select" ON public.mock_tests

\nCREATE POLICY "mock_tests_select" ON public.mock_tests FOR SELECT TO authenticated USING (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid() OR (\n    status = 'published' AND (is_free OR EXISTS (\n      SELECT 1 FROM public.mock_test_series_tests st\n      JOIN public.mock_test_series_purchases sp ON sp.series_id = st.series_id\n      WHERE st.test_id = mock_tests.id AND sp.student_id = auth.uid() AND sp.status = 'active' AND sp.expires_at > now()\n    ))\n  )\n)

\nDROP POLICY IF EXISTS "mock_questions_select" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_select" ON public.mock_test_questions FOR SELECT TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t WHERE t.id = mock_test_questions.test_id AND (\n      t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid() OR (t.status = 'published' AND (t.is_free OR EXISTS (\n        SELECT 1 FROM public.mock_test_series_tests st JOIN public.mock_test_series_purchases sp ON sp.series_id = st.series_id\n        WHERE st.test_id = t.id AND sp.student_id = auth.uid() AND sp.status = 'active' AND sp.expires_at > now()\n      )))\n    )\n  )\n)

\n\nCREATE OR REPLACE FUNCTION public.create_mock_series_payment(p_series_id uuid)\nRETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$\nDECLARE v_student_id uuid := auth.uid()

 v_series public.mock_test_series%ROWTYPE

 v_existing public.mock_test_series_purchases%ROWTYPE

 v_txnid text

\nBEGIN\n  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Authentication required'

 END IF

\n  SELECT * INTO v_series FROM public.mock_test_series WHERE id = p_series_id AND status = 'published'

\n  IF v_series IS NULL THEN RAISE EXCEPTION 'Series not available'

 END IF

\n  SELECT * INTO v_existing FROM public.mock_test_series_purchases WHERE series_id = p_series_id AND student_id = v_student_id AND status = 'active' AND expires_at > now()

\n  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'Already purchased'

 END IF

\n  IF v_series.is_free OR v_series.price <= 0 THEN RAISE EXCEPTION 'This series is free'

 END IF

\n  UPDATE public.mock_series_payment_transactions SET status = 'cancelled', updated_at = now() WHERE series_id = p_series_id AND student_id = v_student_id AND status = 'pending'

\n  v_txnid := 'MTS' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))

\n  INSERT INTO public.mock_series_payment_transactions (txnid, series_id, student_id, amount) VALUES (v_txnid, p_series_id, v_student_id, v_series.price)

\n  RETURN jsonb_build_object('txnid', v_txnid, 'amount', v_series.price, 'series_id', p_series_id, 'series_title', v_series.title)

\nEND

 $$

\nREVOKE ALL ON FUNCTION public.create_mock_series_payment(uuid) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.create_mock_series_payment(uuid) FROM anon

\nGRANT EXECUTE ON FUNCTION public.create_mock_series_payment(uuid) TO authenticated

\n\nCREATE OR REPLACE FUNCTION public.complete_mock_series_payment(p_txnid text, p_status text, p_payu_payment_id text DEFAULT NULL, p_payu_response jsonb DEFAULT NULL)\nRETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$\nDECLARE v_txn public.mock_series_payment_transactions%ROWTYPE

 v_series public.mock_test_series%ROWTYPE

 v_purchase_id uuid

 v_expiry timestamptz

\nBEGIN\n  SELECT * INTO v_txn FROM public.mock_series_payment_transactions WHERE txnid = p_txnid

\n  IF v_txn IS NULL THEN RAISE EXCEPTION 'Transaction not found'

 END IF

\n  IF v_txn.status <> 'pending' THEN RAISE EXCEPTION 'Transaction already processed'

 END IF

\n  UPDATE public.mock_series_payment_transactions SET status = p_status, payu_payment_id = COALESCE(p_payu_payment_id, payu_payment_id), payu_response = COALESCE(p_payu_response, payu_response), updated_at = now() WHERE id = v_txn.id

\n  IF p_status <> 'success' THEN RETURN jsonb_build_object('status', p_status)

 END IF

\n  SELECT * INTO v_series FROM public.mock_test_series WHERE id = v_txn.series_id

\n  v_expiry := now() + make_interval(days => v_series.validity_days)

\n  INSERT INTO public.mock_test_series_purchases (series_id, student_id, transaction_id, amount_paid, expires_at)\n  VALUES (v_txn.series_id, v_txn.student_id, v_txn.id, v_txn.amount, v_expiry)\n  ON CONFLICT (series_id, student_id) DO UPDATE SET transaction_id = EXCLUDED.transaction_id, amount_paid = EXCLUDED.amount_paid, status = 'active', purchased_at = now(), expires_at = EXCLUDED.expires_at\n  RETURNING id INTO v_purchase_id

\n  RETURN jsonb_build_object('status', 'success', 'purchase_id', v_purchase_id, 'expires_at', v_expiry)

\nEND

 $$

\nREVOKE ALL ON FUNCTION public.complete_mock_series_payment(text, text, text, jsonb) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.complete_mock_series_payment(text, text, text, jsonb) FROM anon

\nGRANT EXECUTE ON FUNCTION public.complete_mock_series_payment(text, text, text, jsonb) TO authenticated

\nCREATE INDEX IF NOT EXISTS idx_series_tests_series ON public.mock_test_series_tests(series_id)

\nCREATE INDEX IF NOT EXISTS idx_series_tests_test ON public.mock_test_series_tests(test_id)

\nCREATE INDEX IF NOT EXISTS idx_series_purchases_student ON public.mock_test_series_purchases(student_id)

\nCREATE INDEX IF NOT EXISTS idx_series_transactions_txnid ON public.mock_series_payment_transactions(txnid)

\n
