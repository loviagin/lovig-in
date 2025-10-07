import { log } from '../logger.mjs';

// GET /api/users/all - получить всех зарегистрированных пользователей
export async function getAllUsers(pool, req, res) {
    try {
        log.info('[getAllUsers] GET /api/users/all');
        
        const { rows } = await pool.query(`
            SELECT * FROM users 
            ORDER BY created_at DESC
        `);
        
        // Возвращаем все поля из БД
        const users = rows.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.password_hash,
            emailVerified: user.email_verified,
            providers: user.providers,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            apps: user.apps || []
        }));
        
        res.writeHead(200, { 
            'content-type': 'application/json',
            'cache-control': 'no-store'
        });
        res.end(JSON.stringify({ users }));
        
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
