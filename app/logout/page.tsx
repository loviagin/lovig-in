'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function LogoutPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // Автоматический редирект через 1.5 секунды
    const redirectUri = searchParams.get('post_logout_redirect_uri');
    if (redirectUri) {
      const timer = setTimeout(() => {
        window.location.href = redirectUri;
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.checkmark}>
          <svg viewBox="0 0 52 52" className={styles.checkmarkSvg}>
            <circle className={styles.checkmarkCircle} cx="26" cy="26" r="25" fill="none" />
            <path className={styles.checkmarkCheck} fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>
        <h1 className={styles.title}>Signed Out Successfully</h1>
        <p className={styles.message}>
          You have been signed out from all devices.
        </p>
        <p className={styles.redirect}>
          Redirecting you back to the app...
        </p>
      </div>
    </div>
  );
}

