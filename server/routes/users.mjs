import { log } from '../logger.mjs';
import { readBody } from '../utils.mjs';

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

// POST /api/users/create - создать пользователя вручную
export async function createUser(pool, req, res) {
    try {
        log.info('[createUser] POST /api/users/create');
        
        const raw = await readBody(req);
        const ct = (req.headers['content-type'] || '').toLowerCase();
        const body = ct.includes('application/json')
            ? (raw ? JSON.parse(raw) : {})
            : Object.fromEntries(new URLSearchParams(raw));

        const {
            name,
            email,
            password,
            emailVerified = false,
            providers = ['email'],
            apps = []
        } = body;

        // Валидация обязательных полей
        if (!email || !password) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Email and password are required' }));
            return;
        }

        // Проверка email формата
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid email format' }));
            return;
        }

        // Проверка, что пользователь не существует
        const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
        if (existing.rowCount > 0) {
            res.writeHead(409, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'User with this email already exists' }));
            return;
        }

        // Хешируем пароль
        const { default: argon2 } = await import('argon2');
        const passwordHash = await argon2.hash(password);

        // Создаем пользователя
        const { rows } = await pool.query(`
            INSERT INTO users (name, email, password_hash, email_verified, providers, apps)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, name, email, password_hash, email_verified, providers, created_at, updated_at, apps
        `, [name || null, email, passwordHash, emailVerified, providers, apps]);

        const user = rows[0];
        const response = {
            id: user.id,
            name: user.name,
            email: user.email,
            passwordHash: user.password_hash,
            emailVerified: user.email_verified,
            providers: user.providers,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            apps: user.apps || []
        };

        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ user: response }));
        
    } catch (e) {
        log.error('[createUser] failed', e);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to create user' }));
    }
}

// DELETE /api/users/:id - удалить пользователя по ID
export async function deleteUser(pool, req, res, userId) {
    try {
        log.info('[deleteUser] DELETE /api/users/' + userId);
        
        // Проверяем, что пользователь существует
        const { rows } = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) {
            res.writeHead(404, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: 'User not found' }));
            return;
        }

        const user = rows[0];
        
        // Удаляем пользователя
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
        
        log.info('[deleteUser] User deleted successfully', { userId, email: user.email });
        
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'User deleted successfully',
            deletedUser: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        }));
        
    } catch (e) {
        log.error('[deleteUser] failed', e);
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to delete user' }));
    }
}
