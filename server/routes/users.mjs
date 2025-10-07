import { log } from '../logger.mjs';

// GET /api/users/all - получить всех зарегистрированных пользователей
export async function getAllUsers(pool, req, res) {
    try {
        log.info('[getAllUsers] GET /api/users/all');
        
        const { rows } = await pool.query(`
            SELECT 
                id,
                name,
                email,
                email_verified,
                created_at,
                updated_at,
                apps
            FROM users 
            ORDER BY created_at DESC
        `);
        
        // Убираем чувствительные данные для безопасности
        const safeUsers = rows.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.email_verified,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            apps: user.apps || []
        }));
        
        res.writeHead(200, { 
            'content-type': 'application/json',
            'cache-control': 'no-store'
        });
        res.end(JSON.stringify({ users: safeUsers }));
        
    } catch (e) {
        log.error('[getAllUsers] failed', e);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch users' }));
    }
}

// GET /api/users/count - получить количество зарегистрированных пользователей
export async function getUsersCount(pool, req, res) {
    try {
        log.info('[getUsersCount] GET /api/users/count');
        
        const { rows } = await pool.query('SELECT COUNT(*) as count FROM users');
        const count = parseInt(rows[0].count);
        
        res.writeHead(200, { 
            'content-type': 'application/json',
            'cache-control': 'no-store'
        });
        res.end(JSON.stringify({ count }));
        
    } catch (e) {
        log.error('[getUsersCount] failed', e);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch users count' }));
    }
}
