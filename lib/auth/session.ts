import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/db/supabase';
import type { UserRole } from '@/lib/auth/roles';

export interface AppSession {
  userId: string;
  role: UserRole;
  email: string;
}

const SESSION_COOKIE = 'tg_session_id';
const ROLE_COOKIE = 'tg_role';

export async function getSession(): Promise<AppSession | null> {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .select('user_id, role, email')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    userId: data.user_id,
    role: data.role,
    email: data.email,
  };
}

export async function issueSession(userId: string, role: UserRole, email: string) {
  const { data, error } = await supabaseAdmin
    .from('user_sessions')
    .insert({ user_id: userId, role, email })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Unable to issue session');
  }

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, data.id, {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });

  cookieStore.set(ROLE_COOKIE, role, {
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
  });
}

