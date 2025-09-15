// oidc-server.mjs 
import 'dotenv/config';
import http from 'node:http';
import Provider from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { parse } from 'node:url';

const ISSUER = process.env.ISSUER_URL; // http://localhost:3300/api/oidc
const COOKIE_SECRET = process.env.COOKIE_SECRET; // dev-cookie-secret-change-me-very-long-1234567890
if (!ISSUER) throw new Error('ISSUER_URL env is required');
if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET env is required');

async function main() {
    // 1) Разово генерим приватный ключ (в проде сделаем постоянным)
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const priv = await exportJWK(privateKey);
    Object.assign(priv, { alg: 'ES256', use: 'sig', kid: 'dev-key' });
    if (!priv.d) throw new Error('Expected private JWK with "d"');

    // 2) Мини-конфиг: dev-экраны включены, PKCE пока выключен (для клика мышкой)
    const configuration = {
        pkce: { required: () => false, methods: ['S256'] },
        features: { devInteractions: { enabled: false } },
        cookies: {
            names: {
                interaction: 'oidc:interaction',
                session: 'oidc:session',
            },
            keys: [COOKIE_SECRET], // подпись
            // cookie должны быть видны как для /api/oidc/*, так и для /interaction/*
            short: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
            long: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
        },
        interactions: {
            url(ctx, interaction) {
                return `/int/${interaction.uid}`;
            },
        },
        ttl: {
            Session: 60,      // 10 минут (подбери под себя)
            Interaction: 60,   // 5 минут
        },
        clients: [
            {
                client_id: 'demo-web',
                redirect_uris: ['https://auth.lovig.in/api/oidc/cb'],
                post_logout_redirect_uris: ['https://auth.lovig.in'],
                response_types: ['code'],
                grant_types: ['authorization_code', 'refresh_token'],
                token_endpoint_auth_method: 'none',
                id_token_signed_response_alg: 'ES256',
            },
        ],
        // ВАЖНО: сюда кладём ПРИВАТНЫЙ ключ
        jwks: { keys: [priv] },
    };

    const provider = new Provider(ISSUER, configuration);
    provider.proxy = true;

    // 3) HTTP: перехватываем только /cb, остальное — в provider.callback()
    const server = http.createServer(async (req, res) => {
        const { pathname, query } = parse(req.url, true);

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

        async function parseBody(req) {
            return await new Promise((resolve, reject) => {
                let data = '';
                req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
                req.on('end', () => {
                    const ct = (req.headers['content-type'] || '').toLowerCase();
                    try {
                        if (ct.includes('application/json')) {
                            resolve(data ? JSON.parse(data) : {});
                        } else {
                            resolve(Object.fromEntries(new URLSearchParams(data)));
                        }
                    } catch (e) { reject(e); }
                });
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
                    let loginField = '';
                    if (ct.includes('application/json')) {
                        const json = raw ? JSON.parse(raw) : {};
                        loginField = String(json.login || json.email || json.username || '').trim();
                    } else {
                        const p = new URLSearchParams(raw);
                        loginField = String(p.get('login') || p.get('email') || p.get('username') || '').trim();
                    }

                    if (!loginField) {
                        console.warn('[login] missing login field');
                        res.writeHead(400, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'invalid_request', message: 'login is required' }));
                        return;
                    }

                    // тут позже будет реальная проверка пароля/БД
                    const result = {
                        login: {
                            accountId: loginField, // это станет sub
                            // remember: true,
                        },
                    };

                    // ВАЖНО: здесь НЕ зовём interactionDetails, прямо завершаем интеракцию.
                    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
                    // 302 вернётся автоматом, дальше код не выполняется.
                    console.log('[login] finished ok', { uidFromPath, accountId: loginField });
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
                    const { prompt, params, session } = await provider.interactionDetails(req, res);

                    // формируем/достаём grant
                    let grant;
                    if (session?.grantId) {
                        grant = await provider.Grant.find(session.grantId);
                    } else {
                        grant = new provider.Grant({
                            accountId: session?.accountId,
                            clientId: params.client_id,
                        });
                    }

                    // простейший вариант: разрешаем всё, что запросил клиент
                    if (typeof params.scope === 'string' && params.scope.length) {
                        grant.addOIDCScope(params.scope); // e.g. 'openid profile email'
                    }

                    const grantId = await grant.save();
                    const result = { consent: { grantId } };

                    await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
                    // 302 назад в /auth → /cb
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
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});