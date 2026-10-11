/*\n# Create Mock Series Payment Transactions\n\n## Overview\nCreates the server-side transaction ledger used for PayU payments for mock-test series.\n\n## New Table\n- `mock_series_payment_transactions` - Stores transaction ID, series, student, amount, status, and PayU response data.\n\n## Security\n- RLS is enabled.\n- Students can read only their own transactions

 admins can read all.\n- Direct client writes are blocked

 payment functions perform writes.\n*/\nCREATE TABLE IF NOT EXISTS public.mock_series_payment_transactions (\n  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),\n  txnid text UNIQUE NOT NULL,\n  series_id uuid NOT NULL REFERENCES public.mock_test_series(id) ON DELETE CASCADE,\n  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,\n  amount numeric(10,2) NOT NULL DEFAULT 0,\n  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),\n  payu_payment_id text,\n  payu_response jsonb,\n  created_at timestamptz NOT NULL DEFAULT now(),\n  updated_at timestamptz NOT NULL DEFAULT now()\n)

\nALTER TABLE public.mock_series_payment_transactions ENABLE ROW LEVEL SECURITY

\nDROP POLICY IF EXISTS "series_transactions_select_own_or_admin" ON public.mock_series_payment_transactions

\nCREATE POLICY "series_transactions_select_own_or_admin" ON public.mock_series_payment_transactions FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.is_admin())

\nDROP POLICY IF EXISTS "series_transactions_insert_blocked" ON public.mock_series_payment_transactions

\nCREATE POLICY "series_transactions_insert_blocked" ON public.mock_series_payment_transactions FOR INSERT TO authenticated WITH CHECK (false)

\nDROP POLICY IF EXISTS "series_transactions_update_blocked" ON public.mock_series_payment_transactions

\nCREATE POLICY "series_transactions_update_blocked" ON public.mock_series_payment_transactions FOR UPDATE TO authenticated USING (false) WITH CHECK (false)

\nDROP POLICY IF EXISTS "series_transactions_delete_admin" ON public.mock_series_payment_transactions

\nCREATE POLICY "series_transactions_delete_admin" ON public.mock_series_payment_transactions FOR DELETE TO authenticated USING (public.is_admin())

\n
