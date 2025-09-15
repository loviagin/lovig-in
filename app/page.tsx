export default function Home() {
  const base = 'https://auth.lovig.in';
  const redirect = `${base}/api/oidc/cb`;
  const authorizeUrl =
    `${base}/api/oidc/auth`
    + `?client_id=demo-web`
    + `&redirect_uri=${encodeURIComponent(redirect)}`
    + `&response_type=code`
    + `&scope=${encodeURIComponent('openid profile email')}`
    + `&state=abc`
    + `&nonce=def`;

  return (
    <main style={{ padding: 24 }}>
      <a href={authorizeUrl}>Войти</a>
    </main>
  );
}