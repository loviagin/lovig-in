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
    u.searchParams.set('response_mode', 'form_post');      // важно
    u.searchParams.set('client_id', APPLE_CLIENT_ID);
    u.searchParams.set('redirect_uri', APPLE_REDIRECT_URI);
    u.searchParams.set('scope', 'name email');
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    return u.toString();
}

// GET /interaction/:uid/apple/start
export async function appleStart(provider, req, res, uid) {
    // Не требуем interaction на старте — проверим в колбэке
    const url = appleAuthUrl({ state: uid });
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
export async function appleCallback(provider, pool, req, res, query) {
    let code = '', state = '';
    if (req.method === 'POST') {
        const raw = await new Promise((r, j) => { let s = ''; req.on('data', c => s += c); req.on('end', () => r(s)); req.on('error', j); });
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const body = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));
        code = String(body.code || '');
        state = String(body.state || '');
        // user приходит только один раз, можешь вытянуть имя из body.user (JSON)
    } else {
        code = String(query.code || '');
        state = String(query.state || '');
    }

    if (!state) return redirect303(res, `/int/error?code=invalid_state`);
    try { await provider.interactionDetails(req, res); }
    catch { return redirect303(res, `/int/error?code=interaction_expired`); }
    if (!code) return redirect303(res, `/int/${state}?screen=login&err=login_failed`);

    try {
        // 1) code -> tokens
        const clientSecret = await buildClientSecret();
        const tokens = await exchangeCode(code, clientSecret);
        if (!tokens.id_token) throw new Error('no id_token from apple');

        // 2) verify id_token
        const claims = await verifyIdToken(tokens.id_token);
        const appleSub = String(claims.sub);
        const email = (claims.email ? String(claims.email) : '').toLowerCase();
        const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

        // 3) find-or-create
        let userId;

        if (email && emailVerified) {
            const found = await pool.query(
                'SELECT id, providers, apple_sub FROM users WHERE LOWER(email)=LOWER($1)',
                [email]
            );
            if (found.rows[0]) {
                userId = found.rows[0].id;
                await pool.query(
                    `UPDATE users
             SET providers = ARRAY(SELECT DISTINCT unnest(coalesce(providers,'{}'::text[]) || '{apple}')),
                 apple_sub = COALESCE(apple_sub, $2)
           WHERE id = $1`,
                    [userId, appleSub]
                );
            } else {
                const ins = await pool.query(
                    `INSERT INTO users (email, password_hash, name, email_verified, providers, apple_sub)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
                    [email, null, null, true, ['apple'], appleSub]
                );
                userId = ins.rows[0].id;
            }
        } else {
            // email отсутствует (частый случай на повторных логинах) — ищем по sub
            const bySub = await pool.query('SELECT id FROM users WHERE apple_sub = $1', [appleSub]);
            if (bySub.rows[0]) {
                userId = bySub.rows[0].id;
                await pool.query(
                    `UPDATE users
             SET providers = ARRAY(SELECT DISTINCT unnest(coalesce(providers,'{}'::text[]) || '{apple}'))
           WHERE id = $1`,
                    [userId]
                );
            } else {
                return redirect303(res, `/int/${state}?screen=login&err=login_failed`);
            }
        }

        // 4) finish interaction
        await provider.interactionFinished(req, res, { login: { accountId: userId } }, { mergeWithLastSubmission: false });
    } catch (e) {
        log.error('[apple callback] failed', e);
        return redirect303(res, `/int/${state}?screen=login&err=login_failed`);
    }
}