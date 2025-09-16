import 'dotenv/config';

export const ISSUER = process.env.ISSUER_URL; // например: https://auth.lovig.in/api/oidc
export const COOKIE_SECRET = process.env.COOKIE_SECRET;
export const RESERVE_ROTATION_KEY = process.env.RESERVE_ROTATION_KEY;
export const JWKS_LOCATION = process.env.JWKS_LOCATION;
export const DATABASE_URL = process.env.DATABASE_URL;

for (const [k, v] of Object.entries({
  ISSUER, COOKIE_SECRET, RESERVE_ROTATION_KEY, JWKS_LOCATION, DATABASE_URL,
})) {
  if (!v) throw new Error(`${k} env is required`);
}