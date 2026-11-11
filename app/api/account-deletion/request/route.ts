
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Please sign in before requesting account deletion.' },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Your session is invalid. Please sign in again.' },
        { status: 401 }
      );
    }

    const { data: existingRequest, error: lookupError } =
      await supabaseAdmin
        .from('account_deletion_requests')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (existingRequest) {
      return NextResponse.json({
        success: true,
        message: 'You already have an account deletion request under review.',
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('account_deletion_requests')
      .insert({
        user_id: user.id,
        email: user.email || '',
        status: 'pending',
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message:
        'Your account deletion request has been submitted successfully.',
    });
  } catch (error) {
    console.error('Account deletion request error:', error);

    return NextResponse.json(
      { error: 'Unable to submit your request. Please try again later.' },
      { status: 500 }
    );
  }
}
