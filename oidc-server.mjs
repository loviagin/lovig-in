// oidc-server.mjs 
import 'dotenv/config';
import http from 'node:http';
import Provider from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { parse } from 'node:url';

const ISSUER = process.env.ISSUER_URL; // http://localhost:3000/api/oidc
// const COOKIE_SECRET = process.env.COOKIE_SECRET; // dev-cookie-secret-change-me-very-long-1234567890
if (!ISSUER) throw new Error('ISSUER_URL env is required');
// if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET env is required');

async function main() {
    // 1) Разово генерим приватный ключ (в проде сделаем постоянным)
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });
    const priv = await exportJWK(privateKey);
    Object.assign(priv, { alg: 'ES256', use: 'sig', kid: 'dev-key' });
    if (!priv.d) throw new Error('Expected private JWK with "d"');

    // 2) Мини-конфиг: dev-экраны включены, PKCE пока выключен (для клика мышкой)
    const configuration = {
        pkce: { required: () => false, methods: ['S256'] },
        features: { devInteractions: { enabled: true } },
        clients: [
            {
                client_id: 'demo-web',
                redirect_uris: ['http://localhost:3000/api/oidc/cb'],
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

        return provider.callback()(req, res);
    });

    server.listen(4400, () => {
        console.log('OIDC listening on http://localhost:4000  (issuer =', ISSUER, ')');
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});