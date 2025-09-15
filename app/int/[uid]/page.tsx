// app/int/[uid]/page.tsx
export const dynamic = 'force-dynamic';

type Props = { params: { uid: string } };

async function getDetails(uid: string) {
    // Берём детали у OIDC (через тот же домен)
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/interaction/${uid}`, {
        cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to load interaction details');
    return res.json() as Promise<{
        uid: string;
        prompt: { name: 'login' | 'consent' | string };
        params: Record<string, string>;   
    }>;
}

export default async function IntPage({ params }: Props) {
    const { uid } = params;
    const details = await getDetails(uid);

    if (details.prompt.name === 'login') {
        return (
            <main style={{ maxWidth: 420, margin: '40px auto', fontFamily: 'system-ui' }}>
                <h1>Sign in</h1>
                <form method="post" action={`/interaction/${uid}/login`} style={{ display: 'grid', gap: 12 }}>
                    <input name="login" placeholder="email or username" required
                        style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }} />
                    <input name="password" type="password" placeholder="password (optional now)"
                        style={{ padding: 10, border: '1px solid #ccc', borderRadius: 8 }} />
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
            <p>App <b>{details.params.client_id}</b> requests: <code>{details.params.scope}</code></p>
            <form method="post" action={`/interaction/${uid}/confirm`}>
                <button type="submit" style={{ padding: 10, borderRadius: 8, background: '#2563eb', color: '#fff' }}>
                    Continue
                </button>
            </form>
        </main>
    );
}