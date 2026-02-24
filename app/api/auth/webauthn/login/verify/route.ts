import { NextResponse } from 'next/server';
import { finishAuthentication } from '@/lib/auth/webauthn';
import { issueSession } from '@/lib/auth/session';
import { supabaseAdmin } from '@/lib/db/supabase';

export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId as string;

  if (!userId || !body.response) {
    return NextResponse.json({ error: 'Missing authentication payload' }, { status: 400 });
  }

  const verification = await finishAuthentication(userId, body.response);

  if (!verification.verified) {
    return NextResponse.json({ verified: false }, { status: 401 });
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('email, role')
    .eq('id', userId)
    .single();

  if (!userRow) {
    return NextResponse.json({ error: 'Unknown user' }, { status: 404 });
  }

  await issueSession(userId, userRow.role, userRow.email);

  return NextResponse.json({ verified: true });
}
