'use client';

import { FormEvent, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function onSignInWithPasskey(event: FormEvent) {
    event.preventDefault();
    setStatus('Loading passkey challenge...');

    try {
      const optionsResponse = await fetch('/api/auth/webauthn/login/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const optionsBody = await optionsResponse.json();
      const authenticationResponse = await startAuthentication({ optionsJSON: optionsBody.options });

      const verificationResponse = await fetch('/api/auth/webauthn/login/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: optionsBody.userId, response: authenticationResponse }),
      });

      const verificationBody = await verificationResponse.json();
      setStatus(verificationBody.verified ? 'Signed in successfully.' : 'Passkey sign in failed.');
    } catch (error) {
      setStatus(`Passkey sign in error: ${(error as Error).message}`);
    }
  }

  return (
    <main>
      <h1>Sign in with Passkey</h1>
      <form onSubmit={onSignInWithPasskey}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit">Sign in with Passkey</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
