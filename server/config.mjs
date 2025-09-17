import fs from 'node:fs';
import PgAdapter from './pg-adapter.mjs';
import { COOKIE_SECRET, RESERVE_ROTATION_KEY, JWKS_LOCATION, ISSUER } from './env.mjs';
import clients from './oidc-clients.js';

export default function buildConfiguration({ pool }) {
    const jwks = JSON.parse(fs.readFileSync(JWKS_LOCATION, 'utf8'));

    return {
        pkce: { required: () => true, methods: ['S256'] },
        rotateRefreshToken: true,
        features: {
            devInteractions: { enabled: false },
            rpInitiatedLogout: { enabled: true },
            revocation: { enabled: true },
        },
        cookies: {
            names: { interaction: 'oidc:interaction', session: 'oidc:session' },
            keys: [COOKIE_SECRET, RESERVE_ROTATION_KEY],
            short: { secure: true, sameSite: 'lax', domain: new URL(ISSUER).host.split(':')[0], path: '/' },
            long: { secure: true, sameSite: 'lax', domain: new URL(ISSUER).host.split(':')[0], path: '/' },
        },
        interactions: {
            url(ctx, i) {
                const wantsSignup = ctx.oidc?.params?.screen === 'signup';
                return `/interaction/${i.uid}${wantsSignup ? '?screen=signup' : ''}`;
            },
        },
        ttl: {
            AccessToken: 60 * 60,
            IdToken: 60 * 10,
            Session: 60 * 60 * 24 * 7,
            RefreshToken: 60 * 60 * 24 * 30,
            Grant: 60 * 60 * 24 * 7,
            Interaction: 60 * 15,
        },
        clients,
        claims: {
            openid: ['sub'],
            email: ['email', 'email_verified'],
            profile: ['name'],
        },
        findAccount: async (_ctx, sub) => ({
            accountId: sub,
            claims: async (_use, scope, _claims, _rejected) => {
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
        }),
        adapter: class extends PgAdapter {
            constructor(name) { super(name, pool); }
        },
        renderError(ctx, out, err) {
            const code = err?.error || err?.name || 'server_error';
            const msg = err?.error_description || err?.message || '';
            const state = ctx.oidc?.params?.state || '';
            const clientId = ctx.oidc?.params?.client_id || '';

            const to = `/int/error?code=${encodeURIComponent(code)}`
                + `&message=${encodeURIComponent(msg)}`
                + `&state=${encodeURIComponent(state)}`
                + `&client_id=${encodeURIComponent(clientId)}`;

            ctx.status = 302;
            ctx.redirect(to);
        },
        jwks,
    };
}