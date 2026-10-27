// Shared setup for the integration tests. They run against a real SQL Server instance using a
// separate database (MoldTrackingTest by default) that is dropped and recreated for every test file.
process.env.NODE_ENV = 'test';
require('dotenv').config();
process.env.DB_NAME = process.env.TEST_DB_NAME || 'MoldTrackingTest';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret';

const bcrypt = require('bcrypt');
const request = require('supertest');
const { loadConfig } = require('../src/config/env');
const { initDatabase } = require('../src/db/init');
const { query, closePool } = require('../src/db/pool');
const { createApp } = require('../src/app');

const PASSWORD = 'Passw0rd-test';

const USERS = [
    { username: 'admin', full_name: 'Test Admin', role: 'admin' },
    { username: 'engineer', full_name: 'Test Engineer', role: 'engineer' },
    { username: 'viewer', full_name: 'Test Viewer', role: 'viewer' },
];

/** Recreates the schema, inserts one user per role and returns a ready Express app. */
async function setup(configOverrides = {}) {
    await initDatabase({ reset: true });
    const hash = await bcrypt.hash(PASSWORD, 4);
    const ids = {};
    for (const u of USERS) {
        const r = await query(
            'INSERT INTO users (username, password_hash, full_name, role) OUTPUT INSERTED.id VALUES (@username, @hash, @full_name, @role)',
            { ...u, hash },
        );
        ids[u.username] = r.recordset[0].id;
    }
    const config = loadConfig();
    config.rateLimit = { ...config.rateLimit, loginMax: 1000, apiMax: 100000, ...configOverrides.rateLimit };
    config.auth = { ...config.auth, bcryptRounds: 4 };
    process.env.BCRYPT_ROUNDS = '4';
    const app = createApp(config);
    return { app, ids, config };
}

/** Logs in and returns { token, cookies, user }. */
async function login(app, username = 'admin', password = PASSWORD) {
    const res = await request(app).post('/api/auth/login').send({ username, password });
    if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
    return { token: res.body.access_token, cookies: res.headers['set-cookie'], user: res.body.user };
}

/** supertest shorthand with a Bearer token. */
const as = (app, token) => ({
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

const validMold = (overrides = {}) => ({
    code: 'T-001',
    name: 'Test housing',
    project: 'Test project',
    status: 'trial',
    cavities: 2,
    material: 'ABS',
    start_date: '2026-01-10',
    deadline: '2026-06-30',
    cost: 12500.5,
    payment_status: 'unpaid',
    ...overrides,
});

module.exports = { PASSWORD, setup, login, as, validMold, closePool, query, request };
