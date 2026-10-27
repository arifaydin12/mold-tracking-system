const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PASSWORD, setup, login, as, closePool, request } = require('./helpers');

describe('user management', () => {
    let app;
    let ids;
    let admin;
    let engineer;

    before(async () => {
        ({ app, ids } = await setup());
        admin = as(app, (await login(app, 'admin')).token);
        engineer = as(app, (await login(app, 'engineer')).token);
    });
    after(closePool);

    it('is restricted to admins', async () => {
        assert.equal((await engineer.get('/api/users')).status, 403);
        assert.equal((await engineer.post('/api/users').send({ username: 'x.user', password: 'Passw0rd1', full_name: 'X User' })).status, 403);
    });

    it('lists users with pagination and filters, never exposing hashes', async () => {
        const res = await admin.get('/api/users?page_size=2&sort=username');
        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 2);
        assert.equal(res.body.meta.total, 3);
        assert.ok(res.body.data.every((u) => u.password_hash === undefined));
        const viewers = await admin.get('/api/users?role=viewer');
        assert.deepEqual(viewers.body.data.map((u) => u.username), ['viewer']);
    });

    it('creates a user who can log in, with validation and duplicate protection', async () => {
        const res = await admin.post('/api/users').send({ username: 'New.User', password: 'Start-Pass1', full_name: 'New User', email: 'new@example.com', role: 'engineer' });
        assert.equal(res.status, 201);
        assert.equal(res.body.data.username, 'new.user');
        assert.equal(res.body.data.is_active, true);

        const dup = await admin.post('/api/users').send({ username: 'new.user', password: 'Start-Pass1', full_name: 'Another' });
        assert.equal(dup.status, 409);

        const bad = await admin.post('/api/users').send({ username: 'a', password: 'short', full_name: '', role: 'boss', email: 'nope' });
        assert.equal(bad.status, 400);
        const fields = bad.body.error.details.map((d) => d.field).sort();
        assert.deepEqual(fields, ['email', 'full_name', 'password', 'role', 'username']);

        assert.equal((await request(app).post('/api/auth/login').send({ username: 'new.user', password: 'Start-Pass1' })).status, 200);
    });

    it('changes a role and the change applies to the existing token immediately', async () => {
        const created = await admin.post('/api/users').send({ username: 'promote.me', password: 'Start-Pass1', full_name: 'Promote Me', role: 'viewer' });
        const session = await login(app, 'promote.me', 'Start-Pass1');
        const user = as(app, session.token);
        assert.equal((await user.post('/api/molds').send({ code: 'PM-1', name: 'Role test' })).status, 403);
        const upd = await admin.patch(`/api/users/${created.body.data.id}`).send({ role: 'engineer' });
        assert.equal(upd.status, 200);
        assert.equal((await user.post('/api/molds').send({ code: 'PM-1', name: 'Role test' })).status, 201);
    });

    it('deactivates a user, ending their sessions', async () => {
        const created = await admin.post('/api/users').send({ username: 'leaver', password: 'Start-Pass1', full_name: 'Leaving Person', role: 'viewer' });
        const session = await login(app, 'leaver', 'Start-Pass1');
        const res = await admin.patch(`/api/users/${created.body.data.id}`).send({ is_active: false });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.is_active, false);
        assert.equal((await as(app, session.token).get('/api/molds')).status, 401);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', session.cookies)).status, 401);
        assert.equal((await request(app).post('/api/auth/login').send({ username: 'leaver', password: 'Start-Pass1' })).status, 401);
    });

    it('resets a password and ends the target user sessions', async () => {
        const session = await login(app, 'viewer');
        const res = await admin.post(`/api/users/${ids.viewer}/reset-password`).send({ new_password: 'Reset-Pass9' });
        assert.equal(res.status, 204);
        assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', session.cookies)).status, 401);
        assert.equal((await request(app).post('/api/auth/login').send({ username: 'viewer', password: PASSWORD })).status, 401);
        assert.equal((await request(app).post('/api/auth/login').send({ username: 'viewer', password: 'Reset-Pass9' })).status, 200);
        assert.equal((await admin.post(`/api/users/${ids.viewer}/reset-password`).send({ new_password: 'weak' })).status, 400);
        assert.equal((await admin.post('/api/users/99999/reset-password').send({ new_password: 'Reset-Pass9' })).status, 404);
    });

    it('protects against locking everyone out', async () => {
        assert.equal((await admin.patch(`/api/users/${ids.admin}`).send({ is_active: false })).status, 409);
        assert.equal((await admin.patch(`/api/users/${ids.admin}`).send({ role: 'viewer' })).status, 409);

        // a second admin may demote the first, but never the last one
        const second = await admin.post('/api/users').send({ username: 'admin.two', password: 'Start-Pass1', full_name: 'Second Admin', role: 'admin' });
        const other = as(app, (await login(app, 'admin.two', 'Start-Pass1')).token);
        assert.equal((await other.patch(`/api/users/${ids.admin}`).send({ role: 'engineer' })).status, 200);
        assert.equal((await other.patch(`/api/users/${second.body.data.id}`).send({ role: 'viewer' })).status, 409);
    });
});
