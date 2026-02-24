'use client';

import { FormEvent, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export default function RegisterPage() {
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function onRegisterPasskey(event: FormEvent) {
    event.preventDefault();
    setStatus('Preparing passkey registration...');

    try {
      const optionsResponse = await fetch('/api/auth/webauthn/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, email }),
      });

      const options = await optionsResponse.json();
      const registrationResponse = await startRegistration({ optionsJSON: options });

      const verificationResponse = await fetch('/api/auth/webauthn/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, response: registrationResponse }),
      });

      const verificationBody = await verificationResponse.json();
      setStatus(verificationBody.verified ? 'Passkey registered successfully.' : 'Passkey registration failed.');
    } catch (error) {
      setStatus(`Passkey registration error: ${(error as Error).message}`);
    }
  }

  return (
    <main>
      <h1>Register Passkey</h1>
      <form onSubmit={onRegisterPasskey}>
        <label>
          User ID
          <input value={userId} onChange={(e) => setUserId(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <button type="submit">Register Passkey</button>
      </form>
      {status && <p>{status}</p>}
    </main>
  );
}
