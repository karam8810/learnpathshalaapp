/*\n# Secure Mock Test Series Attempts\n\n## Overview\nEnsures the server-side scoring function enforces the same free-preview and active-purchase rules as the browser interface.\n\n## Security\n- A student can submit a free test, a marked free preview, or a test included in an active unexpired series purchase.\n- Paid tests cannot be attempted by calling the database function directly without entitlement.\n*/\nCREATE OR REPLACE FUNCTION public.submit_mock_test(p_test_id uuid, p_answers jsonb)\nRETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$\nDECLARE\n  v_student_id uuid := auth.uid()

 v_attempt_count integer

 v_attempt_limit integer

 v_attempt_number integer

 v_attempt_id uuid

\n  v_score integer := 0

 v_total integer := 0

 v_question record

 v_answer jsonb

 v_selected integer

 v_correct boolean

 v_percentage numeric(5,2)

 v_allowed boolean

\nBEGIN\n  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Authentication required'

 END IF

\n  IF jsonb_typeof(p_answers) <> 'array' THEN RAISE EXCEPTION 'Invalid answers'

 END IF

\n  SELECT EXISTS (\n    SELECT 1 FROM public.mock_tests t WHERE t.id = p_test_id AND t.status = 'published' AND (\n      t.is_free OR EXISTS (SELECT 1 FROM public.mock_test_series_tests st WHERE st.test_id = t.id AND st.is_free_preview) OR EXISTS (\n        SELECT 1 FROM public.mock_test_series_tests st JOIN public.mock_test_series_purchases sp ON sp.series_id = st.series_id\n        WHERE st.test_id = t.id AND sp.student_id = v_student_id AND sp.status = 'active' AND sp.expires_at > now()\n      )\n    )\n  ) INTO v_allowed

\n  IF NOT v_allowed THEN RAISE EXCEPTION 'Test unavailable'

 END IF

\n  SELECT attempt_limit INTO v_attempt_limit FROM public.mock_tests WHERE id = p_test_id AND status = 'published'

\n  IF v_attempt_limit IS NULL THEN RAISE EXCEPTION 'Test unavailable'

 END IF

\n  SELECT count(*)::integer INTO v_attempt_count FROM public.mock_test_attempts WHERE test_id = p_test_id AND student_id = v_student_id

\n  IF v_attempt_count >= v_attempt_limit THEN RAISE EXCEPTION 'Attempt limit reached'

 END IF

\n  v_attempt_number := v_attempt_count + 1

\n  INSERT INTO public.mock_test_attempts (test_id, student_id, attempt_number) VALUES (p_test_id, v_student_id, v_attempt_number) RETURNING id INTO v_attempt_id

\n  FOR v_question IN SELECT q.id, q.points, k.correct_answer FROM public.mock_test_questions q JOIN public.mock_test_answer_keys k ON k.question_id = q.id WHERE q.test_id = p_test_id ORDER BY q.question_order LOOP\n    v_total := v_total + v_question.points

\n    v_answer := COALESCE((SELECT item FROM jsonb_array_elements(p_answers) item WHERE item->>'question_id' = v_question.id::text LIMIT 1), '{}'::jsonb)

\n    v_selected := COALESCE((v_answer->>'selected_answer')::integer, -1)

 v_correct := v_selected = v_question.correct_answer

\n    IF v_correct THEN v_score := v_score + v_question.points

 END IF

\n    INSERT INTO public.mock_test_answers (attempt_id, question_id, selected_answer, is_correct) VALUES (v_attempt_id, v_question.id, v_selected, v_correct)

\n  END LOOP

\n  v_percentage := CASE WHEN v_total = 0 THEN 0 ELSE round((v_score::numeric / v_total::numeric) * 100, 2) END

\n  UPDATE public.mock_test_attempts SET score = v_score, total_points = v_total, percentage = v_percentage, submitted_at = now() WHERE id = v_attempt_id

\n  RETURN jsonb_build_object('attempt_id', v_attempt_id, 'score', v_score, 'total_points', v_total, 'percentage', v_percentage, 'attempt_number', v_attempt_number)

\nEND

 $$

\nREVOKE ALL ON FUNCTION public.submit_mock_test(uuid, jsonb) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.submit_mock_test(uuid, jsonb) FROM anon

\nGRANT EXECUTE ON FUNCTION public.submit_mock_test(uuid, jsonb) TO authenticated

\n
