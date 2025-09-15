// oidc-server.mjs 
import 'dotenv/config';
import http from 'node:http';
import Provider from 'oidc-provider';
import { Pool } from 'pg';
import argon2 from 'argon2';
import { parse } from 'node:url';
import fs from 'node:fs';

const ISSUER = process.env.ISSUER_URL; // http://localhost:3300/api/oidc
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const RESERVE_ROTATION_KEY = process.env.RESERVE_ROTATION_KEY;
const JWKS_LOCATION = process.env.JWKS_LOCATION;
if (!ISSUER) throw new Error('ISSUER_URL env is required');
if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET env is required');
if (!JWKS_LOCATION) throw new Error('JWKS_LOCATION env is required');

async function main() {
    const jwks = JSON.parse(fs.readFileSync(JWKS_LOCATION, 'utf8'));
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const configuration = {
        pkce: { required: () => true, methods: ['S256'] },
        rotateRefreshToken: true,
        features: {
            devInteractions: { enabled: false },
            rpInitiatedLogout: { enabled: true },
            revocation: { enabled: true },
        },
        logoutSource(ctx, form) {
            ctx.type = 'html';
            ctx.body = `<!doctype html><meta charset="utf-8"><body>${form}
          <script>document.forms[0]?.submit()</script>`;
        },
        postLogoutSuccessSource(ctx) {
            ctx.type = 'html';
            ctx.body = '<!doctype html><meta charset="utf-8"><body>Signed out</body>';
        },
        cookies: {
            names: { interaction: 'oidc:interaction', session: 'oidc:session' },
            keys: [COOKIE_SECRET, RESERVE_ROTATION_KEY], // на будущее
            short: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
            long: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
        },
        interactions: {
            url(ctx, interaction) {
                return `/int/${interaction.uid}`;
            },
            policy: async (ctx, interaction, runDefaultPolicy) => {
                const result = await runDefaultPolicy();
                if (result.prompt.name === 'consent') {
                    const { oidc } = ctx;
                    const grantId = oidc.session?.grantIdFor(oidc.params.client_id);
                    if (grantId) {
                        // грант уже был — пропускаем экран
                        return { name: 'login' }; // любой «не consent», чтобы интеракция не требовала подтверждения
                    }
                }
                return result;
            },
        },
        ttl: { Session: 60 * 60 * 24 * 7, Interaction: 60 * 10 },
        clients: [
            {
                client_id: 'demo-web',
                redirect_uris: [`${ISSUER}/cb`],
                post_logout_redirect_uris: ['https://auth.lovig.in'],
                response_types: ['code'],
                grant_types: ['authorization_code', 'refresh_token'],
                token_endpoint_auth_method: 'none',
                id_token_signed_response_alg: 'ES256',
            },
        ],
        claims: {
            openid: ['sub'],
            email: ['email', 'email_verified'],
            profile: ['name'],
        },
        findAccount: async (ctx, sub) => {
            return {
                accountId: sub,
                claims: async (use, scope) => {
                    // sub = users.id
                    const { rows } = await pool.query(
                        'SELECT email, email_verified, name FROM users WHERE id = $1',
                        [sub]
                    );
                    if (!rows[0]) return { sub };
                    const u = rows[0];
                    return {
                        sub,
                        ...(scope?.includes('email') ? { email: u.email, email_verified: u.email_verified } : {}),
                        ...(scope?.includes('profile') ? { name: u.name ?? null } : {}),
                    };
                }
            };
        },
        jwks,
    };

    const provider = new Provider(ISSUER, configuration);
    provider.proxy = true;

    // 3) HTTP: перехватываем только /cb, остальное — в provider.callback()
    const server = http.createServer(async (req, res) => {
        const { pathname, query } = parse(req.url, true);

        if (pathname === '/healthz') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }

        if (pathname === '/cb') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Callback OK
code=${query.code}
state=${query.state}

Скопируй code — обменяй на токены:
curl -X POST ${ISSUER}/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=authorization_code&client_id=demo-web&redirect_uri=${ISSUER.replace('/api/oidc', '')}/api/oidc/cb&code=ВСТАВЬ_CODE"
`);
            return;
        }

        function readBody(req) {
            return new Promise((resolve, reject) => {
                let data = '';
                req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
                req.on('end', () => resolve(data));
                req.on('error', reject);
            });
        }

        const m1 = pathname.match(/^\/interaction\/([^/]+)$/);
        if (req.method === 'GET' && m1) {
            (async () => {
                try {
                    const details = await provider.interactionDetails(req, res);
                    // минимальный ответ
                    const out = {
                        uid: details.uid,
                        prompt: details.prompt,        // { name: 'login' | 'consent', ... }
                        params: details.params,        // client_id, scope, redirect_uri ...
                        session: details.session || null,
                    };
                    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
                    res.end(JSON.stringify(out));
                } catch (e) {
                    res.writeHead(400, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'interaction_fetch_failed', message: String(e?.message || e) }));
                }
            })();
            return;
        }

        // 2) логин: принимаем login (e-mail/идентификатор) и завершаем интеракцию
        const m2 = pathname.match(/^\/interaction\/([^/]+)\/login$/);
        if (req.method === 'POST' && m2) {
            (async () => {
                const uidFromPath = m2[1];
                try {
                    console.log('[login] POST', { url: req.url, uidFromPath });

                    // читаем тело
                    const raw = await readBody(req);
                    const ct = (req.headers['content-type'] || '').toLowerCase();
                    const form = ct.includes('application/json')
                        ? (raw ? JSON.parse(raw) : {})
                        : Object.fromEntries(new URLSearchParams(raw));

                    const email = String(form.login || form.email).trim().toLowerCase();
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'invalid email' }));
                        return;
                    }
                    const password = String(form.password || '').trim();

                    if (!email || !password) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'email & password required' }));
                        return;
                    }

                    // ищем пользователя в БД
                    const { rows } = await pool.query(
                        'SELECT id, password_hash, email_verified, name FROM users WHERE email = $1',
                        [email]
                    );

                    if (!rows[0]) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_credentials' }));
                        return;
                    }

                    // сравнение пароля с hash в БД
                    if (!rows[0] || !(await argon2.verify(rows[0].password_hash, password))) {
                        await new Promise(r => setTimeout(r, 500)); // небольшая пауза
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_credentials' }));
                        return;
                    }

                    // успех → sub = uuid из БД
                    const result = { login: { accountId: rows[0].id } };
                    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
                    console.log('[login] finished ok', { uidFromPath, accountId: rows[0].id });
                } catch (e) {
                    console.error('[login] failed', e);
                    res.writeHead(400, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'login_failed', message: String(e?.message || e) }));
                }
            })();
            return;
        }

        // 3) consent: выдаём недостающие разрешения и завершаем
        const m3 = pathname.match(/^\/interaction\/([^/]+)\/confirm$/);
        if (req.method === 'POST' && m3) {
            (async () => {
                try {
                    const details = await provider.interactionDetails(req, res);
                    const { params, session } = details;

                    let grant;
                    if (details.grantId) {
                        grant = await provider.Grant.find(details.grantId);
                    } else {
                        grant = new provider.Grant({
                            accountId: session.accountId,
                            clientId: params.client_id,
                        });
                    }
                    if (typeof params.scope === 'string' && params.scope) {
                        grant.addOIDCScope(params.scope);
                    }
                    const grantId = await grant.save();
                    await provider.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });
                } catch (e) {
                    res.writeHead(400, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'consent_failed', message: String(e?.message || e) }));
                }
            })();
            return;
        }

        return provider.callback()(req, res);
    });

    server.listen(4400, () => {
        console.log('OIDC listening on http://localhost:4400  (issuer =', ISSUER, ')');
    });

    process.on('SIGTERM', async () => {
        console.log('SIGTERM: shutting down OIDC...');
        server.close(() => console.log('HTTP server closed'));
        try { await pool.end(); } catch { }
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        console.log('SIGINT: shutting down OIDC...');
        server.close(() => console.log('HTTP server closed'));
        try { await pool.end(); } catch { }
        process.exit(0);
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});