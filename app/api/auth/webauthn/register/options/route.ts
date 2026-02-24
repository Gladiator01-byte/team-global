import { NextResponse } from 'next/server';
import { beginRegistration } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId as string;
  const email = body.email as string;

  if (!userId || !email) {
    return NextResponse.json({ error: 'Missing user information' }, { status: 400 });
  }

  const options = await beginRegistration(userId, email);
  return NextResponse.json(options);
}
