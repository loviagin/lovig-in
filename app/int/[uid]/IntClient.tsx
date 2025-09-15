// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  const sp = useSearchParams();
  const screen = sp.get('screen'); // <- берем из URL

  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
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

  if (loading) return <main style={shell}>Loading…</main>;
  if (error)   return <main style={{ ...shell, color: 'crimson' }}>{error}</main>;
  if (!details) return null;

  const prompt = details.prompt.name;
  // Показываем регистрацию если:
  //  - провайдер реально выдал signup, ИЛИ
  //  - провайдер выдал login, но в URL есть ?screen=signup (прошёл флаг с авторизационного запроса)
  const showSignup = prompt === 'signup' || (prompt === 'login' && screen === 'signup');
  const showLogin  = !showSignup && prompt === 'login';

  if (showLogin) {
    return (
      <main style={shell}>
        <h1>Sign in</h1>
        <form method="post" action={`/interaction/${uid}/login`} style={{ display: 'grid', gap: 12 }}>
          <input
            name="email"
            type="email"
            placeholder="email"
            required
            style={input}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
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
      </main>
    );
  }

  if (showSignup) {
    return (
      <main style={shell}>
        <h1>Create account</h1>
        <form method="post" action={`/interaction/${uid}/signup`} style={{ display: 'grid', gap: 12 }}>
          <input
            name="name"
            placeholder="name"
            style={input}
            autoComplete="name"
            autoCapitalize="words"
            autoCorrect="off"
          />
          <input
            name="email"
            type="email"
            placeholder="email"
            required
            style={input}
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            name="password"
            type="password"
            placeholder="password (min 6)"
            required
            style={input}
            autoComplete="new-password"
          />
          <button type="submit" style={btnPri}>Create account</button>
        </form>
      </main>
    );
  }

  // CONSENT (или другие промпты)
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