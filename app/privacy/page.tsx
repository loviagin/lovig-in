// app/privacy/page.tsx
import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'Privacy Policy — LOVIGIN ONE LOGIN',
    description:
        'How LOVIGIN collects, uses, and protects your personal data, and what rights you have.',
};

export default function PrivacyPage() {
    return (
        <main className={styles.shell}>
            <div className={styles.card}>
                <h1 className={styles.title}>Privacy Policy</h1>
                <span className={styles.muted}>Last updated: September 17, 2025</span>

                <p>
                    This Privacy Policy explains how <strong>LOVIGIN</strong> (“we”, “us”, or “our”) collects, uses,
                    discloses, and protects information about you when you use our websites, mobile apps, and services
                    (collectively, the “Services”). By using the Services, you agree to this Policy.
                </p>

                <h2 className={styles.sectionTitle}>1. Information We Collect</h2>
                <ul className={styles.list}>
                    <li>
                        <strong>Account &amp; Profile:</strong> name, email address, username, authentication identifiers,
                        providers (e.g., email, Google, Apple, Phone number).
                    </li>
                    <li>
                        <strong>Usage Data:</strong> device information, IP address, browser type, pages viewed, time spent,
                        referring URLs, and interactions with features.
                    </li>
                    <li>
                        <strong>Cookies &amp; Similar Technologies:</strong> cookies, local storage, and similar tools for
                        session management, analytics, and personalization.
                    </li>
                    <li>
                        <strong>Support &amp; Communications:</strong> messages you send us, feedback, and related metadata.
                    </li>
                </ul>

                <h2 className={styles.sectionTitle}>2. How We Use Information</h2>
                <ul className={styles.list}>
                    <li>Provide, operate, and improve the Services.</li>
                    <li>Authenticate users, maintain sessions, and prevent fraud or abuse.</li>
                    <li>Personalize content and remember preferences.</li>
                    <li>Analyze usage to improve performance and reliability.</li>
                    <li>Communicate with you about updates, security, and support.</li>
                    <li>Comply with legal obligations and enforce our Terms.</li>
                </ul>

                <h2 className={styles.sectionTitle}>3. Legal Bases (EEA/UK only)</h2>
                <p>
                    Where applicable, we process personal data under the following legal bases: (i) performance of a contract
                    to provide the Services; (ii) legitimate interests in securing and improving the Services; (iii) consent,
                    where required (e.g., certain cookies); and (iv) compliance with legal obligations.
                </p>

                <h2 className={styles.sectionTitle}>4. Sharing &amp; Disclosure</h2>
                <ul className={styles.list}>
                    <li>
                        <strong>Service Providers:</strong> vendors that process data on our behalf (e.g., hosting, analytics).
                    </li>
                    <li>
                        <strong>Legal &amp; Safety:</strong> to comply with law, enforce agreements, or protect rights and safety.
                    </li>
                    <li>
                        <strong>Business Transfers:</strong> in connection with a merger, acquisition, or asset sale.
                    </li>
                </ul>

                <h2 className={styles.sectionTitle}>5. Cookies</h2>
                <p>
                    We use essential cookies for authentication and security, and (where applicable) analytics cookies to
                    understand usage. You can control cookies via your browser settings. Some features may not function
                    without essential cookies.
                </p>

                <h2 className={styles.sectionTitle}>6. Data Retention</h2>
                <p>
                    We retain personal data only as long as necessary for the purposes described in this Policy, to provide the
                    Services, comply with legal requirements, and resolve disputes. Retention periods may vary based on data type
                    and legal obligations.
                </p>

                <h2 className={styles.sectionTitle}>7. International Transfers</h2>
                <p>
                    We may process and store information in countries outside your own. Where required, we implement appropriate
                    safeguards (such as standard contractual clauses) to protect your information.
                </p>

                <h2 className={styles.sectionTitle}>8. Security</h2>
                <p>
                    We employ administrative, technical, and organizational measures designed to protect information. However,
                    no method of transmission or storage is completely secure.
                </p>

                <h2 className={styles.sectionTitle}>9. Your Rights</h2>
                <p>
                    Depending on your location, you may have rights to access, correct, delete, or restrict the use of your data,
                    object to processing, or request portability. You can also withdraw consent where processing is based on
                    consent. To exercise rights, contact us as described below.
                </p>

                <h2 className={styles.sectionTitle}>10. Children’s Privacy</h2>
                <p>
                    The Services are not directed to children under 13 (or the age required by local law). We do not knowingly
                    collect personal information from children. If you believe a child has provided us data, contact us.
                </p>

                <h2 className={styles.sectionTitle}>11. Changes to This Policy</h2>
                <p>
                    We may update this Policy from time to time. The “Last updated” date indicates the latest changes. If changes
                    are material, we will provide additional notice as required by law.
                </p>

                <h2 className={styles.sectionTitle}>12. Contact</h2>
                <p>
                    LOVIGIN LTD<br />
                    Email: privacy@lovigin.com<br />
                    Address: 86-90 Paul Street London, EC2A 4NE, UK
                </p>
            </div>
        </main>
    );
}