import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import crypto from 'node:crypto';

function b64url(buf: Buffer) { return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function genPkce() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' as const };
}
function qs(p: Record<string,string>) { return `?${new URLSearchParams(p).toString()}`; }

const AUTH_PATH = '/api/oidc/auth';
const CB_PATH = '/api/oidc/cb';
const CLIENT_ID = 'demo-web';
const REDIRECT_URI = 'http://localhost:3300/api/oidc/cb';

async function waitHealthz(page: Page) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const r = await page.request.get('/api/oidc/healthz').catch(() => null);
    if (r && r.status() === 200) return;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('healthz not ready');
}

async function gotoAuthOnce(page: Page, params: Record<string,string>) {
  await waitHealthz(page);

  page.on('console', (m: ConsoleMessage) => console.log('[browser]', m.type(), m.text()));
  page.on('response', (resp) => { const s = resp.status(); if (s >= 400) console.log('[resp]', s, resp.request().method(), resp.url()); });

  const url = `${AUTH_PATH}${qs(params)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // ждём: либо интеракция, либо колбэк
  await page.waitForURL(/\/(int\/[^/?#]+|api\/oidc\/cb)/, { timeout: 30_000 });

  // если мы на /int/:uid — дождёмся 200 от details перед ассертами
  const m = page.url().match(/\/int\/([^/?#]+)/);
  if (m) {
    await page.waitForResponse(
      (r) => r.url().includes(`/interaction/${m[1]}/details`) && r.status() === 200,
      { timeout: 15_000 }
    ).catch(() => {});
  }
}

async function gotoAuth(page: Page, params: Record<string,string>) {
  try {
    await gotoAuthOnce(page, params);
  } catch (e) {
    console.warn('retrying /auth once after error:', e);
    await new Promise(r => setTimeout(r, 700));
    await gotoAuthOnce(page, params);
  }
}

async function completeConsentIfPresent(page: Page) {
  const heading = page.getByRole('heading', { name: /Authorize/i });
  if (await heading.isVisible({ timeout: 500 })) {
    await page.getByRole('button', { name: /^Continue$/i }).click();
    await page.waitForURL(new RegExp(`${CB_PATH.replace(/\//g,'\\/')}.*code=`), { timeout: 15_000 });
    return true;
  }
  return false;
}

test.describe('OIDC E2E', () => {
    test('1) Chooser рендерится и показывает кнопки email-потоков', async ({ page }) => {
        const state = crypto.randomBytes(8).toString('hex');
        const nonce = crypto.randomBytes(8).toString('hex');
        const { challenge, method } = genPkce();

        await gotoAuth(page, {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'openid profile email offline_access',
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: method,
        });

        // если вдруг grant уже есть и нас унесло в callback — это тоже валидно,
        // но для этого теста проверим UI, поэтому вернёмся назад повторно
        if (page.url().includes(CB_PATH)) {
            // запускаем снова, но форсим показ UI login через prompt=login
            await gotoAuth(page, {
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                response_type: 'code',
                scope: 'openid profile email offline_access',
                state,
                nonce,
                code_challenge: challenge,
                code_challenge_method: method,
                prompt: 'login',
            });
        }

        // если внезапно consent — завершим и упадём (не то, что хотим в этом тесте)
        const consentDone = await completeConsentIfPresent(page);
        expect(consentDone).toBeFalsy();

        await expect(page.getByRole('heading', { name: /Continue( to)?/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Create account with Email/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Sign in with Email/i })).toBeVisible();
    });

    test('2) Ошибка логина появляется сразу на Sign in', async ({ page }) => {
        const state = crypto.randomBytes(8).toString('hex');
        const nonce = crypto.randomBytes(8).toString('hex');
        const { challenge, method } = genPkce();

        await gotoAuth(page, {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'openid profile email offline_access',
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: method,
            // prompt: 'login',  // можно, но не обязательно
        });

        // если сразу consent — завершаем и перезапускаем поток с prompt=login
        if (await completeConsentIfPresent(page)) {
            await gotoAuth(page, {
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                response_type: 'code',
                scope: 'openid profile email offline_access',
                state,
                nonce,
                code_challenge: challenge,
                code_challenge_method: method,
                prompt: 'login',
            });
        }

        // попасть на форму логина: либо через кнопку, либо она уже тут
        const signInBtn = page.getByRole('button', { name: /Sign in with Email/i });
        if (await signInBtn.isVisible({ timeout: 1500 })) {
            await signInBtn.click();
        }

        // теперь должна быть форма
        await expect(page.getByRole('heading', { name: /Sign in/i })).toBeVisible();

        await page.getByPlaceholder(/Your email/i).fill(`nouser_${Date.now()}@example.com`);
        await page.getByPlaceholder(/^Password$/i).fill('wrongpass1!');
        await page.getByRole('button', { name: /^Sign in$/i }).click();

        await page.waitForURL(/screen=login.*err=invalid_credentials/, { timeout: 15000 });
        await expect(page.getByText(/Incorrect email or password/i)).toBeVisible();
    });

    test('3) Ошибка регистрации (invalid email) появляется сразу на Create account', async ({ page }) => {
        const state = crypto.randomBytes(8).toString('hex');
        const nonce = crypto.randomBytes(8).toString('hex');
        const { challenge, method } = genPkce();

        await gotoAuth(page, {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'openid profile email offline_access',
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: method,
        });

        if (await completeConsentIfPresent(page)) {
            // если grant уже был, перезапустим поток без consent
            await gotoAuth(page, {
                client_id: CLIENT_ID,
                redirect_uri: REDIRECT_URI,
                response_type: 'code',
                scope: 'openid profile email offline_access',
                state,
                nonce,
                code_challenge: challenge,
                code_challenge_method: method,
            });
        }

        await page.getByRole('button', { name: /Create account with Email/i }).click();

        await page.getByPlaceholder(/Your name/i).fill('Playwright Bot');
        await page.getByPlaceholder(/Enter email/i).fill('bad-email');
        await page.getByPlaceholder(/Password \(min 6/i).fill('secret1');
        await page.getByRole('button', { name: /^Create account$/i }).click();

        await page.waitForURL(/screen=signup.*err=invalid_email/, { timeout: 15000 });
        await expect(page.getByText(/Incorrect e-mail/i)).toBeVisible();
    });

    test('4) Успешная регистрация → consent → callback OK', async ({ page }) => {
        const state = crypto.randomBytes(8).toString('hex');
        const nonce = crypto.randomBytes(8).toString('hex');
        const { challenge, method } = genPkce();
        const uniqueMail = `e2e_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;

        await gotoAuth(page, {
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: 'openid profile email offline_access',
            state,
            nonce,
            code_challenge: challenge,
            code_challenge_method: method,
        });

        if (await completeConsentIfPresent(page)) {
            // если есть готовый grant (редкий случай для нового ящика), просто проверим callback
            await expect(page).toHaveURL(new RegExp(`${CB_PATH.replace(/\//g, '\\/')}.*code=`));
            await expect(page.locator('body')).toContainText(/Callback OK/i);
            return;
        }

        await page.getByRole('button', { name: /Create account with Email/i }).click();

        await page.getByPlaceholder(/Your name/i).fill('Playwright User');
        await page.getByPlaceholder(/Enter email/i).fill(uniqueMail);
        await page.getByPlaceholder(/Password \(min 6/i).fill('secret12');
        await page.getByRole('button', { name: /^Create account$/i }).click();

        // consent → continue
        await expect(page.getByRole('heading', { name: /Authorize/i })).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: /^Continue$/i }).click();

        await expect(page).toHaveURL(new RegExp(`${CB_PATH.replace(/\//g, '\\/')}.*code=`), { timeout: 15000 });
        await expect(page.locator('body')).toContainText(/Callback OK/i);
        await expect(page.locator('body')).toContainText(/code=/i);
    });
});