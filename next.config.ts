// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // OIDC core эндпоинты: /.well-known, /auth, /token, /jwks, /me, /session/end и т.д.
      { source: '/api/oidc/:path*', destination: 'http://localhost:4000/:path*' },

      // Dev interactions экран (и вообще interaction flow)
      { source: '/interaction/:path*', destination: 'http://localhost:4000/interaction/:path*' },

      // Промежуточные шаги авторизации (oidc-provider редиректит на /auth/:uid)
      { source: '/auth/:path*', destination: 'http://localhost:4000/auth/:path*' },
    ];
  },
};

export default nextConfig;