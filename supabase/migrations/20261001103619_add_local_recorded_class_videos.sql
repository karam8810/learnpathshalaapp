/*\n# Add Local Recorded Class Videos\n\n## Overview\nAdds private local video uploads for completed live classes. Admins and the responsible teacher can upload a recording from their dashboard, while enrolled students can watch it from Recorded Classes.\n\n## Modified Tables\n- `live_classes.recording_path` - Private Storage path for an uploaded class recording.\n\n## Storage\n- Creates the private `recorded-class-videos` bucket.\n- Limits uploads to 500 MB and common video formats.\n- Stores files under `{uploader_id}/{live_class_id}/...`.\n\n## Security\n- Only admins and the live class teacher can upload, replace, or delete a recording.\n- Students can read a recording only when enrolled in the linked course.\n- Existing external `recording_url` links continue to work.\n*/\n\nALTER TABLE public.live_classes ADD COLUMN IF NOT EXISTS recording_path text

\n\nINSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)\nVALUES (\n  'recorded-class-videos', 'recorded-class-videos', false, 524288000,\n  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']\n)\nON CONFLICT (id) DO UPDATE SET\n  public = false,\n  file_size_limit = 524288000,\n  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']

\n\nDROP POLICY IF EXISTS "recorded_class_videos_select" ON storage.objects

\nCREATE POLICY "recorded_class_videos_select" ON storage.objects FOR SELECT TO authenticated USING (\n  bucket_id = 'recorded-class-videos' AND EXISTS (\n    SELECT 1 FROM public.live_classes lc\n    WHERE split_part(name, '/', 2)::uuid = lc.id\n    AND (\n      public.is_admin()\n      OR lc.teacher_id = auth.uid()\n      OR EXISTS (\n        SELECT 1 FROM public.enrollments e\n        WHERE e.course_id = lc.course_id AND e.student_id = auth.uid() AND e.status IN ('active', 'completed')\n      )\n    )\n  )\n)

\n\nDROP POLICY IF EXISTS "recorded_class_videos_insert" ON storage.objects

\nCREATE POLICY "recorded_class_videos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (\n  bucket_id = 'recorded-class-videos' AND split_part(name, '/', 1) = auth.uid()::text AND EXISTS (\n    SELECT 1 FROM public.live_classes lc\n    WHERE split_part(name, '/', 2)::uuid = lc.id\n    AND (public.is_admin() OR lc.teacher_id = auth.uid())\n  )\n)

\n\nDROP POLICY IF EXISTS "recorded_class_videos_update" ON storage.objects

\nCREATE POLICY "recorded_class_videos_update" ON storage.objects FOR UPDATE TO authenticated USING (\n  bucket_id = 'recorded-class-videos' AND split_part(name, '/', 1) = auth.uid()::text\n) WITH CHECK (\n  bucket_id = 'recorded-class-videos' AND split_part(name, '/', 1) = auth.uid()::text\n)

\n\nDROP POLICY IF EXISTS "recorded_class_videos_delete" ON storage.objects

\nCREATE POLICY "recorded_class_videos_delete" ON storage.objects FOR DELETE TO authenticated USING (\n  bucket_id = 'recorded-class-videos' AND (\n    public.is_admin() OR split_part(name, '/', 1) = auth.uid()::text\n  )\n)

\n
