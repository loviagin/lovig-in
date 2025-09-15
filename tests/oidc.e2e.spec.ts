// tests/oidc.e2e.spec.ts
import { test, expect } from '@playwright/test';

test.setTimeout(180_000);

test('OIDC authorization_code flow works', async ({ page, request, baseURL }) => {
  const redirectUri = `${baseURL}/api/oidc/cb`;
  const authorizeUrl =
    `${baseURL}/api/oidc/auth`
    + `?client_id=demo-web`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent('openid profile email')}`
    + `&state=abc`
    + `&nonce=def`;

  // 1) Стартуем авторизацию
  await page.goto(authorizeUrl);

  // 2) Шаг Sign-in (две строки ввода + кнопка "Sign-in")
  // ждём страницу интеракции
  await page.waitForURL(/\/interaction\/.+/, { timeout: 30_000 });

  // найдём поля (placeholders из твоего скрина)
  const loginInput = page.locator('input[placeholder="Enter any login"], input[type="email"], input[type="text"]').first();
  const passInput  = page.locator('input[placeholder="and password"], input[type="password"]').first();

  // заполняем, если есть (в некоторых билдах может быть только одно поле)
  if (await loginInput.count()) {
    await loginInput.fill('playwright@example.com');
  }
  if (await passInput.count()) {
    await passInput.fill('anything');
  }

  // нажимаем кнопку Sign-in (или fallback — первую кнопку)
  const signInBtn = page.getByRole('button', { name: /sign-?in/i }).first();
  if (await signInBtn.count()) {
    await signInBtn.click();
  } else {
    await page.locator('button').first().click();
  }

  // 3) Шаг Authorize → Continue
  // после sign-in может быть редирект на /auth/:uid или второй /interaction/*
  await page.waitForURL(/\/(auth|interaction)\/.+/, { timeout: 30_000 });
  const continueBtn = page.getByRole('button', { name: /continue|authorize|submit|разрешить|продолжить/i }).first();
  if (await continueBtn.count()) {
    await continueBtn.click();
  } else {
    await page.locator('button').first().click();
  }

  // 4) Ждём коллбек с ?code=...
  await page.waitForURL(/\/api\/oidc\/cb\?code=.+/, { timeout: 30_000 });
  const url = new URL(page.url());
  const code = url.searchParams.get('code');
  expect(code).toBeTruthy();

  // 5) Обмениваем code на токены
  const tokenResp = await request.post(`${baseURL}/api/oidc/token`, {
    form: {
      grant_type: 'authorization_code',
      client_id: 'demo-web',
      redirect_uri: redirectUri,
      code: code!,
    },
  });
  expect(tokenResp.ok()).toBeTruthy();
  const tokens = await tokenResp.json();
  expect(tokens).toHaveProperty('access_token');
  expect(tokens).toHaveProperty('id_token');

  // 6) Проверяем /me
  const meResp = await request.get(`${baseURL}/api/oidc/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  expect(meResp.ok()).toBeTruthy();
  const me = await meResp.json();
  expect(me).toHaveProperty('sub');
});