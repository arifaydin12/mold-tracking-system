// Creates the database (if missing) and applies database/schema.sql.
// Usage: npm run db:init            idempotent, keeps existing data
//        npm run db:reset           drops every table first (development only)
const { initDatabase } = require('../src/db/init');
const { loadConfig } = require('../src/config/env');

const reset = process.argv.includes('--reset');
const config = loadConfig();

if (reset && config.isProduction) {
    console.error('Refusing to reset a database when NODE_ENV=production.');
    process.exit(1);
}

initDatabase({ reset })
    .then((name) => console.log(`Database "${name}" is ready${reset ? ' (tables were dropped and recreated)' : ''}.`))
    .catch((err) => {
        console.error(`db:init failed: ${err.message}`);
        process.exit(1);
    });
