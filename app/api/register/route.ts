// import { NextRequest, NextResponse } from 'next/server';
// import { Pool } from 'pg';
// import argon2 from 'argon2';

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   // ssl: { rejectUnauthorized: false }, // раскомментируй, если нужен TLS без CA
// });

// export async function POST(req: NextRequest) {
//   // 1) Проверим Content-Type
//   const ct = req.headers.get('content-type') || '';
//   if (!ct.includes('application/json')) {
//     return NextResponse.json(
//       { error: 'unsupported_media_type', hint: 'Use Content-Type: application/json' },
//       { status: 415 },
//     );
//   }

//   // 2) Прочтём тело
//   const body = (await req.json()) as {
//     email?: string;
//     password?: string;
//     name?: string;
//   };

//   const email = (body.email ?? '').toLowerCase().trim();
//   const password = (body.password ?? '').trim();
//   const name = (body.name ?? '').trim() || null;

//   if (!email || !password) {
//     return NextResponse.json({ error: 'missing_fields', fields: ['email', 'password'] }, { status: 400 });
//   }

//   // 3) Хэш пароля
//   const hash = await argon2.hash(password, { type: argon2.argon2id });

//   // 4) Запись в БД
//   try {
//     const client = await pool.connect();
//     try {
//       await client.query(
//         `INSERT INTO users (email, password_hash, name)
//          VALUES ($1, $2, $3)
//          ON CONFLICT (email) DO NOTHING`,
//         [email, hash, name],
//       );
//     } finally {
//       client.release();
//     }
//     return NextResponse.json({ ok: true });
//   } catch {
//     // не используем переменную ошибки → линтер доволен
//     return NextResponse.json({ error: 'db_error' }, { status: 500 });
//   }
// }