"use client";
import Link from 'next/link';
import styles from './page.module.css';

export default function ErrorClient({
  code,
  message,
  client,
}: {
  code: string;
  message: string;
  client: string;
}) {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="errorTitle">
        <h1 id="errorTitle" className={styles.title}>Error</h1>
        <p className={styles.meta}>Client: <b>{client}</b></p>
        <p className={styles.codeRow}><b>Code:</b> <code className={styles.code}>{code}</code></p>
        {message ? <p className={styles.message}>{message}</p> : null}

        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => location.reload()}>Refresh page</button>
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => (history.length > 1 ? history.back() : (location.href = '/'))}>
            Go back and retry
          </button>
          <Link href="/" className={`${styles.btn} ${styles.btnSecondary} ${styles.linkButton}`}>
            Go to home
          </Link>
        </div>
      </section>
    </main>
  );
}


