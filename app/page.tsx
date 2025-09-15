const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const authorizeUrl =
  `${base}/api/oidc/auth`
  + `?client_id=demo-web`
  + `&redirect_uri=${encodeURIComponent(`${base}/api/oidc/cb`)}`
  + `&response_type=code`
  + `&scope=${encodeURIComponent('openid profile email')}`
  + `&state=abc`
  + `&nonce=def`;

export default function Home() {
  return (
    <main>
      <a href={authorizeUrl}>Войти</a>
    </main>
  );
}