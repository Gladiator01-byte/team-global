import { NextResponse } from 'next/server';
import type { UserRole } from '@/lib/auth/roles';
import { getSession } from '@/lib/auth/session';
import { hasRole } from '@/lib/auth/roles';

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await getSession();
  if (!session || !hasRole(session.role, allowedRoles)) {
    return { session: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, response: null };
}
