const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3300';
const authorizeUrl =
  `${base}/api/oidc/auth`
  + `?client_id=demo-web`
  + `&redirect_uri=${encodeURIComponent(`${base}/api/oidc/cb`)}`
  + `&response_type=code`
  + `&scope=${encodeURIComponent('openid profile email')}`
  + `&state=abc`
  + `&nonce=def`;

const logoutUrl = `${base}/api/oidc/session/end?post_logout_redirect_uri=${encodeURIComponent(base)}`;

export default function Home() {
  return (
    <main>
      <table>
        <tbody>
          <tr>
            <td><a href={authorizeUrl}>Войти</a></td>
            <td><a href="/register">Регистрация</a></td>
            <td><a href={logoutUrl}>Выйти</a></td>
          </tr>
        </tbody>
      </table>      
    </main>
  );
}