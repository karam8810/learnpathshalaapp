/*\n# Allow Mock Series Free Previews\n\n## Overview\nAllows students to view and attempt tests that an admin marks as free previews inside a paid series.\n\n## Security\nOnly published preview tests are exposed

 paid tests still require an active unexpired series purchase.\n*/\nDROP POLICY IF EXISTS "mock_tests_select" ON public.mock_tests

\nCREATE POLICY "mock_tests_select" ON public.mock_tests FOR SELECT TO authenticated USING (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid()\n  OR (status = 'published' AND is_free)\n  OR (status = 'published' AND EXISTS (\n    SELECT 1 FROM public.mock_test_series_tests preview_link\n    WHERE preview_link.test_id = mock_tests.id AND preview_link.is_free_preview = true\n  ))\n  OR (status = 'published' AND EXISTS (\n    SELECT 1 FROM public.mock_test_series_tests purchase_link\n    JOIN public.mock_test_series_purchases purchase ON purchase.series_id = purchase_link.series_id\n    WHERE purchase_link.test_id = mock_tests.id AND purchase.student_id = auth.uid() AND purchase.status = 'active' AND purchase.expires_at > now()\n  ))\n)

\nDROP POLICY IF EXISTS "mock_questions_select" ON public.mock_test_questions

\nCREATE POLICY "mock_questions_select" ON public.mock_test_questions FOR SELECT TO authenticated USING (\n  public.is_admin() OR EXISTS (\n    SELECT 1 FROM public.mock_tests t\n    WHERE t.id = mock_test_questions.test_id\n    AND (\n      t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid()\n      OR (t.status = 'published' AND t.is_free)\n      OR (t.status = 'published' AND EXISTS (SELECT 1 FROM public.mock_test_series_tests preview_link WHERE preview_link.test_id = t.id AND preview_link.is_free_preview = true))\n      OR (t.status = 'published' AND EXISTS (\n        SELECT 1 FROM public.mock_test_series_tests purchase_link\n        JOIN public.mock_test_series_purchases purchase ON purchase.series_id = purchase_link.series_id\n        WHERE purchase_link.test_id = t.id AND purchase.student_id = auth.uid() AND purchase.status = 'active' AND purchase.expires_at > now()\n      ))\n    )\n  )\n)

\n
