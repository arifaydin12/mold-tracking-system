const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, closePool } = require('./helpers');
const { start } = require('../src/server');
const { query } = require('../src/db/pool');

describe('server lifecycle', () => {
    let config;
    before(async () => {
        ({ config } = await setup());
    });
    after(closePool);

    it('starts, serves requests and shuts down gracefully', async () => {
        const handle = await start({ ...config, port: 0 });
        const port = handle.server.address().port;

        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        assert.equal(res.status, 200);
        assert.equal((await res.json()).database, 'up');

        await handle.shutdown();
        await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`), /fetch failed/);
        assert.equal(handle.server.listening, false);

        // the pool is closed on shutdown but is re-created lazily on the next query
        const again = await query('SELECT 1 AS ok');
        assert.equal(again.recordset[0].ok, 1);
    });

    it('lets an in-flight request finish after shutdown begins', async () => {
        const handle = await start({ ...config, port: 0 });
        const port = handle.server.address().port;
        let closing;
        // begin the shutdown while this very request is being handled
        handle.server.once('request', () => {
            closing = handle.shutdown();
        });
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Connection: 'close' } });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).status, 'ok');
        await closing;
        assert.equal(handle.server.listening, false);
    });

    it('refuses to start without a JWT secret', async () => {
        await assert.rejects(start({ ...config, auth: { ...config.auth, jwtSecret: '' } }), /JWT_SECRET/);
    });
});
