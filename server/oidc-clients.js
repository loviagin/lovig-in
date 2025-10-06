export default [
    {
        client_id: 'demo-web',
        client_name: 'Demo Web',
        redirect_uris: ['https://auth.lovig.in/api/oidc/cb'], // в dev
        post_logout_redirect_uris: ['https://auth.lovig.in'],
        response_types: ['code'],
        grant_types: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_method: 'none',
        id_token_signed_response_alg: 'ES256',
    },
    {
        client_id: 'learnsy-ios',
        client_name: 'Skillify iOS App',
        application_type: 'native',
        redirect_uris: ['com.lovigin.ios.Skillify://oidc'],
        post_logout_redirect_uris: ['https://auth.lovig.in'],
        token_endpoint_auth_method: 'none',
        response_types: ['code'],
        grant_types: ['authorization_code', 'refresh_token'],
        id_token_signed_response_alg: 'ES256',
        access_token_format: 'jwt',
    },
];