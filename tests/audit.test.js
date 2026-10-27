const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { PASSWORD, setup, login, as, validMold, closePool, request } = require('./helpers');

describe('audit logging', () => {
    let app;
    let admin;
    let engineer;
    let viewer;

    before(async () => {
        ({ app } = await setup());
        admin = as(app, (await login(app, 'admin')).token);
        engineer = as(app, (await login(app, 'engineer')).token);
        viewer = as(app, (await login(app, 'viewer')).token);
    });
    after(closePool);

    it('records who did what for mold and history changes', async () => {
        const created = await engineer.post('/api/molds').send(validMold({ code: 'AU-1' }));
        const id = created.body.data.id;
        await engineer.patch(`/api/molds/${id}`).send({ status: 'active' });
        const trial = await engineer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-01', quantity: 10 });
        await engineer.delete(`/api/molds/${id}/trials/${trial.body.data.id}`);
        await engineer.delete(`/api/molds/${id}`);
        await admin.post(`/api/molds/${id}/restore`);

        const res = await admin.get('/api/logs/activity?page_size=100&search=AU-1');
        assert.equal(res.status, 200);
        const actions = res.body.data.map((l) => l.action);
        for (const a of ['mold.create', 'mold.update', 'trial.create', 'trial.delete', 'mold.archive', 'mold.restore']) {
            assert.ok(actions.includes(a), `missing ${a} in ${actions.join(',')}`);
        }
        const create = res.body.data.find((l) => l.action === 'mold.create');
        assert.equal(create.user_name, 'Test Engineer');
        assert.equal(create.entity_type, 'mold');
        assert.equal(create.entity_id, id);
    });

    it('does not log rejected writes', async () => {
        const before = (await admin.get('/api/logs/activity?action=mold.create')).body.meta.total;
        await engineer.post('/api/molds').send({ code: '', name: '' });
        await viewer.post('/api/molds').send(validMold({ code: 'NOPE-1' }));
        const after = (await admin.get('/api/logs/activity?action=mold.create')).body.meta.total;
        assert.equal(after, before);
    });

    it('logs user administration and password changes', async () => {
        const created = await admin.post('/api/users').send({ username: 'audited', password: 'Start-Pass1', full_name: 'Audited User' });
        await admin.patch(`/api/users/${created.body.data.id}`).send({ is_active: false });
        await admin.post(`/api/users/${created.body.data.id}/reset-password`).send({ new_password: 'Reset-Pass9' });
        await viewer.post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: 'Changed-Pass1' });

        const res = await admin.get('/api/logs/activity?entity_type=user&page_size=100');
        const actions = res.body.data.map((l) => l.action);
        for (const a of ['user.create', 'user.deactivate', 'user.reset_password', 'auth.change_password']) {
            assert.ok(actions.includes(a), `missing ${a}`);
        }
    });

    it('records successful and failed logins with IP and user agent', async () => {
        await request(app).post('/api/auth/login').set('User-Agent', 'audit-test-agent').send({ username: 'engineer', password: 'wrong-pass1' });
        await request(app).post('/api/auth/login').set('User-Agent', 'audit-test-agent').send({ username: 'ghost.user', password: 'whatever123' });

        const failed = await admin.get('/api/logs/logins?success=false&page_size=100');
        assert.equal(failed.status, 200);
        const names = failed.body.data.map((l) => l.username);
        assert.ok(names.includes('engineer'));
        assert.ok(names.includes('ghost.user'));
        const ghost = failed.body.data.find((l) => l.username === 'ghost.user');
        assert.equal(ghost.success, false);
        assert.equal(ghost.user_id, null);
        assert.equal(ghost.user_agent, 'audit-test-agent');
        assert.ok(ghost.ip_address);

        const ok = await admin.get('/api/logs/logins?success=true&search=admin');
        assert.ok(ok.body.data.length >= 1);
        assert.ok(ok.body.data.every((l) => l.success === true));
    });

    it('restricts both logs to admins and paginates', async () => {
        for (const url of ['/api/logs/activity', '/api/logs/logins']) {
            assert.equal((await engineer.get(url)).status, 403);
            assert.equal((await viewer.get(url)).status, 403);
        }
        const page = await admin.get('/api/logs/activity?page_size=2&page=1');
        assert.equal(page.body.data.length, 2);
        assert.ok(page.body.meta.total > 2);
        assert.equal((await admin.get('/api/logs/activity?from=garbage')).status, 400);
    });
});
