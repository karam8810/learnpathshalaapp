/*\n# Create Mock Test Series Catalog\n\n## Overview\nCreates the product catalog for complete mock-test series, including series metadata, included tests, and subject lists.\n\n## New Tables\n- `mock_test_series` - Published or draft series product details, price, and validity.\n- `mock_test_series_tests` - Existing mock tests included in each series.\n- `mock_test_series_subjects` - Subjects displayed for each series.\n\n## Security\n- RLS is enabled on all tables.\n- Published catalog data is readable by signed-in students.\n- Only admins can create, update, or delete series content.\n*/\nCREATE TABLE IF NOT EXISTS public.mock_test_series (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text,\n  exam_name text NOT NULL DEFAULT 'General', category text NOT NULL DEFAULT 'General', image_url text,\n  is_free boolean NOT NULL DEFAULT false, price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),\n  original_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (original_price >= 0), validity_days integer NOT NULL DEFAULT 365 CHECK (validity_days > 0 AND validity_days <= 3650),\n  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished')),\n  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,\n  published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()\n)

\nCREATE TABLE IF NOT EXISTS public.mock_test_series_tests (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), series_id uuid NOT NULL REFERENCES public.mock_test_series(id) ON DELETE CASCADE,\n  test_id uuid NOT NULL REFERENCES public.mock_tests(id) ON DELETE CASCADE, section_name text NOT NULL DEFAULT 'Full Length Mocks',\n  test_order integer NOT NULL DEFAULT 1 CHECK (test_order > 0), is_free_preview boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),\n  UNIQUE(series_id, test_id), UNIQUE(series_id, section_name, test_order)\n)

\nCREATE TABLE IF NOT EXISTS public.mock_test_series_subjects (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), series_id uuid NOT NULL REFERENCES public.mock_test_series(id) ON DELETE CASCADE,\n  name text NOT NULL, subject_order integer NOT NULL DEFAULT 1 CHECK (subject_order > 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(series_id, name)\n)

\nALTER TABLE public.mock_test_series ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_series_tests ENABLE ROW LEVEL SECURITY

\nALTER TABLE public.mock_test_series_subjects ENABLE ROW LEVEL SECURITY

\nDROP POLICY IF EXISTS "series_select_published_or_admin" ON public.mock_test_series

\nCREATE POLICY "series_select_published_or_admin" ON public.mock_test_series FOR SELECT TO authenticated USING (public.is_admin() OR created_by = auth.uid() OR status = 'published')

\nDROP POLICY IF EXISTS "series_insert_admin" ON public.mock_test_series

\nCREATE POLICY "series_insert_admin" ON public.mock_test_series FOR INSERT TO authenticated WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_update_admin" ON public.mock_test_series

\nCREATE POLICY "series_update_admin" ON public.mock_test_series FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_delete_admin" ON public.mock_test_series

\nCREATE POLICY "series_delete_admin" ON public.mock_test_series FOR DELETE TO authenticated USING (public.is_admin())

\nDROP POLICY IF EXISTS "series_tests_select_catalog" ON public.mock_test_series_tests

\nCREATE POLICY "series_tests_select_catalog" ON public.mock_test_series_tests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.mock_test_series s WHERE s.id = series_id AND (s.status = 'published' OR public.is_admin() OR s.created_by = auth.uid())))

\nDROP POLICY IF EXISTS "series_tests_insert_admin" ON public.mock_test_series_tests

\nCREATE POLICY "series_tests_insert_admin" ON public.mock_test_series_tests FOR INSERT TO authenticated WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_tests_update_admin" ON public.mock_test_series_tests

\nCREATE POLICY "series_tests_update_admin" ON public.mock_test_series_tests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_tests_delete_admin" ON public.mock_test_series_tests

\nCREATE POLICY "series_tests_delete_admin" ON public.mock_test_series_tests FOR DELETE TO authenticated USING (public.is_admin())

\nDROP POLICY IF EXISTS "series_subjects_select_catalog" ON public.mock_test_series_subjects

\nCREATE POLICY "series_subjects_select_catalog" ON public.mock_test_series_subjects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.mock_test_series s WHERE s.id = series_id AND (s.status = 'published' OR public.is_admin() OR s.created_by = auth.uid())))

\nDROP POLICY IF EXISTS "series_subjects_insert_admin" ON public.mock_test_series_subjects

\nCREATE POLICY "series_subjects_insert_admin" ON public.mock_test_series_subjects FOR INSERT TO authenticated WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_subjects_update_admin" ON public.mock_test_series_subjects

\nCREATE POLICY "series_subjects_update_admin" ON public.mock_test_series_subjects FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())

\nDROP POLICY IF EXISTS "series_subjects_delete_admin" ON public.mock_test_series_subjects

\nCREATE POLICY "series_subjects_delete_admin" ON public.mock_test_series_subjects FOR DELETE TO authenticated USING (public.is_admin())

\n
