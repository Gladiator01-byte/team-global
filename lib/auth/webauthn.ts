import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';
import { supabaseAdmin } from '@/lib/db/supabase';

const rpName = process.env.WEBAUTHN_RP_NAME ?? 'Team Global';
const rpID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';

function toBase64Url(buffer: Uint8Array | Buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64Url(input: string) {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

export async function beginRegistration(userId: string, email: string) {
  const { data: existingCredentials } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('user_id', userId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName: email,
    userDisplayName: email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform',
    },
    supportedAlgorithmIDs: [-7, -257],
    excludeCredentials: (existingCredentials ?? []).map((credential) => ({
      id: fromBase64Url(credential.credential_id),
      type: 'public-key' as const,
    })),
  });

  await supabaseAdmin.from('webauthn_challenges').insert({
    user_id: userId,
    challenge: options.challenge,
    type: 'registration',
  });

  return options;
}

export async function finishRegistration(userId: string, response: RegistrationResponseJSON) {
  const { data: challengeRow } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'registration')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    throw new Error('Registration challenge is missing');
  }

  const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const registrationInfo = verification.registrationInfo;

  await supabaseAdmin.from('webauthn_credentials').insert({
    user_id: userId,
    credential_id: toBase64Url(registrationInfo.credential.id),
    credential_public_key: toBase64Url(registrationInfo.credential.publicKey),
    counter: registrationInfo.credential.counter,
    credential_device_type: registrationInfo.credentialDeviceType,
    credential_backed_up: registrationInfo.credentialBackedUp,
    transports: response.response.transports ?? [],
    aaguid: registrationInfo.aaguid,
    user_verified: true,
    biometric_capable: registrationInfo.credentialDeviceType === 'singleDevice',
  });

  return verification;
}

export async function beginAuthentication(email: string) {
  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (!userRow) {
    throw new Error('Unknown user');
  }

  const { data: credentials } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_id', userRow.id);

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: (credentials ?? []).map((credential) => ({
      id: fromBase64Url(credential.credential_id),
      type: 'public-key' as const,
      transports: credential.transports ?? [],
    })),
  });

  await supabaseAdmin.from('webauthn_challenges').insert({
    user_id: userRow.id,
    challenge: options.challenge,
    type: 'authentication',
  });

  return { options, userId: userRow.id };
}

export async function finishAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
): Promise<VerifiedAuthenticationResponse> {
  const credentialId = response.id;
  const { data: credentialRow } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('id, credential_id, credential_public_key, counter')
    .eq('user_id', userId)
    .eq('credential_id', credentialId)
    .single();

  if (!credentialRow) {
    throw new Error('Credential not found');
  }

  const { data: challengeRow } = await supabaseAdmin
    .from('webauthn_challenges')
    .select('challenge')
    .eq('user_id', userId)
    .eq('type', 'authentication')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!challengeRow) {
    throw new Error('Authentication challenge missing');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credentialRow.credential_id,
      publicKey: fromBase64Url(credentialRow.credential_public_key),
      counter: credentialRow.counter,
    },
    requireUserVerification: true,
  });

  if (verification.verified) {
    await supabaseAdmin
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq('id', credentialRow.id);
  }

  return verification;
}
