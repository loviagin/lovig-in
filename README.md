This is a [One Login](https://auth.lovig.in) project developed by [`LOVIGIN LTD`](https://lovigin.com).

## IN DEVELOPING

# LOVIGIN Identity Provider

Собственный Identity Provider по стандартам OAuth 2.1 + OpenID Connect (OIDC) с единой веб-страницей входа/регистрации на домене auth.lovig.in.

## 🚀 Возможности

- **OAuth 2.1 + OpenID Connect** - Полная поддержка стандартов
- **Единая страница входа** - Вход, регистрация, восстановление пароля, 2FA
- **Обязательные OIDC endpoints**:
  - `/.well-known/openid-configuration` - Discovery
  - `/authorize` - Старт авторизации
  - `/token` - Обмен кода на токены
  - `/userinfo` - Профиль пользователя
  - `/jwks.json` - Публичные ключи для верификации JWT
  - `/logout` и `/session/end` - RP-initiated logout
- **Управление токенами**:
  - `id_token` (JWT с информацией о пользователе)
  - `access_token` (доступ к API)
  - `refresh_token` (ротация refresh, короткий TTL access)
- **Дополнительные возможности**:
  - 2FA (TOTP)
  - Социальные входы (Google, GitHub)
  - CSRF защита
  - Rate limiting
  - Email верификация
  - Восстановление пароля

## 🛠 Технологии

- **Backend**: Node.js + Express
- **OIDC Provider**: node-oidc-provider (panva)
- **Database**: PostgreSQL
- **Frontend**: Next.js + React
- **Authentication**: JWT + Sessions
- **2FA**: TOTP (otplib)
- **Email**: Nodemailer

## 📋 Требования

- Node.js 18+
- PostgreSQL 12+
- SMTP сервер для отправки email

## ⚙️ Установка

1. **Клонируйте репозиторий и установите зависимости**:
   ```bash
   npm install
   ```

2. **Настройте переменные окружения**:
   ```bash
   cp env.example .env
   ```
   
   Отредактируйте `.env` файл:
   ```env
   # Database
   DATABASE_URL=postgresql://username:password@localhost:5432/auth_lovigin
   
   # OIDC Provider
   ISSUER=https://auth.lovig.in
   PORT=3000
   
   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   
   # Email
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=noreply@lovig.in
   
   # Session
   SESSION_SECRET=your-super-secret-session-key
   ```

3. **Создайте базу данных**:
   ```bash
   createdb auth_lovigin
   ```

4. **Примените схему базы данных**:
   ```bash
   npm run db:migrate
   ```

5. **Заполните тестовыми данными**:
   ```bash
   npm run db:seed
   ```

## 🚀 Запуск

### Разработка

1. **Запустите OIDC Provider сервер**:
   ```bash
   npm run dev:server
   ```

2. **Запустите Next.js приложение** (в другом терминале):
   ```bash
   npm run dev
   ```

### Продакшн

1. **Соберите приложение**:
   ```bash
   npm run build
   ```

2. **Запустите сервер**:
   ```bash
   npm run server
   ```

## 📖 API Endpoints

### OIDC Endpoints

- `GET /.well-known/openid-configuration` - Discovery document
- `GET /authorize` - Authorization endpoint
- `POST /token` - Token endpoint
- `GET /userinfo` - User info endpoint
- `GET /jwks.json` - JSON Web Key Set
- `GET /logout` - Logout endpoint
- `POST /session/end` - Session end endpoint

### Custom Endpoints

- `POST /auth/register` - Регистрация пользователя
- `POST /auth/login` - Вход пользователя
- `POST /auth/logout` - Выход пользователя
- `POST /auth/forgot-password` - Запрос сброса пароля
- `POST /auth/reset-password` - Сброс пароля
- `GET /auth/verify-email` - Верификация email

### User Management

- `GET /user/profile` - Получить профиль
- `PUT /user/profile` - Обновить профиль
- `POST /user/change-password` - Изменить пароль
- `POST /user/2fa/enable` - Включить 2FA
- `POST /user/2fa/verify` - Верифицировать 2FA
- `POST /user/2fa/disable` - Отключить 2FA
- `DELETE /user/account` - Удалить аккаунт

### Client Management

- `GET /client/clients` - Список клиентов
- `POST /client/clients` - Создать клиента
- `GET /client/clients/:id` - Получить клиента
- `PUT /client/clients/:id` - Обновить клиента
- `DELETE /client/clients/:id` - Удалить клиента

## 🧪 Тестирование

### Тестовые данные

После выполнения `npm run db:seed`:

- **Пользователь**: test@example.com / password123
- **OAuth Client**: test-client-id / test-client-secret

### Тестовый клиент

Создайте тестовое приложение для проверки OIDC:

```javascript
// Пример использования
const authUrl = 'https://auth.lovig.in/authorize?' + new URLSearchParams({
  client_id: 'test-client-id',
  redirect_uri: 'http://localhost:3001/callback',
  response_type: 'code',
  scope: 'openid profile email',
  state: 'random-state-value'
});

// После авторизации получите токены
const tokenResponse = await fetch('https://auth.lovig.in/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'test-client-id',
    client_secret: 'test-client-secret',
    code: authorizationCode,
    redirect_uri: 'http://localhost:3001/callback'
  })
});
```

## 🔒 Безопасность

- **PKCE** - Обязательный для OAuth 2.1
- **CSRF Protection** - Защита от CSRF атак
- **Rate Limiting** - Ограничение запросов
- **Helmet** - Безопасные HTTP заголовки
- **Password Hashing** - bcrypt с солью
- **JWT Signing** - RSA подпись токенов
- **Session Security** - Безопасные cookies

## 📝 Лицензия

© 2024 LOVIGIN LTD. All rights reserved.

## 🤝 Поддержка

Для получения поддержки обращайтесь к [LOVIGIN LTD](https://lovigin.com).
