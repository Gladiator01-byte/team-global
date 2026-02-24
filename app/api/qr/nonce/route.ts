import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/auth/guards';
import { QR_NONCE_MINT_ROLES } from '@/lib/auth/roles';
import { supabaseAdmin } from '@/lib/db/supabase';

export async function POST() {
  const { session, response } = await requireRole(QR_NONCE_MINT_ROLES);
  if (response || !session) {
    return response;
  }

  const nonce = randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

  await supabaseAdmin.from('qr_nonces').insert({
    minted_by: session.userId,
    nonce,
    expires_at: expiresAt,
  });

  return NextResponse.json({ nonce, expiresInSeconds: 90 });
}
