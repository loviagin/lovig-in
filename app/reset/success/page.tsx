// app/reset/success/page.tsx
import styles from './page.module.css'

export default function ResetSuccess() {
    return (
        <main className={styles.shell}>
            <div className={styles.icon} aria-hidden="true">
                <div className={styles.check} />
            </div>
            <h1 className={styles.title}>Password updated</h1>
            <p className={styles.desc}>You can now sign in with your new password.</p>
        </main>
    );
}