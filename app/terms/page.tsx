// app/terms/page.tsx
import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
    title: 'Terms of Service — LOVIGIN ONE LOGIN',
    description:
        'The terms and conditions that govern your use of LOVIGIN services.',
};

export default function TermsPage() {
    return (
        <main className={styles.shell}>
            <div className={styles.card}>
                <h1 className={styles.title}>Terms of Service</h1>
                <span className={styles.muted}>Last updated: September 17, 2025</span>

                <p>
                    These Terms of Service (“Terms”) govern your access to and use of the websites, mobile apps, and services
                    (collectively, the “Services”) provided by <strong>LOVIGIN</strong> (“we”, “us”, or “our”). By using the
                    Services, you agree to these Terms.
                </p>

                <h2 className={styles.sectionTitle}>1. Eligibility &amp; Accounts</h2>
                <ul className={styles.list}>
                    <li>You must be legally capable of entering into a binding agreement to use the Services.</li>
                    <li>
                        When you create an account, you must provide accurate information and keep it updated. You are responsible
                        for safeguarding credentials and for activities under your account.
                    </li>
                </ul>

                <h2 className={styles.sectionTitle}>2. Use of the Services</h2>
                <ul className={styles.list}>
                    <li>Subject to these Terms, we grant you a limited, non-exclusive, non-transferable right to use the Services.</li>
                    <li>
                        You agree not to misuse the Services, including (without limitation) by attempting unauthorized access,
                        interfering with operation, or violating applicable laws.
                    </li>
                    <li>
                        We may modify, suspend, or discontinue features at any time, with or without notice, to the extent permitted
                        by law.
                    </li>
                </ul>

                <h2 className={styles.sectionTitle}>3. User Content</h2>
                <p>
                    If you submit or upload content, you retain your rights to that content. You grant us a limited license to
                    host, store, and process it as necessary to operate the Services. You represent that you have the necessary
                    rights to submit the content and that it does not violate law or third-party rights.
                </p>

                <h2 className={styles.sectionTitle}>4. Third-Party Services</h2>
                <p>
                    The Services may integrate with third parties (e.g., Google Sign-In, Apple Sign-In, Phone number). Your use of such services is subject to
                    their terms and privacy policies. We are not responsible for third-party services.
                </p>

                <h2 className={styles.sectionTitle}>5. Intellectual Property</h2>
                <p>
                    The Services, including software, text, graphics, and logos, are owned by us or our licensors and are protected
                    by applicable intellectual property laws. No rights are granted except as expressly set out in these Terms.
                </p>

                <h2 className={styles.sectionTitle}>6. Fees</h2>
                <p>
                    If any portion of the Services is offered for a fee, pricing and payment terms will be provided separately.
                    You agree to pay all applicable fees and taxes.
                </p>

                <h2 className={styles.sectionTitle}>7. Disclaimers</h2>
                <p>
                    The Services are provided “as is” and “as available” without warranties of any kind, express or implied,
                    including merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee that
                    the Services will be uninterrupted or error-free.
                </p>

                <h2 className={styles.sectionTitle}>8. Limitation of Liability</h2>
                <p>
                    To the maximum extent permitted by law, we will not be liable for indirect, incidental, special, consequential,
                    or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss
                    of data, use, goodwill, or other intangible losses, resulting from your use of the Services.
                </p>

                <h2 className={styles.sectionTitle}>9. Indemnification</h2>
                <p>
                    You agree to indemnify and hold harmless LOVIGIN and its affiliates, officers, employees, and agents from any
                    claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or in any
                    way related to your use of the Services or violation of these Terms.
                </p>

                <h2 className={styles.sectionTitle}>10. Termination</h2>
                <p>
                    We may suspend or terminate your access to the Services at any time for any reason, including if we believe
                    you violated these Terms. Upon termination, your right to use the Services will cease immediately.
                </p>

                <h2 className={styles.sectionTitle}>11. Governing Law &amp; Dispute Resolution</h2>
                <p>
                    These Terms are governed by the laws of your primary operating jurisdiction (to be specified by LOVIGIN).
                    Any disputes will be resolved in the courts or through arbitration as designated by LOVIGIN’s policies,
                    subject to mandatory consumer protections where applicable.
                </p>

                <h2 className={styles.sectionTitle}>12. Changes to These Terms</h2>
                <p>
                    We may update these Terms from time to time. The “Last updated” date indicates the latest changes. Your
                    continued use of the Services after changes become effective constitutes acceptance of the updated Terms.
                </p>

                <h2 className={styles.sectionTitle}>13. Contact</h2>
                <p>
                    LOVIGIN LTD<br />
                    Email: privacy@lovigin.com<br />
                    Address: 86-90 Paul Street London, EC2A 4NE, UK
                </p>
            </div>
        </main>
    );
}