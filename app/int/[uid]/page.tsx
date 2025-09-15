// app/int/[uid]/page.tsx
'use client';

import { useEffect, useState } from 'react';

type IntDetails = {
  uid: string;
  prompt: { name: 'login' | 'consent' | string };
  params: Record<string, string>;
  session?: { accountId?: string } | null;
};

export default function IntPage({ params }: { params: { uid: string } }) {
  const { uid } = params;
  const [details, setDetails] = useState<IntDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // критично: credentials: 'include' — чтобы куки пришли И УСТАНОВИЛИСЬ в браузер
        const res = await fetch(`/interaction/${uid}`, {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`GET /interaction failed: ${res.status} ${text}`);
        }

        const data = (await res.json()) as IntDetails;
        if (!abort) setDetails(data);
      } catch (e: any) {
        if (!abort) setError(String(e?.message || e));
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [uid]);

  if (loading) {
    return <main style={{ padding: 24, fontFamily: 'system-ui' }}>Loading…</main>;
  }
  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui', color: 'crimson' }}>
        {error}
      </main>
    );
  }
  if (!details) return null;

  if (details.prompt.name === 'login') {
    return (
      <main style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'system-ui' }}>
        <h1>Sign in</h1>
        {/* форма идёт НАПРЯМУЮ в провайдера; кука уже есть в браузере */}
        <form method="post" action={`/interaction/${uid}/login`} style={{ display: 'grid', gap: 12 }}>
          <input
            name="login"
            placeholder="email or username"
            required
            style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
          />
          <input
            name="password"
            type="password"
            placeholder="password (optional now)"
            style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }}
          />
          <button type="submit" style={{ padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff' }}>
            Sign in
          </button>
        </form>
      </main>
    );
  }

  // consent
  return (
    <main style={{ maxWidth: 520, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>Authorize</h1>
      <p>
        App <b>{details.params.client_id}</b> requests:&nbsp;
        <code>{details.params.scope ?? 'openid'}</code>
      </p>
      <form method="post" action={`/interaction/${uid}/confirm`}>
        <button type="submit" style={{ padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff' }}>
          Continue
        </button>
      </form>
    </main>
  );
}