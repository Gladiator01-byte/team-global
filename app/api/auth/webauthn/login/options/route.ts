import { NextResponse } from 'next/server';
import { beginAuthentication } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const { options, userId } = await beginAuthentication(body.email);
  return NextResponse.json({ options, userId });
}
