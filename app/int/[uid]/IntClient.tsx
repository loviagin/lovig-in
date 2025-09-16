// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useState } from 'react';
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
                    <span className={styles.brand}>LOVIGIN</span>
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
                    <span className={styles.brand}>LOVIGIN</span>
                </header>
                <h1 className={styles.title}>Continue</h1>
                <div className={styles.providersGrid}>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled>
                        <span className={styles.btnInner}>
                            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path fill="#EA4335" d="M12 11.989v3.822h5.356c-.235 1.26-1.44 3.69-5.356 3.69-3.225 0-5.86-2.667-5.86-5.966s2.635-5.966 5.86-5.966c1.84 0 3.075.78 3.78 1.455l2.58-2.49C16.7 4.9 14.535 4 12 4 6.96 4 2.87 8.03 2.87 13.04 2.87 18.05 6.96 22.08 12 22.08c6.96 0 8.64-4.86 8.64-7.34 0-.495-.045-.855-.1-1.23H12z"/>
                            </svg>
                            <span className={styles.btnLabel}>Continue with Google</span>
                        </span>
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled>
                        <span className={styles.btnInner}>
                            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                <path fill="#000" d="M16.365 1.43c0 1.14-.468 2.238-1.165 3.03-.696.792-1.836 1.41-2.976 1.32-.126-1.104.522-2.28 1.21-3.03.738-.9 2.016-1.56 2.93-1.62.035.1 0 .2 0 .3zm3.08 16.59c-.522 1.2-1.155 2.34-2.07 3.6-.9 1.2-2.07 2.7-3.63 2.73-1.53.03-1.98-.87-3.69-.87-1.71 0-2.22.84-3.72.9-1.53.06-2.7-1.32-3.6-2.52-1.98-2.67-3.51-7.53-1.47-10.83 1.02-1.62 2.85-2.64 4.83-2.67 1.5-.03 2.91 1 3.69 1 0 0 1.83-1.23 3.72-1.05.63.03 2.41.06 3.54 1.8-.09.06-2.13 1.23-2.1 3.66.03 2.91 2.64 3.87 2.67 3.87-.03.06-.06.18-.12.27z"/>
                            </svg>
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
                    <span className={styles.brand}>LOVIGIN</span>
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
                <span className={styles.brand}>LOVIGIN</span>
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