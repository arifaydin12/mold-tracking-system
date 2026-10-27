// Creates an administrator account with a bcrypt-hashed password.
// Usage: npm run create-admin -- <username> "<Full Name>" "<password>"
const bcrypt = require('bcrypt');
const { loadConfig } = require('../src/config/env');
const { query, closePool } = require('../src/db/pool');
const { schemas } = require('../src/validation/schemas');

(async () => {
    const [username, fullName, password] = process.argv.slice(2);
    if (!username || !fullName || !password) {
        console.error('Usage: npm run create-admin -- <username> "<Full Name>" "<password>"');
        process.exit(1);
    }
    const parsed = schemas.createUser.safeParse({ username, full_name: fullName, password, role: 'admin' });
    if (!parsed.success) {
        for (const issue of parsed.error.issues) console.error(`- ${issue.path.join('.')}: ${issue.message}`);
        process.exit(1);
    }
    const { data } = parsed;
    const hash = await bcrypt.hash(data.password, loadConfig().auth.bcryptRounds);
    await query(
        `INSERT INTO users (username, password_hash, full_name, role) VALUES (@username, @hash, @fullName, N'admin')`,
        { username: data.username, hash, fullName: data.full_name },
    );
    console.log(`Admin created: ${data.username}`);
})()
    .catch((err) => {
        console.error(/uq_users_username/i.test(err.message) ? 'That username already exists.' : err.message);
        process.exitCode = 1;
    })
    .finally(closePool);
