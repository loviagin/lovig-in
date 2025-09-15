// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useState } from 'react';

type IntDetails = {
    uid: string;
    prompt: { name: 'login' | 'consent' | string }; // signup НЕ обязателен в policy
    params: Record<string, string>;
    session?: { accountId?: string } | null;
};

export default function IntClient({ uid }: { uid: string }) {
    const [details, setDetails] = useState<IntDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // локальный экран
    const [view, setView] = useState<'chooser' | 'login' | 'signup'>('chooser');

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
                if (!abort) {
                    setDetails(data);
                    // если провайдер требует consent — сразу показываем consent
                    if (data.prompt.name === 'consent') setView('login'); // значение не важно, ниже отрендерим consent
                    else setView('chooser'); // иначе начнем с chooser
                }
            } catch (e: unknown) {
                if (!abort) {
                    const msg = e instanceof Error ? e.message : String(e);
                    setError(msg);
                }
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [uid]);

    const shell: React.CSSProperties = { maxWidth: 420, margin: '40px auto', fontFamily: 'system-ui', padding: 16 };
    const input: React.CSSProperties = { padding: 10, border: '1px solid #ccc', borderRadius: 8 };
    const btn: React.CSSProperties = { padding: 12, borderRadius: 10, fontWeight: 600, width: '100%' };
    const btnPri: React.CSSProperties = { ...btn, background: '#2563eb', color: '#fff' };
    const btnSec: React.CSSProperties = { ...btn, background: '#eee', color: '#111' };
    const gapCol: React.CSSProperties = { display: 'grid', gap: 12 };

    if (loading) return <main style={shell}>Loading…</main>;
    if (error) return <main style={{ ...shell, color: 'crimson' }}>{error}</main>;
    if (!details) return null;

    // CONSENT (если нужен) — приоритетно, не подменяем локальным view
    if (details.prompt.name === 'consent') {
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

    // CHOOSER — список соцсетей (пока заглушки) + email-кнопки
    if (view === 'chooser') {
        return (
            <main style={shell}>
                <h1>Continue</h1>
                <div style={gapCol}>
                    {/* Соцсети — пока как заглушки; позже подставишь ссылки */}
                    <button type="button" style={btnSec} disabled>Continue with Google (soon)</button>
                    <button type="button" style={btnSec} disabled>Continue with Apple (soon)</button>

                    <hr style={{ border: 'none', borderTop: '1px solid #ddd', margin: '8px 0' }} />

                    <button type="button" style={btnPri} onClick={() => setView('signup')}>
                        Create account with Email
                    </button>
                    <button type="button" style={btnSec} onClick={() => setView('login')}>
                        Sign in with Email
                    </button>
                </div>
            </main>
        );
    }

    // LOGIN (email)
    if (view === 'login') {
        return (
            <main style={shell}>
                <h1>Sign in</h1>
                <form method="post" action={`/interaction/${uid}/login`} style={gapCol}>
                    <input name="email" type="email" placeholder="email" required style={input}
                        autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" />
                    <input name="password" type="password" placeholder="password" required style={input}
                        autoComplete="current-password" />
                    <button type="submit" style={btnPri}>Sign in</button>
                </form>
                <div style={{ height: 8 }} />
                <button type="button" style={btnSec} onClick={() => setView('signup')}>Create account instead</button>
            </main>
        );
    }

    // SIGNUP (email)
    return (
        <main style={shell}>
            <h1>Create account</h1>
            <form method="post" action={`/interaction/${uid}/signup`} style={gapCol}>
                <input name="name" placeholder="name" style={input}
                    autoComplete="name" autoCapitalize="words" autoCorrect="off" />
                <input name="email" type="email" placeholder="email" required style={input}
                    autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" />
                <input name="password" type="password" placeholder="password (min 6)" required style={input}
                    autoComplete="new-password" />
                <button type="submit" style={btnPri}>Create account</button>
            </form>
            <div style={{ height: 8 }} />
            <button type="button" style={btnSec} onClick={() => setView('login')}>I already have an account</button>
        </main>
    );
}