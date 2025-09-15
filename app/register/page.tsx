'use client';

import { useState } from 'react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (res.ok) {
        setMessage('✅ User registered successfully');
        setEmail('');
        setPassword('');
        setName('');
      } else {
        // пытаемся распарсить json-ошибку
        let serverMsg = '';
        try {
          const j = (await res.json()) as { error?: string; hint?: string };
          serverMsg = j.error ? ` ${j.error}` : '';
          if (j.hint) serverMsg += ` (${j.hint})`;
        } catch {
          /* ignore */
        }
        setMessage(`❌ Failed: ${res.status} ${res.statusText}${serverMsg}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage(`❌ Error: ${msg}`);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>Register</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(ev) => setName(ev.target.value)}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          required
        />
        <button type="submit">Register</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}