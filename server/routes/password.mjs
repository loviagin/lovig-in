// server/routes/password.mjs
import crypto from 'node:crypto';
import { log } from '../logger.mjs';

const TTL_MIN = parseInt(process.env.RESET_TOKEN_TTL_MIN || '30', 10);
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'http://localhost:3300';

// универсальная отправка
async function sendEmail({ to, subject, html }) {
    if (process.env.RESEND_API_KEY) {
        // Resend
        const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'LOVIGIN <no-reply@lovig.in>',
                to, subject, html
            })
        });
        if (!resp.ok) throw new Error(`Resend failed: ${resp.status} ${await resp.text()}`);
        return;
    }
}

// helper: без разглашения существования email
function genericOk(res) {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true }));
}

// POST /password/forgot   { email }
export async function postForgot(pool, req, res) {
    try {
        log.info('[password/forgot] hit');
        const raw = await new Promise((r, j) => {
            let s = ''; req.on('data', c => s += c); req.on('end', () => r(s)); req.on('error', j);
        });
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const body = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));
        const email = String(body.email || '').trim().toLowerCase();

        // всегда отвечаем 200, даже если email пуст/нет в базе (чтобы не палить наличие)
        if (!email) return genericOk(res);

        // ищем пользователя
        const u = await pool.query('SELECT id, email FROM users WHERE LOWER(email)=LOWER($1)', [email]);
        if (!u.rows[0]) return genericOk(res);

        const userId = u.rows[0].id;

        // простая защита от спама: не больше 1 активного токена / 5 мин
        await pool.query(
            `DELETE FROM password_reset_tokens
        WHERE user_id=$1 AND (used_at IS NOT NULL OR expires_at < now())`,
            [userId]
        );

        const recent = await pool.query(
            `SELECT 1 FROM password_reset_tokens
        WHERE user_id=$1 AND created_at > now() - interval '5 minutes'`,
            [userId]
        );
        if (recent.rowCount > 0) {
            // молча отвечаем ok
            return genericOk(res);
        }

        // генерим сырой токен и кладём его SHA-256
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
        const expiresAt = new Date(Date.now() + TTL_MIN * 60_000);

        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_created, ua_created)
         VALUES ($1,$2,$3,$4,$5)`,
            [userId, tokenHash, expiresAt, req.socket.remoteAddress || null, req.headers['user-agent'] || null]
        );

        const resetUrl = `${PUBLIC_ORIGIN}/reset/${rawToken}`;
        const html = `
      <div style="font-family:system-ui,sans-serif">
        <h2>Reset your password</h2>
        <p>We received a request to reset the password for <b>${email}</b>.</p>
        <p><a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none">Set new password</a></p>
        <p>This link will expire in ${TTL_MIN} minutes. If you didn’t request it, ignore this email.</p>
      </div>
    `;

        try {
            await sendEmail({ to: email, subject: 'Reset your LOVIGIN password', html });
            log.info('[password/forgot] email queued', { to: email, resetUrl });
        } catch (e) {
            log.error('[password/forgot] email send failed', e);
        }

        return genericOk(res);
    } catch (e) {
        log.error('[password/forgot] failed', e);
        return genericOk(res); // всё равно 200, чтобы не палить детали
    }
}

// POST /password/reset    { token, newPassword }
export async function postReset(pool, req, res) {
    try {
        const raw = await new Promise((r, j) => {
            let s = ''; req.on('data', c => s += c); req.on('end', () => r(s)); req.on('error', j);
        });
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const body = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));
        const token = String(body.token || body.t || '');
        const newPassword = String(body.newPassword || body.password || '');

        if (!token || newPassword.length < 6) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_request' }));
            return;
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest();

        // найдём активный токен
        const q = await pool.query(
            `SELECT prt.id, prt.user_id
         FROM password_reset_tokens prt
        WHERE prt.token_hash = $1 AND prt.used_at IS NULL AND prt.expires_at > now()
        LIMIT 1`,
            [tokenHash]
        );
        if (!q.rows[0]) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_or_expired' }));
            return;
        }

        const { default: argon2 } = await import('argon2');
        const password_hash = await argon2.hash(newPassword);

        await pool.query('UPDATE users SET password_hash=$2 WHERE id=$1', [q.rows[0].user_id, password_hash]);
        await pool.query('UPDATE password_reset_tokens SET used_at=now() WHERE id=$1', [q.rows[0].id]);

        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    } catch (e) {
        log.error('[password/reset] failed', e);
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'reset_failed' }));
    }
}