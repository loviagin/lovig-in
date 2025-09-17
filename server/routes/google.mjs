// server/routes/google.mjs
import 'dotenv/config';
import { OAuth2Client } from 'google-auth-library';
import { redirect303 } from '../utils.mjs';
import { log } from '../logger.mjs';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://auth.lovig.in/interaction/google/cb';

let oauth = null;

function ensureGoogleConfigured() {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) return false;
    if (!oauth) {
        oauth = new OAuth2Client({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            redirectUri: GOOGLE_REDIRECT_URI,
        });
    }
    return true;
}

function googleAuthURL(params) {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    u.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('scope', 'openid email profile');
    u.searchParams.set('include_granted_scopes', 'true');
    u.searchParams.set('prompt', 'select_account');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
}

// GET /interaction/:uid/google/start
export async function googleStart(provider, req, res, uid) {
    if (!ensureGoogleConfigured()) {
        return redirect303(res, `/int/${uid}?screen=login&err=login_failed`);
    }
    try { await provider.interactionDetails(req, res); } catch {
        return redirect303(res, `/int/error?code=interaction_not_found`);
    }
    const url = googleAuthURL({ state: uid, access_type: 'online' });
    res.writeHead(302, { Location: url });
    res.end();
}

// GET /interaction/google/cb?code=...&state=<uid>
export async function googleCallback(provider, pool, req, res, query) {
    if (!ensureGoogleConfigured()) {
        return redirect303(res, `/int/error?code=oauth_not_configured`);
    }
    const uid = String(query.state || '');
    if (!uid) return redirect303(res, `/int/error?code=invalid_state`);

    try {
        // убедимся, что интеракция жива (есть interaction cookie)
        await provider.interactionDetails(req, res);
    } catch {
        return redirect303(res, `/int/error?code=interaction_expired`);
    }

    const code = String(query.code || '');
    if (!code) return redirect303(res, `/int/${uid}?screen=login&err=login_failed`);

    try {
        // 1) обмен кода на токены у Google
        const { tokens } = await oauth.getToken({ code, redirect_uri: GOOGLE_REDIRECT_URI });
        if (!tokens.id_token) throw new Error('no id_token from google');

        // 2) верификация id_token
        const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
        const p = ticket.getPayload();
        const email = (p?.email || '').toLowerCase();
        const emailVerified = Boolean(p?.email_verified);
        const name = p?.name || null;

        if (!email || !emailVerified) {
            // Без проверенной почты — не сможем связать/создать по твоим правилам
            return redirect303(res, `/int/${uid}?screen=login&err=login_failed`);
        }

        // 3) ищем пользователя по email (case-insensitive)
        const found = await pool.query(
            'SELECT id, providers FROM users WHERE LOWER(email) = LOWER($1)',
            [email]
        );

        let userId;
        if (found.rows[0]) {
            userId = found.rows[0].id;
            const providers = found.rows[0].providers || [];
            if (!providers.includes('google')) {
                await pool.query(
                    `UPDATE users
             SET providers = ARRAY(SELECT DISTINCT unnest(coalesce(providers,'{}'::text[]) || '{google}')),
                 name = COALESCE(name, $2)
           WHERE id = $1`,
                    [userId, name]
                );
            }
        } else {
            // создаём нового пользователя: verified email, без пароля, провайдер google
            const ins = await pool.query(
                `INSERT INTO users (email, password_hash, name, email_verified, providers)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [email, null, name, true, ['google']]
            );
            userId = ins.rows[0].id;
        }

        // 4) завершаем интеракцию как логин
        const result = { login: { accountId: userId } };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (e) {
        log.error('[google callback] failed', e);
        return redirect303(res, `/int/${uid}?screen=login&err=login_failed`);
    }
}