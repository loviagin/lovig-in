// app/int/[uid]/IntClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FaApple, FaGoogle } from 'react-icons/fa6';
import styles from './IntClient.module.css';

type IntDetails = {
    uid: string;
    prompt: { name: 'login' | 'signup' | 'consent' | string };
    params: Record<string, string>;
    session?: { accountId?: string } | null;
    clientName?: string;  // ← новое поле
};

export default function IntClient({ uid }: { uid: string }) {
    const sp = useSearchParams();
    const router = useRouter();
    const [details, setDetails] = useState<IntDetails | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    // локальный экран
    const [view, setView] = useState<'chooser' | 'login' | 'signup'>('chooser');

    // Static error map used on the login view (declared at top-level to keep hooks order stable)
    const loginErrorMessages: Record<string, string> = useMemo(() => ({
        invalid_email: 'Incorrect e-mail',
        missing_fields: 'Fill in all the fields',
        invalid_credentials: 'Incorrect email or password',
        weak_password: 'The password is too short',
        email_exists: 'The mail has already been registered',
        login_failed: 'Couldn\'t log in. Try again',
        signup_failed: 'Couldn\'t create an account. Try again',
    }), []);

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
                if (!res.ok) {
                    router.replace(`/int/error?code=interaction_fetch_failed&message=HTTP%20${res.status}`);
                    return;
                }
                const data = (await res.json()) as (IntDetails & { error?: string; message?: string });
                if (data?.error) {
                    router.replace(`/int/error?code=${encodeURIComponent(data.error)}&message=${encodeURIComponent(data.message || '')}`);
                    return;
                }
                if (!abort) {
                    setDetails(data as IntDetails);
                    // если провайдер требует consent — сразу показываем consent
                    if (data.prompt.name === 'consent') setView('login'); // значение не важно, ниже отрендерим consent
                    else setView('chooser'); // иначе начнем с chooser
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                router.replace(`/int/error?code=interaction_fetch_failed&message=${encodeURIComponent(msg)}`);
            } finally {
                if (!abort) setLoading(false);
            }
        })();
        return () => { abort = true; };
    }, [uid, router]);

    // styles moved to CSS module

    const switchView = (next: 'chooser' | 'login' | 'signup') => {
        setBusy(true);
        setView(next);
        // brief lock to avoid rapid double-clicks and jank during small transitions
        setTimeout(() => setBusy(false), 250);
    };

    if (loading) return <main className={styles.shell}>Loading…</main>;
    if (error) return <main className={`${styles.shell} ${styles.error}`}>{error}</main>;
    if (!details) return null;

    const appName = details.clientName || details.params.client_id;
    const clientId = details.params.client_id;
    const logoByClient: Record<string, { light: string; dark: string }> = {
        'demo-ios': { light: '/logos/learnsy.webp', dark: '/logos/learnsy.webp' },
    };
    const logo = logoByClient[clientId] ?? { light: '/logo.webp', dark: '/logoWhite.webp' };

    const Header = () => (
        <header className={styles.header}>
            <picture>
                <source srcSet={logo.dark} media="(prefers-color-scheme: dark)" />
                <img src={logo.light} alt={appName || 'App'} className={styles.logo} />
            </picture>
        </header>
    );

    // CONSENT (если нужен) — приоритетно, не подменяем локальным view
    if (details.prompt.name === 'consent') {
        return (
            <main className={`${styles.shell} ${styles.wide}`}>
                <Header />
                <h1 className={styles.title}>Authorize {appName ? `${appName}` : ''}</h1>
                <p className={styles.lead}>
                    <span><b>{appName ? `${appName}` : ''}</b> requests access to:</span>
                </p>
                {(() => {
                    const scopes = (details.params.scope || 'openid').split(/\s+/).filter(Boolean);
                    const explanations: Record<string, { title: string; desc: string }> = {
                        openid: { title: 'Basic identity', desc: 'Basic profile information.' },
                        profile: { title: 'Public profile', desc: 'Name and public profile data.' },
                        email: { title: 'Email address', desc: 'Email and verification status.' },
                        phone: { title: 'Phone number', desc: 'Phone and verification status.' },
                        address: { title: 'Address', desc: 'Address details if provided.' },
                        offline_access: { title: 'Offline access', desc: 'Refresh tokens to stay signed in.' },
                    };
                    return (
                        <section className={styles.scopeList} aria-label="Requested permissions">
                            <ul className={styles.scopeUl}>
                                {scopes.map((s) => {
                                    const info = explanations[s] || { title: s, desc: 'Requested access scope.' };
                                    return (
                                        <li key={s} className={styles.scopeLi}>
                                            <div className={styles.scopeTitle}>{info.title}</div>
                                            <div className={styles.scopeDesc}>{info.desc}</div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })()}
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
                <Header />
                <h1 className={styles.title}>Continue {appName ? `to ${appName}` : ''}</h1>
                <div className={styles.providersGrid}>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled={busy}>
                        <span className={styles.btnInner}>
                            <FaGoogle className={styles.icon} aria-hidden="true" />
                            <span className={styles.btnLabel}>Continue with Google</span>
                        </span>
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.providerBtn} ${styles.btnWithIcon}`} disabled={busy}>
                        <span className={styles.btnInner}>
                            <FaApple className={styles.icon} aria-hidden="true" />
                            <span className={styles.btnLabel}>Continue with Apple</span>
                        </span>
                    </button>
                </div>
                <div className={styles.divider}><span>or</span></div>
                <div className={styles.actions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => switchView('signup')} disabled={busy}>
                        {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                        <span>Create account with Email</span>
                    </button>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => switchView('login')} disabled={busy}>
                        {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                        <span>Sign in with Email</span>
                    </button>
                </div>
            </main>
        );
    }

    // LOGIN (email)
    if (view === 'login') {
        const err = sp.get('err');
        const alert = (text: string) => (<div className={styles.alert}>{text}</div>);
        return (
            <main className={styles.shell}>
                <Header />
                <h1 className={styles.title}>Sign in {appName ? `to ${appName}` : ''}</h1>
                <section key="login">
                    {err && loginErrorMessages[err] ? alert(loginErrorMessages[err]) : null}
                    <form method="post" action={`/interaction/${uid}/login`} className={styles.form} autoComplete="on" onSubmit={() => setBusy(true)}>
                        <input
                            name="email"
                            type="email"
                            placeholder="Your email"
                            required
                            className={styles.input}
                            autoComplete="section-login username email"
                            inputMode="email"
                            autoCapitalize="none"
                            autoCorrect="off"
                        />
                        <input
                            name="password"
                            type="password"
                            placeholder="Password"
                            required
                            className={styles.input}
                            autoComplete="section-login current-password"
                        />
                        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
                            {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                            <span>Sign in</span>
                        </button>
                    </form>

                    <div className={styles.helper} />
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        onClick={() => switchView('signup')}
                        disabled={busy}
                    >
                        {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                        <span>Create account instead</span>
                    </button>
                </section>
            </main>
        );
    }

    // SIGNUP (email)
    return (
        <main className={styles.shell}>
            <Header />
            <h1 className={styles.title}>Create account {appName ? `for ${appName}` : ''}</h1>
            <section key="signup">
                {(() => { const err = sp.get('err'); const m: Record<string, string> = { invalid_email: 'Incorrect e-mail.', missing_fields: 'Fill in all the fields.', invalid_credentials: 'Incorrect email or password.', weak_password: 'The password is too short.', email_exists: 'The mail has already been registered.', login_failed: 'Couldn\'t log in. Try again.', signup_failed: 'Couldn\'t create an account. Try again.' }; return err && m[err] ? (<div className={styles.alert}>{m[err]}</div>) : null; })()}
                <form method="post" action={`/interaction/${uid}/signup`} className={styles.form} autoComplete="on" onSubmit={() => setBusy(true)}>
                    <input
                        name="name"
                        placeholder="Your name"
                        className={styles.input}
                        autoComplete="section-signup name"
                        autoCapitalize="words"
                        autoCorrect="off"
                    />
                    <input
                        name="email"
                        type="email"
                        placeholder="Enter email"
                        required
                        className={styles.input}
                        autoComplete="section-signup email"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Password (min 6 characters)"
                        required
                        className={styles.input}
                        autoComplete="section-signup new-password"
                    />
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
                        {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                        <span>Create account</span>
                    </button>
                </form>

                <div className={styles.helper} />
                <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => switchView('login')}
                    disabled={busy}
                >
                    {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
                    <span>I already have an account</span>
                </button>
            </section>
        </main>
    );
}