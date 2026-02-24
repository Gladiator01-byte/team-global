import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasRole, EMPLOYEE_ROLES, LEADER_DASHBOARD_ROLES, QR_NONCE_MINT_ROLES } from '@/lib/auth/roles';

function getRoleFromRequest(request: NextRequest) {
  return request.cookies.get('tg_role')?.value ?? undefined;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const role = getRoleFromRequest(request);

  if (pathname.startsWith('/employee') && !hasRole(role, EMPLOYEE_ROLES)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (
    (pathname.startsWith('/dashboard') || pathname.startsWith('/qr/display')) &&
    !hasRole(role, LEADER_DASHBOARD_ROLES)
  ) {
    return NextResponse.redirect(new URL('/forbidden', request.url));
  }

  if (pathname.startsWith('/api/qr/nonce') && !hasRole(role, QR_NONCE_MINT_ROLES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/employee/:path*', '/dashboard/:path*', '/qr/display/:path*', '/api/qr/nonce/:path*'],
};
