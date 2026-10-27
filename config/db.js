const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

let pool = null;

const connectDB = async () => {
    try {
        pool = await sql.connect(config);
        console.log('✅ SQL Server\'e bağlandı!');
        return pool;
    } catch (err) {
        console.error('❌ Bağlantı hatası:', err);
        process.exit(1);
    }
};

const getPool = () => pool;

module.exports = { connectDB, getPool, sql };
