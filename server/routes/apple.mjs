// server/routes/apple.mjs
import fs from 'node:fs';
import path from 'node:path';
import { importPKCS8, SignJWT, jwtVerify, createRemoteJWKSet } from 'jose';
import { redirect303 } from '../utils.mjs';
import { log } from '../logger.mjs';

const {
    APPLE_TEAM_ID,
    APPLE_KEY_ID,
    APPLE_CLIENT_ID,
    APPLE_KEY_P8_PATH,
    APPLE_KEY_P8,
    APPLE_REDIRECT_URI,
} = process.env;

if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_CLIENT_ID || !APPLE_REDIRECT_URI || (!APPLE_KEY_P8_PATH && !APPLE_KEY_P8)) {
    throw new Error('APPLE_* env vars are required');
}

const APPLE_AUTHZ = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN = 'https://appleid.apple.com/auth/token';
const APPLE_ISS = 'https://appleid.apple.com';

async function readBody(req) {
    return await new Promise((resolve, reject) => {
        let s = '';
        req.on('data', c => s += c);
        req.on('end', () => resolve(s));
        req.on('error', reject);
    });
}

// ----- client_secret (JWT), живёт ~20 минут
async function buildClientSecret() {
    const now = Math.floor(Date.now() / 1000);
    const pem = APPLE_KEY_P8 ?? fs.readFileSync(
        APPLE_KEY_P8_PATH && path.isAbsolute(APPLE_KEY_P8_PATH)
            ? APPLE_KEY_P8_PATH
            : path.join(process.cwd(), APPLE_KEY_P8_PATH || ''),
        'utf8'
    );
    const pkcs8 = await importPKCS8(pem, 'ES256');

    return await new SignJWT({})
        .setProtectedHeader({ kid: APPLE_KEY_ID, alg: 'ES256' })
        .setIssuer(APPLE_TEAM_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 20 * 60)
        .setAudience(APPLE_ISS)
        .setSubject(APPLE_CLIENT_ID)
        .sign(pkcs8);
}

function appleAuthUrl(params) {
    const u = new URL('https://appleid.apple.com/auth/authorize');
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('response_mode', 'form_post'); 
    u.searchParams.set('client_id', APPLE_CLIENT_ID);
    u.searchParams.set('redirect_uri', APPLE_REDIRECT_URI);
    u.searchParams.set('scope', 'name email');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.toString();
}

// GET /interaction/:uid/apple/start
export async function appleStart(provider, req, res, uid) {
    // Не требуем interaction на старте — проверим в колбэке
    const ua = req.headers['user-agent'] || '';
    const url = appleAuthUrl({ state: uid });
    console.log('[apple start] uid=%s ua=%s -> %s', uid, ua, url);

    res.writeHead(302, { Location: url });
    res.end();
}

// form-urlencoded helper
function toForm(data) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) sp.set(k, String(v));
    return sp.toString();
}

// EXCHANGE code -> tokens
async function exchangeCode(code, clientSecret) {
    const resp = await fetch(APPLE_TOKEN, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: toForm({
            grant_type: 'authorization_code',
            code,
            client_id: APPLE_CLIENT_ID,
            client_secret: clientSecret,
            redirect_uri: APPLE_REDIRECT_URI,
        }),
    });
    if (!resp.ok) throw new Error(`apple token http ${resp.status} ${await resp.text()}`);
    return await resp.json(); // { access_token, id_token, ... }
}

// VERIFY id_token via Apple JWKS
const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
async function verifyIdToken(idToken) {
    const { payload } = await jwtVerify(idToken, JWKS, {
        issuer: APPLE_ISS,
        audience: APPLE_CLIENT_ID,
    });
    return payload;
}

// GET /interaction/apple/cb?code=...&state=<uid>  (response_mode=query)
export async function appleCallback(provider, pool, req, res) {
    try {
        console.log('[apple cb] method=%s cookie=%s ct=%s',
            req.method, req.headers.cookie || '-', req.headers['content-type'] || '-');

        // 1) достаём code/state
        let code = '', state = '', userJson = null;

        if (req.method === 'POST') {
            const raw = await readBody(req);
            const ct = (req.headers['content-type'] || '').toLowerCase();
            const body = ct.includes('application/json')
                ? (raw ? JSON.parse(raw) : {})
                : Object.fromEntries(new URLSearchParams(raw));

            code = String(body.code || '');
            state = String(body.state || '');
            if (body.user) {
                try { userJson = JSON.parse(String(body.user)); } catch { }
            }
        } else { // GET fallback
            const u = new URL(req.url, `https://${req.headers.host}`);
            code = String(u.searchParams.get('code') || '');
            state = String(u.searchParams.get('state') || '');
        }

        if (!state) {
            return redirect303(res, `/int/error?code=invalid_state`);
        }

        // 2) проверим интеракцию (ожидаем куку; для form_post нужен SameSite=None)
        try { await provider.interactionDetails(req, res); }
        catch { return redirect303(res, `/int/error?code=interaction_expired`); }

        if (!code) {
            return redirect303(res, `/int/${encodeURIComponent(state)}?screen=login&err=login_failed`);
        }

        // 3) обмен кода
        const clientSecret = await buildClientSecret();
        const tokens = await exchangeCode(code, clientSecret);
        if (!tokens.id_token) throw new Error('no id_token from apple');

        // 4) verify id_token
        const claims = await verifyIdToken(tokens.id_token);
        const appleSub = String(claims.sub);
        const email = (claims.email ? String(claims.email) : '').toLowerCase();
        const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

        // опционально имя (придёт только в ПЕРВЫЙ раз через form_post)
        const firstName = userJson?.name?.firstName?.trim() || '';
        const lastName = userJson?.name?.lastName?.trim() || '';
        const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : null;

        // 5) find-or-create
        let userId;

        if (email && emailVerified) {
            const found = await pool.query('SELECT id, providers, apple_sub FROM users WHERE LOWER(email)=LOWER($1)', [email]);
            if (found.rows[0]) {
                userId = found.rows[0].id;
                await pool.query(
                    `UPDATE users
               SET providers = ARRAY(SELECT DISTINCT unnest(coalesce(providers,'{}'::text[]) || '{apple}')),
                   apple_sub = COALESCE(apple_sub, $2),
                   name = COALESCE(name, $3)
             WHERE id = $1`,
                    [userId, appleSub, fullName]
                );
            } else {
                const ins = await pool.query(
                    `INSERT INTO users (email, password_hash, name, email_verified, providers, apple_sub)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                    [email, null, fullName, true, ['apple'], appleSub]
                );
                userId = ins.rows[0].id;
            }
        } else {
            const bySub = await pool.query('SELECT id FROM users WHERE apple_sub = $1', [appleSub]);
            if (!bySub.rows[0]) {
                return redirect303(res, `/int/${encodeURIComponent(state)}?screen=login&err=login_failed`);
            }
            userId = bySub.rows[0].id;
            await pool.query(
                `UPDATE users
             SET providers = ARRAY(SELECT DISTINCT unnest(coalesce(providers,'{}'::text[]) || '{apple}'))
           WHERE id = $1`,
                [userId]
            );
        }

        // 6) завершаем интеракцию
        await provider.interactionFinished(req, res, { login: { accountId: userId } }, { mergeWithLastSubmission: false });
    } catch (e) {
        log.error('[apple callback] failed', e);
        // если state неизвестен — отправим на общий экран ошибки
        return redirect303(res, `/int/error?code=apple_callback_failed`);
    }
}