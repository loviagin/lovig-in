// app/reset/[token]/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function ResetPage() {
    const { token } = useParams<{ token: string }>();
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [email, setEmail] = useState<string>('');

    useEffect(() => {
        let abort = false;
        (async () => {
            try {
                const r = await fetch(`/api/oidc/password/inspect?token=${encodeURIComponent(String(token))}`, { cache: 'no-store' });
                if (!r.ok) throw new Error('invalid_or_expired');
                const j = await r.json();
                if (!abort) setEmail(String(j.email || ''));
            } catch {
                if (!abort) setErr('The reset link is invalid or expired.');
            }
        })();
        return () => { abort = true; };
    }, [token]);

    return (
        <main className={styles.shell}>
            <h1 className={styles.title}>Set new password</h1>
            {err ? <div className={styles.error}>{err}</div> : null}
            <form className={styles.form}
                onSubmit={async (e) => {
                    e.preventDefault(); setErr(null); setBusy(true);
                    const fd = new FormData(e.currentTarget);
                    const p1 = String(fd.get('password') || '');
                    const p2 = String(fd.get('password2') || '');
                    if (p1.length < 6) { setErr('Password too short'); setBusy(false); return; }
                    if (p1 !== p2) { setErr('Passwords do not match'); setBusy(false); return; }

                    const r = await fetch('/api/oidc/password/reset', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ token, newPassword: p1, email }),
                    });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) {
                        setErr(j.error || 'Reset failed');
                        setBusy(false);
                        return;
                    }
                    router.replace('/reset/success');
                }}
            >
                <input
                    name="email"
                    type="email"
                    value={email}
                    readOnly
                    className={styles.input}
                    aria-label="Account e-mail"
                />
                <input name="password" type="password" placeholder="New password (min 6)" required className={styles.input} />
                <input name="password2" type="password" placeholder="Repeat new password" required className={styles.input} />
                <button disabled={busy} className={`${styles.btn} ${styles.btnPrimary}`}>
                    {busy ? <span className={styles.spinner} aria-hidden /> : null}
                    {busy ? 'Saving…' : 'Set password'}
                </button>
            </form>
        </main>
    );
}