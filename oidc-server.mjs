// oidc-server.mjs
import 'dotenv/config';
import http from 'node:http';
import Provider, { interactionPolicy } from 'oidc-provider'; // <— ДОБАВИЛ interactionPolicy
import { Pool } from 'pg';
import argon2 from 'argon2';
import { parse } from 'node:url';
import fs from 'node:fs';

const ISSUER = process.env.ISSUER_URL; // например: https://auth.lovig.in/api/oidc
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const RESERVE_ROTATION_KEY = process.env.RESERVE_ROTATION_KEY;
const JWKS_LOCATION = process.env.JWKS_LOCATION;
if (!ISSUER) throw new Error('ISSUER_URL env is required');
if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET env is required');
if (!JWKS_LOCATION) throw new Error('JWKS_LOCATION env is required');

async function main() {
    const jwks = JSON.parse(fs.readFileSync(JWKS_LOCATION, 'utf8'));
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // ===== NEW: interactionPolicy (login+consent по умолчанию) + наш prompt "signup"
    const policy = interactionPolicy.base();
    const { Prompt } = interactionPolicy;
    const signupPrompt = new Prompt({ name: 'signup', requestable: true });
    policy.add(signupPrompt);
    // ===========================================================

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
            policy, // <— ПОДКЛЮЧИЛИ НОВУЮ POLICY
            url(ctx, interaction) {
                // <— БЫЛО /int/:uid, но у тебя ниже хендлеры /interaction/:uid
                return `/interaction/${interaction.uid}`;
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
            {
                client_id: 'demo-ios',
                application_type: 'native',
                redirect_uris: ['com.lovigin.ios.Skillify://oidc'],
                post_logout_redirect_uris: ['https://auth.lovig.in'],
                token_endpoint_auth_method: 'none',
                response_types: ['code'],
                grant_types: ['authorization_code', 'refresh_token'],
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

    // события (оставил как есть)
    provider.on('authorization.error', (ctx, err) => {
        console.error('[authorization.error]', err?.message, {
            client_id: ctx.oidc?.params?.client_id,
            redirect_uri: ctx.oidc?.params?.redirect_uri,
            scope: ctx.oidc?.params?.scope,
            response_type: ctx.oidc?.params?.response_type,
        });
    });

    provider.on('server_error', (ctx, err) => {
        console.error('[server_error]', err?.stack || err);
    });

    configuration.renderError = (ctx, out, err) => {
        ctx.type = 'text/plain; charset=utf-8';
        ctx.body = `OIDC error
  name=${err?.name}
  message=${err?.message}
  detail=${err?.error_description || ''}
  state=${ctx.oidc?.params?.state || '-'}
  client=${ctx.oidc?.params?.client_id || '-'}`;
    };

    provider.proxy = true;

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

        // GET /interaction/:uid  -> редирект на Next
        const m1 = pathname.match(/^\/interaction\/([^/]+)$/);
        if (req.method === 'GET' && m1) {
            const uid = m1[1];
            res.writeHead(302, { Location: `/int/${uid}` });
            res.end();
            return;
        }

        // GET /interaction/:uid/details -> JSON
        const m1d = pathname.match(/^\/interaction\/([^/]+)\/details$/);
        if (req.method === 'GET' && m1d) {
            (async () => {
                try {
                    const details = await provider.interactionDetails(req, res);
                    const params = details.params || {};
                    const session = details.session || null;

                    // <-- ПАТЧ: если клиент запросил prompt=signup, а сессии нет,
                    //           отдаём фронту signup вместо login (без interactionFinished)
                    let prompt = details.prompt;
                    const wantsSignup = typeof params.prompt === 'string' &&
                        params.prompt.split(/\s+/).includes('signup');
                    const hasLoginSession = Boolean(session && session.accountId);

                    if (prompt?.name === 'login' && wantsSignup && !hasLoginSession) {
                        prompt = { ...prompt, name: 'signup' };
                    }

                    const out = {
                        uid: details.uid,
                        prompt,        // { name: 'login' | 'signup' | 'consent', ... } (с учётом форса)
                        params,        // client_id, scope, redirect_uri, prompt, ...
                        session,
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

        // (опц.) мягкий переход login -> signup в той же интеракции:
        // const mGo = pathname.match(/^\/interaction\/([^/]+)\/goto-signup$/);
        // if (req.method === 'GET' && mGo) {
        //     (async () => {
        //         try {
        //             await provider.interactionDetails(req, res); // проверка что интеракция живая
        //             const result = { prompt: { name: 'signup' } };
        //             await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
        //         } catch (e) {
        //             res.writeHead(400, { 'content-type': 'application/json' });
        //             res.end(JSON.stringify({ error: 'switch_failed', message: String(e?.message || e) }));
        //         }
        //     })();
        //     return;
        // }

        // ==== POST /interaction/:uid/login — логин
        const m2 = pathname.match(/^\/interaction\/([^/]+)\/login$/);
        if (req.method === 'POST' && m2) {
            (async () => {
                const uidFromPath = m2[1];
                try {
                    console.log('[login] POST', { url: req.url, uidFromPath });

                    const raw = await readBody(req);
                    const ct = (req.headers['content-type'] || '').toLowerCase();
                    const form = ct.includes('application/json')
                        ? (raw ? JSON.parse(raw) : {})
                        : Object.fromEntries(new URLSearchParams(raw));

                    const email = String(form.login || form.email || '').trim().toLowerCase();
                    const password = String(form.password || '').trim();

                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'invalid email' }));
                        return;
                    }
                    if (!email || !password) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'email & password required' }));
                        return;
                    }

                    const { rows } = await pool.query(
                        'SELECT id, password_hash, email_verified, name FROM users WHERE email = $1',
                        [email]
                    );
                    if (!rows[0]) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_credentials' }));
                        return;
                    }

                    if (!(await argon2.verify(rows[0].password_hash, password))) {
                        await new Promise(r => setTimeout(r, 500));
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_credentials' }));
                        return;
                    }

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

        // ==== NEW: POST /interaction/:uid/signup — регистрация
        const m2b = pathname.match(/^\/interaction\/([^/]+)\/signup$/);
        if (req.method === 'POST' && m2b) {
            (async () => {
                try {
                    // Важно: интеракция должна существовать (иначе 400)
                    await provider.interactionDetails(req, res);

                    const raw = await readBody(req);
                    const ct = (req.headers['content-type'] || '').toLowerCase();
                    const form = ct.includes('application/json')
                        ? (raw ? JSON.parse(raw) : {})
                        : Object.fromEntries(new URLSearchParams(raw));

                    const name = (form.name ?? '').toString().trim();
                    const email = (form.email ?? '').toString().trim().toLowerCase();
                    const password = (form.password ?? '').toString();

                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'invalid email' }));
                        return;
                    }
                    if (!password || password.length < 6) {
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'password too short' }));
                        return;
                    }

                    // Проверяем, что пользователя ещё нет
                    const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
                    if (exists.rowCount > 0) {
                        res.writeHead(409, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'conflict', message: 'email already registered' }));
                        return;
                    }

                    const password_hash = await argon2.hash(password);
                    // Создаём пользователя и получаем id
                    const ins = await pool.query(
                        'INSERT INTO users (email, password_hash, name, email_verified) VALUES ($1,$2,$3,$4) RETURNING id',
                        [email, password_hash, name || null, false]
                    );
                    const userId = ins.rows[0].id;

                    // Завершаем интеракцию как успешный логин (sub = новый userId)
                    const result = { login: { accountId: userId } };
                    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
                } catch (e) {
                    console.error('[signup] failed', e);
                    res.writeHead(400, { 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'signup_failed', message: String(e?.message || e) }));
                }
            })();
            return;
        }

        // ==== POST /interaction/:uid/confirm — consent
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
                    await provider.interactionFinished(
                        req, res, { consent: { grantId } }, { mergeWithLastSubmission: true }
                    );
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