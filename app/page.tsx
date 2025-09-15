const base = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
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
            <td>authorizeUrl</td>
            <td><a href={authorizeUrl}>Войти</a></td>
          </tr>
          <tr>
            <td>logoutUrl</td>
            <td><a href={logoutUrl}>Выйти</a></td>
          </tr>
        </tbody>
      </table>      
    </main>
  );
}