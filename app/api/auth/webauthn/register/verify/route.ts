import { NextResponse } from 'next/server';
import { finishRegistration } from '@/lib/auth/webauthn';

export async function POST(request: Request) {
  const body = await request.json();
  const userId = body.userId as string;

  if (!userId || !body.response) {
    return NextResponse.json({ error: 'Missing registration payload' }, { status: 400 });
  }

  const verification = await finishRegistration(userId, body.response);
  return NextResponse.json({ verified: verification.verified });
}
