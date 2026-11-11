
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function getAdmin(request: NextRequest) {
  const header = request.headers.get('authorization');

  if (!header?.startsWith('Bearer ')) return null;

  const { data, error } = await authClient.auth.getUser(
    header.slice(7)
  );

  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', data.user.id)
    .single();

  if (profileError || profile?.role !== 'admin') return null;

  return data.user;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdmin(request);

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: requests, error } = await supabaseAdmin
      .from('account_deletion_requests')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) throw error;

   const userIds = Array.from(
  new Set(
    (requests || [])
      .map((item) => item.user_id)
      .filter((id): id is string => Boolean(id))
  )
);

    let profiles: any[] = [];

    if (userIds.length) {
      const { data, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, phone, created_at')
        .in('id', userIds);

      if (profileError) throw profileError;
      profiles = data || [];
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    return NextResponse.json({
      requests: (requests || []).map((item) => ({
        ...item,
        profile: profileMap.get(item.user_id) || null,
      })),
    });
  } catch (error) {
    console.error('Admin deletion GET:', error);
    return NextResponse.json(
      { error: 'Unable to load deletion requests.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await getAdmin(request);

    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { id, action, notes } = body;

    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid request or action.' },
        { status: 400 }
      );
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('account_deletion_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json(
        { error: 'Deletion request not found.' },
        { status: 404 }
      );
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending requests can be processed.' },
        { status: 409 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('account_deletion_requests')
      .update({
        status: action === 'approve' ? 'processing' : 'rejected',
        processed_by: admin.id,
        processed_at: new Date().toISOString(),
        admin_notes: typeof notes === 'string' ? notes.slice(0, 1000) : null,
      })
      .eq('id', id)
      .eq('status', 'pending');

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message:
        action === 'approve'
          ? 'Request approved and moved to processing.'
          : 'Deletion request rejected.',
    });
  } catch (error) {
    console.error('Admin deletion PATCH:', error);
    return NextResponse.json(
      { error: 'Unable to update deletion request.' },
      { status: 500 }
    );
  }
}
