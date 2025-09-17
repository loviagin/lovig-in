import { readBody, redirect303, safeClientName } from '../utils.mjs';
import { log } from '../logger.mjs';

// helper: добавить client_id в users.apps
async function addApp(pool, userId, clientId) {
    await pool.query(
        `UPDATE users
         SET apps = ARRAY(SELECT DISTINCT unnest(coalesce(apps,'{}'::text[]) || $2::text[]))
       WHERE id = $1`,
        [userId, [clientId]]
    );
}

// GET /interaction/:uid  -> (A) auto-consent если уже авторизован, иначе редирект на Next
export async function getInteractionLanding(provider, req, res, uid, pool) {
    try {
        const details = await provider.interactionDetails(req, res);
        const { prompt, session, params, grantId } = details;
        const accountId = session?.accountId;
        const clientId = params?.client_id || '';

        // если нужен consent и пользователь уже авторизовывался в этом клиенте — авто-выдаём consent
        if (prompt?.name === 'consent' && accountId && clientId) {
            // проверим users.apps
            const u = await pool.query('SELECT apps FROM users WHERE id = $1', [accountId]);
            const apps = (u.rows[0]?.apps || []);
            const alreadyAuthorized = apps.includes(clientId);

            if (alreadyAuthorized) {
                // выдаём/расширяем грант на запрошенные scope
                let grant;
                if (grantId) {
                    grant = await provider.Grant.find(grantId);
                } else {
                    grant = new provider.Grant({ accountId, clientId });
                }
                const scope = typeof params.scope === 'string' ? params.scope : '';
                if (scope) grant.addOIDCScope(scope);
                const savedGrantId = await grant.save();

                // запишем клиента в users.apps (на всякий случай, если вдруг его ещё не было)
                await addApp(pool, accountId, clientId);

                // завершаем интеракцию — пользователь улетит на redirect_uri без показа экрана consent
                await provider.interactionFinished(
                    req, res,
                    { consent: { grantId: savedGrantId } },
                    { mergeWithLastSubmission: true }
                );
                return; // важно: не продолжать редирект на /int/...
            }
        }

        // дефолт: ведём на /int/[uid] (и добавляем ?screen=signup при необходимости)
        const wantsSignup = details.params?.screen === 'signup';
        const extra = wantsSignup ? '?screen=signup' : '';
        res.writeHead(302, { Location: `/int/${details.uid}${extra}` });
        res.end();
    } catch {
        res.writeHead(302, { Location: `/int/${uid}` });
        res.end();
    }
}

// GET /interaction/:uid/details -> JSON
export async function getInteractionDetails(provider, req, res) {
    try {
        const details = await provider.interactionDetails(req, res);
        const params = details.params || {};
        const session = details.session || null;

        let prompt = details.prompt;
        const wantsSignup = params.screen === 'signup';
        const hasLoginSession = Boolean(session?.accountId);
        if (prompt?.name === 'login' && wantsSignup && !hasLoginSession) {
            prompt = { ...prompt, name: 'signup' };
        }

        const clientName = await safeClientName(provider, params.client_id);

        const out = { uid: details.uid, prompt, params, session, clientName };
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        res.end(JSON.stringify(out));
    } catch (e) {
        log.error('[details] failed', e);
        // отправим на общую error-страницу
        res.writeHead(302, { Location: `/int/error?code=interaction_fetch_failed&message=${encodeURIComponent(String(e?.message || e))}` });
        res.end();
    }
}

// POST /interaction/:uid/login
export async function postLogin(provider, pool, req, res, uid) {
    try {
        log.info('[login] POST', { url: req.url, uid });
        const raw = await readBody(req);
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const form = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));

        const email = String(form.login || form.email || '').trim().toLowerCase();
        const password = String(form.password || '').trim();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return redirect303(res, `/int/${uid}?screen=login&err=invalid_email`);
        if (!email || !password) return redirect303(res, `/int/${uid}?screen=login&err=missing_fields`);

        const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
        if (!rows[0]) return redirect303(res, `/int/${uid}?screen=login&err=invalid_credentials`);

        const argon2 = await import('argon2');
        if (!(await argon2.default.verify(rows[0].password_hash, password))) {
            await new Promise(r => setTimeout(r, 400));
            return redirect303(res, `/int/${uid}?screen=login&err=invalid_credentials`);
        }

        const result = { login: { accountId: rows[0].id } };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
        log.info('[login] finished ok', { uid, accountId: rows[0].id });
    } catch (e) {
        log.error('[login] failed', e);
        return redirect303(res, `/int/${uid}?screen=login&err=login_failed`);
    }
}

// POST /interaction/:uid/signup
export async function postSignup(provider, pool, req, res, uid) {
    try {
        await provider.interactionDetails(req, res); // проверим, что интеракция жива

        const raw = await readBody(req);
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const form = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));

        const name = (form.name ?? '').toString().trim();
        const email = (form.email ?? '').toString().trim().toLowerCase();
        const password = (form.password ?? '').toString();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return redirect303(res, `/int/${uid}?screen=signup&err=invalid_email`);
        }
        if (!password || password.length < 6) {
            return redirect303(res, `/int/${uid}?screen=signup&err=weak_password`);
        }

        const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (exists.rowCount > 0) {
            return redirect303(res, `/int/${uid}?screen=signup&err=email_exists`);
        }

        const { default: argon2 } = await import('argon2');
        const password_hash = await argon2.hash(password);
        const ins = await pool.query(
            `INSERT INTO users (email, password_hash, name, email_verified, providers)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [email, password_hash, name || null, false, ['email']]
        );
        const userId = ins.rows[0].id;

        const result = { login: { accountId: userId } };
        await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
    } catch (e) {
        log.error('[signup] failed', e);
        return redirect303(res, `/int/${uid}?screen=signup&err=signup_failed`);
    }
}

// POST /interaction/:uid/confirm — ручной consent: после сохранения гранта записываем client_id в users.apps
export async function postConfirm(provider, req, res, pool) {
    try {
        const details = await provider.interactionDetails(req, res);
        const { params, session } = details;

        let grant;
        if (details.grantId) {
            grant = await provider.Grant.find(details.grantId);
        } else {
            grant = new provider.Grant({ accountId: session.accountId, clientId: params.client_id });
        }
        if (typeof params.scope === 'string' && params.scope) {
            grant.addOIDCScope(params.scope);
        }
        const grantId = await grant.save();

        // ✨ записываем клиент в users.apps
        if (session?.accountId && params?.client_id) {
            await addApp(pool, session.accountId, params.client_id);
        }

        await provider.interactionFinished(
            req, res, { consent: { grantId } }, { mergeWithLastSubmission: true }
        );
    } catch (e) {
        return redirect303(res, `/int/error?code=consent_failed&message=${encodeURIComponent(String(e?.message || e))}`);
    }
}