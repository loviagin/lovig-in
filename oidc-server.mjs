import http from 'node:http';
import { parse } from 'node:url';
import Provider from 'oidc-provider';
import { Pool } from 'pg';

import { ISSUER, DATABASE_URL } from './server/env.mjs';
import buildConfiguration from './server/config.mjs';
import { log } from './server/logger.mjs';
import {
    getInteractionLanding,
    getInteractionDetails,
    postLogin,
    postSignup,
    postConfirm,
} from './server/routes/interactions.mjs';
import { googleStart, googleCallback } from './server/routes/google.mjs';
import { postForgot, postReset, getInspect } from './server/routes/password.mjs';
import { appleStart, appleCallback } from './server/routes/apple.mjs';

async function main() {
    const pool = new Pool({ connectionString: DATABASE_URL });
    const configuration = buildConfiguration({ pool });

    const provider = new Provider(ISSUER, configuration);

    // события
    provider.on('authorization.error', (ctx, err) => {
        log.error('[authorization.error]', err?.message, {
            client_id: ctx.oidc?.params?.client_id,
            redirect_uri: ctx.oidc?.params?.redirect_uri,
            scope: ctx.oidc?.params?.scope,
            response_type: ctx.oidc?.params?.response_type,
        });
    });
    provider.on('server_error', (_ctx, err) => log.error('[server_error]', err?.stack || err));

    provider.proxy = true;

    const server = http.createServer(async (req, res) => {
        const { pathname, query } = parse(req.url, true);

        // healthz
        if (pathname === '/healthz') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }

        // demo callback
        if (pathname === '/cb') {
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Callback OK
code=${query.code}
state=${query.state}
`);
            return;
        }

        // interactions
        let m;
        if (req.method === 'GET' && (m = pathname.match(/^\/interaction\/([^/]+)$/))) {
            return await getInteractionLanding(provider, req, res, m[1], pool);
        }
        if (req.method === 'GET' && (m = pathname.match(/^\/interaction\/([^/]+)\/details$/))) {
            return await getInteractionDetails(provider, req, res);
        }
        if (req.method === 'POST' && (m = pathname.match(/^\/interaction\/([^/]+)\/login$/))) {
            return await postLogin(provider, pool, req, res, m[1]);
        }
        if (req.method === 'POST' && (m = pathname.match(/^\/interaction\/([^/]+)\/signup$/))) {
            return await postSignup(provider, pool, req, res, m[1]);
        }
        if (req.method === 'POST' && (m = pathname.match(/^\/interaction\/([^/]+)\/confirm$/))) {
            return await postConfirm(provider, req, res, pool);
        }
        if (req.method === 'GET' && (m = pathname.match(/^\/interaction\/([^/]+)\/google\/start$/))) {
            return await googleStart(provider, req, res, m[1]);
        }
        if (req.method === 'GET' && pathname === '/interaction/google/cb') {
            return await googleCallback(provider, pool, req, res, query);
        }
        if (req.method === 'GET' && (pathname === '/password/inspect' || pathname === '/api/oidc/password/inspect')) {
            return await getInspect(pool, req, res, query);
        }
        if (req.method === 'POST' && (pathname === '/password/forgot' || pathname === '/api/oidc/password/forgot')) {
            return await postForgot(pool, req, res);
        }
        if (req.method === 'POST' && (pathname === '/password/reset' || pathname === '/api/oidc/password/reset')) {
            return await postReset(pool, req, res);
        }
        // Apple start
        if (req.method === 'GET') {
            const m = pathname.match(/^\/interaction\/([^/]+)\/apple\/start$/);
            if (m) {
                await appleStart(provider, req, res, m[1]);
                return;
            }
        }

        // Apple callback
        if ((req.method === 'POST' || req.method === 'GET') && (
            pathname === '/interaction/apple/cb' ||
            pathname === '/api/oidc/interaction/apple/cb'
        )) {
            console.log('[apple cb] HIT', req.method, pathname);
            await appleCallback(provider, pool, req, res); // сам разберётся POST/GET
            return;
        }

        // всё остальное — в provider
        return provider.callback()(req, res);
    });

    server.listen(4400, () => {
        log.info('OIDC listening on http://localhost:4400', `(issuer = ${ISSUER})`);
    });

    process.on('SIGTERM', async () => {
        log.info('SIGTERM: shutting down OIDC...');
        server.close(() => log.info('HTTP server closed'));
        try { await pool.end(); } catch { }
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        log.info('SIGINT: shutting down OIDC...');
        server.close(() => log.info('HTTP server closed'));
        try { await pool.end(); } catch { }
        process.exit(0);
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});