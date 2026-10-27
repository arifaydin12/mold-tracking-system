const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PASSWORD, setup, login, as, closePool, query, request } = require('./helpers');

describe('authentication', () => {
    let app;
    let ids;

    before(async () => {
        ({ app, ids } = await setup());
    });
    after(closePool);

    it('rejects requests without a token', async () => {
        const res = await request(app).get('/api/molds');
        assert.equal(res.status, 401);
        assert.equal(res.body.error.code, 'unauthorized');
    });

    it('rejects a malformed or tampered token', async () => {
        const res = await as(app, 'not.a.jwt').get('/api/molds');
        assert.equal(res.status, 401);
    });

    it('logs in with valid credentials and returns a token, user and refresh cookie', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: PASSWORD });
        assert.equal(res.status, 200);
        assert.ok(res.body.access_token);
        assert.equal(res.body.user.username, 'admin');
        assert.equal(res.body.user.role, 'admin');
        assert.equal(res.body.user.password_hash, undefined);
        const cookie = res.headers['set-cookie'].join(';');
        assert.match(cookie, /mts_refresh=/);
        assert.match(cookie, /HttpOnly/i);
    });

    it('treats usernames case-insensitively', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: 'ADMIN', password: PASSWORD });
        assert.equal(res.status, 200);
    });

    it('rejects wrong passwords and unknown users with the same message', async () => {
        const wrong = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-password1' });
        const unknown = await request(app).post('/api/auth/login').send({ username: 'ghost', password: 'whatever123' });
        assert.equal(wrong.status, 401);
        assert.equal(unknown.status, 401);
        assert.equal(wrong.body.error.message, unknown.body.error.message);
    });

    it('validates the login payload', async () => {
        const res = await request(app).post('/api/auth/login').send({ username: '' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'validation_error');
        assert.ok(res.body.error.details.some((d) => d.field === 'password'));
    });

    it('returns the current user from /auth/me', async () => {
        const { token } = await login(app, 'engineer');
        const res = await as(app, token).get('/api/auth/me');
        assert.equal(res.status, 200);
        assert.equal(res.body.user.role, 'engineer');
    });

    it('rotates refresh tokens and detects reuse', async () => {
        const { cookies } = await login(app, 'viewer');
        const first = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
        assert.equal(first.status, 200);
        assert.ok(first.body.access_token);
        const newCookies = first.headers['set-cookie'];
        assert.notEqual(newCookies[0].split(';')[0], cookies[0].split(';')[0]);

        // the new token works
        const second = await request(app).post('/api/auth/refresh').set('Cookie', newCookies);
        assert.equal(second.status, 200);

        // replaying the first (already rotated) token fails and revokes the whole family
        const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
        assert.equal(replay.status, 401);
        const afterReplay = await request(app).post('/api/auth/refresh').set('Cookie', second.headers['set-cookie']);
        assert.equal(afterReplay.status, 401);
    });

    it('refresh fails without a cookie', async () => {
        const res = await request(app).post('/api/auth/refresh');
        assert.equal(res.status, 401);
    });

    it('logout revokes the refresh token', async () => {
        const { cookies } = await login(app, 'viewer');
        const out = await request(app).post('/api/auth/logout').set('Cookie', cookies);
        assert.equal(out.status, 204);
        const res = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
        assert.equal(res.status, 401);
    });

    it('changes the password, ends other sessions and requires the new password afterwards', async () => {
        const a = await login(app, 'engineer');
        const other = await login(app, 'engineer');

        const bad = await as(app, a.token).post('/api/auth/change-password').send({ current_password: 'nope-nope1', new_password: 'Another-Pass1' });
        assert.equal(bad.status, 400);

        const weak = await as(app, a.token).post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: 'short' });
        assert.equal(weak.status, 400);
        assert.equal(weak.body.error.code, 'validation_error');

        const same = await as(app, a.token).post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: PASSWORD });
        assert.equal(same.status, 400);

        const ok = await as(app, a.token).post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: 'Another-Pass1' });
        assert.equal(ok.status, 200);
        assert.ok(ok.body.access_token);

        const stale = await request(app).post('/api/auth/refresh').set('Cookie', other.cookies);
        assert.equal(stale.status, 401);

        const oldLogin = await request(app).post('/api/auth/login').send({ username: 'engineer', password: PASSWORD });
        assert.equal(oldLogin.status, 401);
        const newLogin = await request(app).post('/api/auth/login').send({ username: 'engineer', password: 'Another-Pass1' });
        assert.equal(newLogin.status, 200);

        // restore for the other tests
        await as(app, newLogin.body.access_token).post('/api/auth/change-password').send({ current_password: 'Another-Pass1', new_password: PASSWORD });
    });

    it('updates the own profile', async () => {
        const { token } = await login(app, 'viewer');
        const res = await as(app, token).patch('/api/auth/me').send({ full_name: 'Viewer Renamed', email: 'viewer@example.com', department: 'Quality' });
        assert.equal(res.status, 200);
        assert.equal(res.body.user.full_name, 'Viewer Renamed');
        const invalid = await as(app, token).patch('/api/auth/me').send({ email: 'not-an-email' });
        assert.equal(invalid.status, 400);
        const empty = await as(app, token).patch('/api/auth/me').send({});
        assert.equal(empty.status, 400);
    });

    it('stops honouring tokens of a deactivated account immediately', async () => {
        const { token } = await login(app, 'viewer');
        await query('UPDATE users SET is_active = 0 WHERE id = @id', { id: ids.viewer });
        assert.equal((await as(app, token).get('/api/molds')).status, 401);
        const relogin = await request(app).post('/api/auth/login').send({ username: 'viewer', password: PASSWORD });
        assert.equal(relogin.status, 401);
        await query('UPDATE users SET is_active = 1 WHERE id = @id', { id: ids.viewer });
    });
});

describe('login rate limiting', () => {
    let app;
    before(async () => {
        ({ app } = await setup({ rateLimit: { loginMax: 3, loginWindowMin: 15 } }));
    });
    after(closePool);

    it('answers 429 once the limit is exceeded', async () => {
        const statuses = [];
        for (let i = 0; i < 5; i++) {
            const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong-password1' });
            statuses.push(res.status);
        }
        assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
        assert.equal(statuses[3], 429);
        assert.equal(statuses[4], 429);
    });
});
