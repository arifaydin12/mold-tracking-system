const { loadConfig, assertConfig } = require('./config/env');
const { createApp } = require('./app');
const { getPool, closePool } = require('./db/pool');

/**
 * Connects to the database and starts listening. Returns { server, shutdown }.
 * shutdown() stops accepting connections, lets in-flight requests finish, then closes the SQL pool.
 */
async function start(config = loadConfig()) {
    assertConfig(config);
    await getPool(); // fail fast when the database is unreachable

    const app = createApp(config);
    const server = await new Promise((resolve) => {
        const s = app.listen(config.port, () => resolve(s));
    });

    let closing = null;
    const shutdown = () => {
        if (!closing) {
            closing = new Promise((resolve) => {
                server.close(async () => {
                    await closePool();
                    resolve();
                });
                server.closeIdleConnections?.();
                // keep-alive connections that never become idle must not block the exit forever
                setTimeout(() => server.closeAllConnections?.(), 5000).unref();
            });
        }
        return closing;
    };
    return { app, server, shutdown, config };
}

async function main() {
    const { server, shutdown, config } = await start();
    console.log(`Connected to SQL Server database "${config.db.database}"`);
    console.log(`API listening on http://localhost:${server.address().port}  (docs: /api/docs)`);

    const onSignal = (signal) => {
        console.log(`${signal} received, shutting down...`);
        const timer = setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
        timer.unref();
        shutdown().then(() => {
            console.log('Shutdown complete');
            process.exit(0);
        });
    };
    process.on('SIGINT', () => onSignal('SIGINT'));
    process.on('SIGTERM', () => onSignal('SIGTERM'));
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.message);
        process.exit(1);
    });
}

module.exports = { start };
