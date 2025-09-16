// server/pg-adapter.mjs
export default class PgAdapter {
    constructor(name, pool) {
        this.name = name;      // "Session", "AccessToken", "RefreshToken", ...
        this.pool = pool;
    }

    // upsert(id, payload, expiresIn)
    async upsert(id, payload, expiresIn) {
        const exp = typeof expiresIn === 'number' ? Math.floor(Date.now() / 1000) + expiresIn : null;
        const grantId = payload.grantId ?? null;
        const userCode = payload.userCode ?? null;
        const uid = payload.uid ?? null;

        await this.pool.query(
            `INSERT INTO oidc (id, kind, payload, "grantId", "userCode", uid, exp, consumed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)
         ON CONFLICT (id) DO UPDATE
           SET kind = EXCLUDED.kind,
               payload = EXCLUDED.payload,
               "grantId" = EXCLUDED."grantId",
               "userCode" = EXCLUDED."userCode",
               uid = EXCLUDED.uid,
               exp = EXCLUDED.exp`,
            [id, this.name, payload, grantId, userCode, uid, exp]
        );
    }

    // find(id)
    async find(id) {
        const { rows } = await this.pool.query(
            'SELECT payload, consumed FROM oidc WHERE id = $1 AND kind = $2',
            [id, this.name]
        );
        if (!rows[0]) return undefined;
        const obj = rows[0].payload;
        if (rows[0].consumed) obj.consumed = rows[0].consumed;
        return obj;
    }

    // findByUserCode(userCode) — для DeviceCode
    async findByUserCode(userCode) {
        const { rows } = await this.pool.query(
            'SELECT payload FROM oidc WHERE "userCode" = $1 AND kind = $2',
            [userCode, this.name]
        );
        return rows[0]?.payload;
    }

    // findByUid(uid) — для Interaction
    async findByUid(uid) {
        const { rows } = await this.pool.query(
            'SELECT payload FROM oidc WHERE uid = $1 AND kind = $2',
            [uid, this.name]
        );
        return rows[0]?.payload;
    }

    // destroy(id)
    async destroy(id) {
        await this.pool.query('DELETE FROM oidc WHERE id = $1 AND kind = $2', [id, this.name]);
    }

    // revokeByGrantId(grantId) — когда юзер отзывает доступ/логаут клиента
    async revokeByGrantId(grantId) {
        await this.pool.query('DELETE FROM oidc WHERE "grantId" = $1', [grantId]);
    }

    // consume(id) — пометить как использованный (напр., одноразовые коды)
    async consume(id) {
        await this.pool.query(
            'UPDATE oidc SET consumed = $1 WHERE id = $2 AND kind = $3',
            [Math.floor(Date.now() / 1000), id, this.name]
        );
    }
}