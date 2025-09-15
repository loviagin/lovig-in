// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

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
    const router = useRouter();
    const mode = sp.get('mode'); // "signup" | null

    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/interaction/${uid}/details`, { credentials: 'include', cache: 'no-store' });
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
    if (error) return <main style={{ ...shell, color: 'crimson' }}>{error}</main>;
    if (!details) return null;

    const prompt = details.prompt.name;

    // ВАЖНО:
    // - Разрешаем форс-сигнап через ?mode=signup ТОЛЬКО когда текущий prompt = login.
    // - Если провайдер уже выдал signup — показываем signup.
    // - Если провайдер выдал consent — НИКОГДА не показываем signup, идём по consent.
    const showSignup =
        prompt === 'signup' || (prompt === 'login' && mode === 'signup');

    const showLogin =
        prompt === 'login' && !showSignup;

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

                {/* Переключение на форму регистрации без завершения интеракции */}
                <a
                    href={`?mode=signup`}
                    onClick={(e) => { e.preventDefault(); router.replace(`?mode=signup`); }}
                    style={btnSec}
                >
                    Create account
                </a>
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

    // CONSENT (или любой другой prompt, если появится)
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