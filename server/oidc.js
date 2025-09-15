// // server/oidc.js
// import Provider, { interactionPolicy } from 'oidc-provider';

// const ISSUER = 'https://auth.lovig.in';

// const policy = interactionPolicy.base();
// const { Prompt } = interactionPolicy;
// const COOKIE_SECRET = process.env.COOKIE_SECRET;
// const RESERVE_ROTATION_KEY = process.env.RESERVE_ROTATION_KEY;
// if (!COOKIE_SECRET) throw new Error('COOKIE_SECRET env is required');
// if (!JWKS_LOCATION) throw new Error('JWKS_LOCATION env is required');

// const signupPrompt = new Prompt({
//     name: 'signup',
//     requestable: true,
// });

// policy.add(signupPrompt);

// const clients = [
//     {
//         client_id: 'demo-web',
//         redirect_uris: [`${ISSUER}/cb`],
//         post_logout_redirect_uris: ['https://auth.lovig.in'],
//         response_types: ['code'],
//         grant_types: ['authorization_code', 'refresh_token'],
//         token_endpoint_auth_method: 'none',
//         id_token_signed_response_alg: 'ES256',
//     },
//     {
//         client_id: 'demo-ios',
//         application_type: 'native',
//         redirect_uris: ['com.lovigin.ios.Skillify://oidc'],
//         post_logout_redirect_uris: ['https://auth.lovig.in'], // web-URL
//         token_endpoint_auth_method: 'none',
//         response_types: ['code'],
//         grant_types: ['authorization_code', 'refresh_token'],
//         id_token_signed_response_alg: 'ES256',
//     },
// ];

// const configuration = {
//     interactions: {
//         policy,
//         url(ctx, interaction) {
//             return `/interaction/${interaction.uid}`;
//         },
//     },

//     clients,

//     pkce: {
//         required: () => true,
//         methods: ['S256'],
//     },

//     claims: {
//         openid: ['sub'],
//         email: ['email', 'email_verified'],
//         profile: ['name'],
//     },

//     cookies: {
//         names: { interaction: 'oidc:interaction', session: 'oidc:session' },
//         keys: [COOKIE_SECRET, RESERVE_ROTATION_KEY], // на будущее
//         short: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
//         long: { secure: true, sameSite: 'lax', domain: 'auth.lovig.in', path: '/' },
//     },

//     rotateRefreshToken: true,

//     features: {
//         devInteractions: { enabled: false },
//         claimsParameter: { enabled: true },
//         pkce: { required: true },
//         // registration: { enabled: false }, // динамическую регистрацию клиентов не используем
//         revocation: { enabled: true },
//         introspection: { enabled: true },
//         // backchannelLogout/frontchannelLogout — по желанию
//     },
// };

// const provider = new Provider(ISSUER, configuration);
// export default provider;