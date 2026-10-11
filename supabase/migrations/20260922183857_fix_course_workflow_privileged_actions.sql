/*\n# Fix Course Workflow Privileged Actions\n\n## Overview\nMoves course approval-state and admin pricing changes into protected database functions. Teachers cannot directly update admin-controlled columns, so submitting for review now uses an authorized function. Admin pricing, approval, publishing, and discount changes also use an admin-only function.\n\n## New Functions\n- `submit_course_for_review` - Allows the course owner to submit only their own draft or rejected course.\n- `admin_manage_course` - Allows admins to update final price, approval status, publication state, rejection reason, and discounts.\n\n## Security\n- Both functions use `auth.uid()` from the active session.\n- Teacher submissions require course ownership and draft/rejected state.\n- Admin management requires the caller's profile role to be admin.\n- Function execution is revoked from anonymous users and granted only to authenticated users.\n*/\n\nCREATE OR REPLACE FUNCTION public.submit_course_for_review(p_course_id uuid)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM public.courses\n    WHERE id = p_course_id\n    AND teacher_id = auth.uid()\n    AND admin_status IN ('draft', 'rejected')\n  ) THEN\n    RAISE EXCEPTION 'Course cannot be submitted'

\n  END IF

\n\n  UPDATE public.courses\n  SET admin_status = 'pending_review', rejection_reason = NULL, updated_at = now()\n  WHERE id = p_course_id

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.submit_course_for_review(uuid) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.submit_course_for_review(uuid) FROM anon

\nGRANT EXECUTE ON FUNCTION public.submit_course_for_review(uuid) TO authenticated

\n\nCREATE OR REPLACE FUNCTION public.admin_manage_course(\n  p_course_id uuid,\n  p_status text DEFAULT NULL,\n  p_final_price numeric DEFAULT NULL,\n  p_discount_price numeric DEFAULT NULL,\n  p_discount_active boolean DEFAULT NULL,\n  p_discount_expires_at timestamptz DEFAULT NULL,\n  p_rejection_reason text DEFAULT NULL\n)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  IF NOT public.is_admin() THEN\n    RAISE EXCEPTION 'Not authorized'

\n  END IF

\n\n  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'unpublished') THEN\n    RAISE EXCEPTION 'Invalid course status'

\n  END IF

\n\n  IF p_final_price IS NOT NULL AND p_final_price < 0 THEN\n    RAISE EXCEPTION 'Invalid final price'

\n  END IF

\n\n  IF p_discount_price IS NOT NULL AND p_discount_price < 0 THEN\n    RAISE EXCEPTION 'Invalid discount price'

\n  END IF

\n\n  UPDATE public.courses\n  SET\n    admin_status = COALESCE(p_status, admin_status),\n    final_price = COALESCE(p_final_price, final_price),\n    discount_price = COALESCE(p_discount_price, discount_price),\n    discount_active = COALESCE(p_discount_active, discount_active),\n    discount_expires_at = CASE\n      WHEN p_discount_expires_at IS NOT NULL THEN p_discount_expires_at\n      WHEN p_discount_active = false THEN NULL\n      ELSE discount_expires_at\n    END,\n    rejection_reason = CASE\n      WHEN p_rejection_reason IS NOT NULL THEN p_rejection_reason\n      WHEN p_status IN ('approved', 'published') THEN NULL\n      ELSE rejection_reason\n    END,\n    published_at = CASE\n      WHEN p_status = 'published' THEN now()\n      WHEN p_status = 'unpublished' THEN NULL\n      ELSE published_at\n    END,\n    updated_at = now()\n  WHERE id = p_course_id

\nEND

\n$$

\n\nREVOKE ALL ON FUNCTION public.admin_manage_course(uuid, text, numeric, numeric, boolean, timestamptz, text) FROM PUBLIC

\nREVOKE ALL ON FUNCTION public.admin_manage_course(uuid, text, numeric, numeric, boolean, timestamptz, text) FROM anon

\nGRANT EXECUTE ON FUNCTION public.admin_manage_course(uuid, text, numeric, numeric, boolean, timestamptz, text) TO authenticated
