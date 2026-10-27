// Creates an administrator account with a bcrypt-hashed password.
// Usage: npm run create-admin -- admin "Full Name" "a-strong-password"
require('dotenv').config();

const sql = require('mssql');
const bcrypt = require('bcrypt');

(async () => {
    const [username, fullName, password] = process.argv.slice(2);
    if (!username || !fullName || !password) {
        console.error('Usage: npm run create-admin -- <username> "<Full Name>" "<password>"');
        process.exit(1);
    }
    if (password.length < 8) {
        console.error('Password must be at least 8 characters long.');
        process.exit(1);
    }

    const pool = await sql.connect({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        server: process.env.DB_SERVER,
        database: process.env.DB_NAME,
        options: { encrypt: false, trustServerCertificate: true }
    });

    const hash = await bcrypt.hash(password, 10);
    await pool.request()
        .input('u', sql.NVarChar, username)
        .input('h', sql.NVarChar, hash)
        .input('n', sql.NVarChar, fullName)
        .query("INSERT INTO Kullanicilar (kullaniciAdi, sifre, adSoyad, rol) VALUES (@u, @h, @n, N'admin')");

    console.log(`Admin created: ${username}`);
    await pool.close();
})().catch(err => {
    console.error(err.message);
    process.exit(1);
});
