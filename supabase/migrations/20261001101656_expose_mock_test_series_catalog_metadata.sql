/*\n# Expose Mock Series Catalog Metadata\n\n## Overview\nLets signed-in students see the names and basic metadata of published tests inside a series so the series syllabus can be displayed before purchase.\n\n## Security\nOnly published test metadata is exposed. Question text, answer keys, solution videos, and server-side attempts remain restricted by the student's free-preview or active-purchase entitlement.\n*/\nDROP POLICY IF EXISTS "mock_tests_select" ON public.mock_tests

\nCREATE POLICY "mock_tests_select" ON public.mock_tests FOR SELECT TO authenticated USING (\n  public.is_admin() OR created_by = auth.uid() OR assigned_teacher_id = auth.uid() OR status = 'published'\n)

\n
