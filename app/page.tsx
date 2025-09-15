// app/page.tsx
function buildAuthorizeUrl() {
  const u = new URL('http://localhost:4400/auth'); // сразу на провайдера!
  u.searchParams.set('client_id', 'demo-web');
  u.searchParams.set('redirect_uri', 'http://localhost:3300/api/oidc/cb'); // callback на Next (3300)
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid profile email');
  u.searchParams.set('state', 'abc');
  u.searchParams.set('nonce', 'def');
  return u.toString();
}

export default function Home() {
  const authorizeUrl = buildAuthorizeUrl();
  return (
    <main style={{ padding: 24 }}>
      <a href={authorizeUrl} style={{ color: '#2563eb', textDecoration: 'underline' }}>
        Войти (перейти на /auth провайдера)
      </a>
    </main>
  );
}