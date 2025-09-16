export function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

export function redirect303(res, location) {
    res.writeHead(303, { Location: location });
    res.end();
}

export async function safeClientName(provider, clientId, fallback = clientId) {
    try {
        const client = await provider.Client.find(clientId);
        const name = client?.clientName || client?.metadata?.client_name;
        return (typeof name === 'string' && name.trim()) ? name.trim() : fallback;
    } catch {
        return fallback;
    }
}