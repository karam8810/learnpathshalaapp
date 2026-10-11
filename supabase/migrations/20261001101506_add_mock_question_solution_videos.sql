/*\n# Add Mock Question Solution Videos\n\n## Overview\nAdds optional video solutions to individual mock-test questions. Admins and assigned teachers can upload videos while creating or managing questions, and eligible students can watch them after opening an allowed test.\n\n## Modified Tables\n- `mock_test_questions.solution_video_path` - Private Storage path for the optional solution video.\n\n## Storage\n- Creates the private `mock-solution-videos` bucket.\n- Allows admins and the responsible teacher to upload and manage videos under `{user_id}/{question_id}/...`.\n- Allows students to read a video only when they can access the related free, preview, or purchased mock test.\n\n## Security\n- Videos are private and served through signed URLs.\n- Storage policies check the linked question and mock-test entitlement server-side.\n*/\n\nALTER TABLE public.mock_test_questions ADD COLUMN IF NOT EXISTS solution_video_path text

\n\nINSERT INTO storage.buckets (id, name, public)\nVALUES ('mock-solution-videos', 'mock-solution-videos', false)\nON CONFLICT (id) DO UPDATE SET public = false

\n\nDROP POLICY IF EXISTS "mock_solution_videos_select" ON storage.objects

\nCREATE POLICY "mock_solution_videos_select" ON storage.objects FOR SELECT TO authenticated USING (\n  bucket_id = 'mock-solution-videos' AND EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE split_part(name, '/', 2)::uuid = q.id\n    AND (\n      public.is_admin() OR t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid()\n      OR t.is_free\n      OR EXISTS (SELECT 1 FROM public.mock_test_series_tests st WHERE st.test_id = t.id AND st.is_free_preview)\n      OR EXISTS (\n        SELECT 1 FROM public.mock_test_series_tests st\n        JOIN public.mock_test_series_purchases sp ON sp.series_id = st.series_id\n        WHERE st.test_id = t.id AND sp.student_id = auth.uid() AND sp.status = 'active' AND sp.expires_at > now()\n      )\n    )\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_solution_videos_insert" ON storage.objects

\nCREATE POLICY "mock_solution_videos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (\n  bucket_id = 'mock-solution-videos' AND split_part(name, '/', 1) = auth.uid()::text AND EXISTS (\n    SELECT 1 FROM public.mock_test_questions q\n    JOIN public.mock_tests t ON t.id = q.test_id\n    WHERE split_part(name, '/', 2)::uuid = q.id\n    AND (public.is_admin() OR t.created_by = auth.uid() OR t.assigned_teacher_id = auth.uid())\n  )\n)

\n\nDROP POLICY IF EXISTS "mock_solution_videos_update" ON storage.objects

\nCREATE POLICY "mock_solution_videos_update" ON storage.objects FOR UPDATE TO authenticated USING (\n  bucket_id = 'mock-solution-videos' AND split_part(name, '/', 1) = auth.uid()::text\n) WITH CHECK (\n  bucket_id = 'mock-solution-videos' AND split_part(name, '/', 1) = auth.uid()::text\n)

\n\nDROP POLICY IF EXISTS "mock_solution_videos_delete" ON storage.objects

\nCREATE POLICY "mock_solution_videos_delete" ON storage.objects FOR DELETE TO authenticated USING (\n  bucket_id = 'mock-solution-videos' AND (public.is_admin() OR split_part(name, '/', 1) = auth.uid()::text)\n)

\n
