// Loads realistic demo data (database/seed-data.json) into the configured database.
// Usage: npm run seed              only when the database is empty
//        npm run seed -- --force   wipes all tables first
const { loadConfig } = require('../src/config/env');
const { seedDatabase } = require('../src/db/seed');
const { closePool } = require('../src/db/pool');

const config = loadConfig();
if (config.isProduction && !process.argv.includes('--i-know-this-is-production')) {
    console.error('Refusing to load demo data (with well-known passwords) when NODE_ENV=production.');
    process.exit(1);
}

seedDatabase({ force: process.argv.includes('--force') })
    .then((s) => {
        console.log(
            `Seeded ${s.molds} molds, ${s.trials} trials, ${s.revisions} revisions, ${s.maintenance} maintenance records, ` +
                `${s.suppliers} suppliers, ${s.users} users, ${s.activity} activity entries, ${s.logins} login attempts.`,
        );
        console.log('Demo accounts: admin / engineer / viewer  (password from SEED_PASSWORD, default "Demo-2026")');
    })
    .catch((err) => {
        console.error(`seed failed: ${err.message}`);
        process.exitCode = 1;
    })
    .finally(closePool);
