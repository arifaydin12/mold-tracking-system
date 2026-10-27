const fs = require('node:fs');
const path = require('node:path');
const sql = require('mssql');
const { loadConfig } = require('../config/env');
const { closePool } = require('./pool');

const SCHEMA_FILE = path.join(__dirname, '..', '..', 'database', 'schema.sql');

/** Splits a T-SQL script into batches on lines that contain only GO. */
function splitBatches(script) {
    return script
        .split(/^\s*GO\s*$/gim)
        .map((b) => b.trim())
        .filter(Boolean);
}

function connect(config, database) {
    return new sql.ConnectionPool({
        server: config.db.server,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database,
        options: config.db.options,
    }).connect();
}

const DROP_ALL = `
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
             + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' FROM sys.foreign_keys;
SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';' FROM sys.tables;
EXEC sp_executesql @sql;`;

/**
 * Creates the database when missing and applies database/schema.sql.
 * @param {{ reset?: boolean }} options reset drops every table first (development / tests only).
 */
async function initDatabase({ reset = false } = {}) {
    const config = loadConfig();
    const dbName = config.db.database;
    if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME may only contain letters, digits and underscores');

    const master = await connect(config, 'master');
    try {
        await master.request().query(`IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}];`);
    } finally {
        await master.close();
    }

    const pool = await connect(config, dbName);
    try {
        if (reset) await pool.request().batch(DROP_ALL);
        for (const batch of splitBatches(fs.readFileSync(SCHEMA_FILE, 'utf8'))) {
            await pool.request().batch(batch);
        }
    } finally {
        await pool.close();
    }
    await closePool();
    return dbName;
}

module.exports = { initDatabase, splitBatches };
