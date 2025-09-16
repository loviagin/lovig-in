// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { FaApple, FaGoogle } from 'react-icons/fa6';
import styles from './IntClient.module.css';

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

    // styles moved to CSS module

    if (loading) return <main className={styles.shell}>Loading…</main>;
    if (error) return <main className={`${styles.shell} ${styles.error}`}>{error}</main>;
    if (!details) return null;

    // CONSENT (если нужен) — приоритетно, не подменяем локальным view
    if (details.prompt.name === 'consent') {
        return (
            <main className={`${styles.shell} ${styles.wide}`}>
                <header className={styles.header}>
                    <picture>
                        <source srcSet="/logoWhite.webp" media="(prefers-color-scheme: dark)" />
                        <img src="/logo.webp" alt="LOVIGIN" className={styles.logo} />
                    </picture>
                </header>
                <h1 className={styles.title}>Authorize</h1>
                <p>
                    App <b>{details.params.client_id}</b> requests: <code>{details.params.scope ?? 'openid'}</code>
                </p>
                <form method="post" action={`/interaction/${uid}/confirm`}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Continue</button>
                </form>
            </main>
        );
    }

    // CHOOSER — список соцсетей (пока заглушки) + email-кнопки
    if (view === 'chooser') {
        return (
            <main className={styles.shell}>
                <header className={styles.header}>
                    <picture>
                        <source srcSet="/logoWhite.webp" media="(prefers-color-scheme: dark)" />
                        <img src="/logo.webp" alt="LOVIGIN" className={styles.logo} />
                    </picture>
                </header>
                <h1 className={styles.title}>Continue</h1>
                <div className={styles.providersGrid}>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled>
                        <span className={styles.btnInner}>
                            <FaGoogle className={styles.icon} aria-hidden="true" />
                            <span className={styles.btnLabel}>Continue with Google</span>
                        </span>
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled>
                        <span className={styles.btnInner}>
                            <FaApple className={styles.icon} aria-hidden="true" />
                            <span className={styles.btnLabel}>Continue with Apple</span>
                        </span>
                    </button>
                </div>
                <div className={styles.divider}><span>or</span></div>
                <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setView('signup')}>
                        Create account with Email
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setView('login')}>
                        Sign in with Email
                    </button>
                </div>
            </main>
        );
    }

    // LOGIN (email)
    if (view === 'login') {
        return (
            <main className={styles.shell}>
                <header className={styles.header}>
                    <picture>
                        <source srcSet="/logoWhite.webp" media="(prefers-color-scheme: dark)" />
                        <img src="/logo.webp" alt="LOVIGIN" className={styles.logo} />
                    </picture>
                </header>
                <h1 className={styles.title}>Sign in</h1>
                <form method="post" action={`/interaction/${uid}/login`} className={styles.form}>
                    <input name="email" type="email" placeholder="email" required className={styles.input}
                        autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" />
                    <input name="password" type="password" placeholder="password" required className={styles.input}
                        autoComplete="current-password" />
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Sign in</button>
                </form>
                <div className={styles.helper} />
                <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setView('signup')}>Create account instead</button>
            </main>
        );
    }

    // SIGNUP (email)
    return (
        <main className={styles.shell}>
            <header className={styles.header}>
                <picture>
                    <source srcSet="/logoWhite.webp" media="(prefers-color-scheme: dark)" />
                    <img src="/logo.webp" alt="LOVIGIN" className={styles.logo} />
                </picture>
            </header>
            <h1 className={styles.title}>Create account</h1>
            <form method="post" action={`/interaction/${uid}/signup`} className={styles.form}>
                <input name="name" placeholder="name" className={styles.input}
                    autoComplete="name" autoCapitalize="words" autoCorrect="off" />
                <input name="email" type="email" placeholder="email" required className={styles.input}
                    autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" />
                <input name="password" type="password" placeholder="password (min 6)" required className={styles.input}
                    autoComplete="new-password" />
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Create account</button>
            </form>
            <div className={styles.helper} />
            <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setView('login')}>I already have an account</button>
        </main>
    );
}