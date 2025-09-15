import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // локально не нужен TLS
});

try {
  const c = await pool.connect();
  const r = await c.query('select now() as now');
  console.log('OK:', r.rows[0]);
  c.release();
  process.exit(0);
} catch (e) {
  console.error('DB ERROR:', e.code, e.message);
  console.error(e.stack);
  process.exit(1);
}
