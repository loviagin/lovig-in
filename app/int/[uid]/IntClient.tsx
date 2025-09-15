'use client';

import { useEffect, useState } from 'react';

type IntDetails = {
  uid: string;
  prompt: { name: 'login' | 'signup' | 'consent' | string };
  params: Record<string, string>;
  session?: { accountId?: string } | null;
};

export default function IntClient({ uid }: { uid: string }) {
  const [details, setDetails] = useState<IntDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ВАЖНО: берем детали здесь
        const res = await fetch(`/interaction/${uid}/details`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`GET /interaction/${uid}/details failed: ${res.status}`);

        const data = (await res.json()) as IntDetails;
        if (!abort) setDetails(data);
      } catch (e: unknown) {
        if (!abort) setError(String((e as Error).message ?? e));
      } finally {
        if (!abort) setLoading(false);
      }
    })();
    return () => { abort = true; };
  }, [uid]);

  const shell: React.CSSProperties = { maxWidth: 420, margin: '40px auto', fontFamily: 'system-ui', padding: 16 };
  const input: React.CSSProperties = { padding: 10, border: '1px solid #ccc', borderRadius: 8 };
  const btnPri: React.CSSProperties = { padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 600 };
  const btnSec: React.CSSProperties = { padding: 10, borderRadius: 8, background: '#eee', color: '#111', fontWeight: 600, textAlign: 'center', display: 'block', marginTop: 8 };

  if (loading) return <main style={shell}>Loading…</main>;
  if (error)   return <main style={{ ...shell, color: 'crimson' }}>{error}</main>;
  if (!details) return null;

  // LOGIN
  if (details.prompt.name === 'login') {
    return (
      <main style={shell}>
        <h1>Sign in</h1>
        <form method="post" action={`/interaction/${uid}/login`} style={{ display: 'grid', gap: 12 }}>
          <input
            name="email" // сервер читает и email, и login — оба ок
            placeholder="email"
            type="email"
            required
            style={input}
            autoComplete="email"
          />
          <input
            name="password"
            type="password"
            placeholder="password"
            required
            style={input}
            autoComplete="current-password"
          />
          <button type="submit" style={btnPri}>Sign in</button>
        </form>

        {/* Переход в signup В РАМКАХ ЭТОЙ ЖЕ интеракции */}
        <a href={`/interaction/${uid}/goto-signup`} style={btnSec}>Create account</a>
      </main>
    );
  }

  // SIGNUP
  if (details.prompt.name === 'signup') {
    return (
      <main style={shell}>
        <h1>Create account</h1>
        <form method="post" action={`/interaction/${uid}/signup`} style={{ display: 'grid', gap: 12 }}>
          <input name="name" placeholder="name (optional)" style={input} autoComplete="name" />
          <input name="email" placeholder="email" type="email" required style={input} autoComplete="email" />
          <input name="password" placeholder="password (min 6)" type="password" required style={input} autoComplete="new-password" />
          <button type="submit" style={btnPri}>Create account</button>
        </form>
      </main>
    );
  }

  // CONSENT
  return (
    <main style={{ ...shell, maxWidth: 520 }}>
      <h1>Authorize</h1>
      <p>
        App <b>{details.params.client_id}</b> requests:&nbsp;
        <code>{details.params.scope ?? 'openid'}</code>
      </p>
      <form method="post" action={`/interaction/${uid}/confirm`}>
        <button type="submit" style={btnPri}>Continue</button>
      </form>
    </main>
  );
}