'use client';

import styles from './NotFound.module.css';

export default function NotFound() {
    const goBack = () => {
        if (history.length > 1) {
            history.back();
        } else {
            location.href = '/';
        }
    };

    return (
        <main className={styles.wrapper}>
            <div className={styles.card} role="group" aria-labelledby="nf-title">
                <h1 id="nf-title" className={styles.title}>Interaction not found</h1>
                <p className={styles.text}>Looks like the link has expired or been completed.</p>
                <div className={styles.actions}>
                    <button className={styles.button} onClick={goBack}>
                        Go back
                    </button>
                    <span className={styles.muted}>If nothing happens, go to the home page.</span>
                </div>
            </div>
        </main>
    );
}
