// app/int/[uid]/page.tsx
export const dynamic = 'force-dynamic';

type IntDetails = {
  uid: string;
  prompt: { name: 'login' | 'consent' | string };
  params: Record<string, string>;
  session?: { accountId?: string } | null;
};

async function getDetails(uid: string): Promise<IntDetails> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? '';
  const res = await fetch(`${base}/interaction/${uid}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load interaction details: ${res.status}`);
  }
  return (await res.json()) as IntDetails;
}

export default async function IntPage({
  params,
}: {
  // ВАЖНО: params — Promise, и его надо await'ить
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const details = await getDetails(uid);

  if (details.prompt.name === 'login') {
    return (
      <main style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'system-ui' }}>
        <h1>Sign in</h1>
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
          <button
            type="submit"
            style={{ padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff' }}
          >
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
        <button
          type="submit"
          style={{ padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff' }}
        >
          Continue
        </button>
      </form>
    </main>
  );
}