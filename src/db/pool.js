const sql = require('mssql');
const { loadConfig } = require('../config/env');

let pool = null;
let connecting = null;

/** Lazily creates one shared connection pool. */
async function getPool() {
    if (pool && pool.connected) return pool;
    if (connecting) return connecting;

    const { db } = loadConfig();
    const next = new sql.ConnectionPool({
        server: db.server,
        port: db.port,
        database: db.database,
        user: db.user,
        password: db.password,
        options: db.options,
        pool: db.pool,
    });
    next.on('error', (err) => console.error('SQL pool error:', err.message));

    connecting = next
        .connect()
        .then((p) => {
            pool = p;
            return p;
        })
        .finally(() => {
            connecting = null;
        });
    return connecting;
}

async function closePool() {
    if (pool) {
        const p = pool;
        pool = null;
        await p.close().catch(() => {});
    }
}

/**
 * Runs a parameterised query.
 * params: { name: value } or { name: [sqlType, value] } when the type must be explicit.
 */
async function query(text, params = {}, executor) {
    const request = (executor || (await getPool())).request();
    for (const [name, spec] of Object.entries(params)) {
        if (Array.isArray(spec)) request.input(name, spec[0], spec[1]);
        else request.input(name, spec);
    }
    const result = await request.query(text);
    return result;
}

/** Runs fn(tx) inside a transaction; commits on success and rolls back on error. */
async function withTransaction(fn) {
    const tx = new sql.Transaction(await getPool());
    await tx.begin();
    try {
        const out = await fn(tx);
        await tx.commit();
        return out;
    } catch (err) {
        try {
            await tx.rollback();
        } catch (_) {
            /* already rolled back */
        }
        throw err;
    }
}

module.exports = { sql, getPool, closePool, query, withTransaction };
