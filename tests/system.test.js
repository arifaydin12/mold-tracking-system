const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, as, validMold, closePool, query, request } = require('./helpers');
const { seedDatabase } = require('../src/db/seed');

describe('system endpoints', () => {
    let app;
    let engineer;
    let viewer;

    before(async () => {
        ({ app } = await setup());
        engineer = as(app, (await login(app, 'engineer')).token);
        viewer = as(app, (await login(app, 'viewer')).token);
    });
    after(closePool);

    it('reports health including the database', async () => {
        const res = await request(app).get('/api/health');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
        assert.equal(res.body.database, 'up');
    });

    it('sets security headers and hides the framework', async () => {
        const res = await request(app).get('/api/health');
        assert.equal(res.headers['x-powered-by'], undefined);
        assert.equal(res.headers['x-content-type-options'], 'nosniff');
        assert.ok(res.headers['content-security-policy']);
    });

    it('serves the OpenAPI document and the docs UI', async () => {
        const spec = await request(app).get('/api/docs/openapi.json');
        assert.equal(spec.status, 200);
        assert.match(spec.body.openapi, /^3\./);
        assert.ok(spec.body.paths['/molds']);
        const ui = await request(app).get('/api/docs/');
        assert.equal(ui.status, 200);
        assert.match(ui.text, /swagger/i);
    });

    it('answers unknown routes with the standard error shape', async () => {
        const res = await as(app, (await login(app, 'viewer')).token).get('/api/nothing-here');
        assert.equal(res.status, 404);
        assert.equal(res.body.error.code, 'not_found');
    });

    it('only allows configured CORS origins', async () => {
        const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
        assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:3000');
        const denied = await request(app).get('/api/health').set('Origin', 'https://evil.example');
        assert.equal(denied.headers['access-control-allow-origin'], undefined);
    });

    it('manages suppliers with validation and unique names', async () => {
        const created = await engineer.post('/api/suppliers').send({ name: 'Supplier One', country: 'Germany', contact_email: 'a@example.com' });
        assert.equal(created.status, 201);
        assert.equal((await engineer.post('/api/suppliers').send({ name: 'Supplier One' })).status, 409);
        assert.equal((await engineer.post('/api/suppliers').send({ name: 'S', contact_email: 'bad' })).status, 400);
        const upd = await engineer.patch(`/api/suppliers/${created.body.data.id}`).send({ country: 'Poland' });
        assert.equal(upd.body.data.country, 'Poland');
        const list = await viewer.get('/api/suppliers');
        assert.equal(list.body.data[0].name, 'Supplier One');
    });

    it('computes the dashboard from live data', async () => {
        const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
        const sup = (await engineer.post('/api/suppliers').send({ name: 'Dash Supplier' })).body.data.id;
        const a = await engineer.post('/api/molds').send(validMold({ code: 'D-1', status: 'trial', deadline: day(-3), start_date: day(-60), cost: 1000, supplier_id: sup }));
        await engineer.post('/api/molds').send(validMold({ code: 'D-2', status: 'active', deadline: day(5), start_date: day(-60), cost: 2000, payment_status: 'paid', supplier_id: sup }));
        await engineer.post('/api/molds').send(validMold({ code: 'D-3', status: 'revision', deadline: day(10), start_date: day(-60), cost: 500 }));
        const gone = await engineer.post('/api/molds').send(validMold({ code: 'D-4', status: 'active', deadline: null, start_date: null, cost: 99999 }));
        await engineer.delete(`/api/molds/${gone.body.data.id}`);
        await engineer.post(`/api/molds/${a.body.data.id}/revisions`).send({ revision_date: day(-5), work_done: 'Vent rework', cost: 300 });
        await engineer.post(`/api/molds/${a.body.data.id}/maintenance`).send({ maintenance_date: day(4), description: 'Planned cleaning', status: 'planned' });

        const res = await viewer.get('/api/stats/dashboard');
        assert.equal(res.status, 200);
        const d = res.body.data;
        assert.equal(d.kpis.total_molds, 3);
        assert.equal(d.kpis.active_molds, 1);
        assert.equal(d.kpis.in_revision, 1);
        assert.ok(d.kpis.overdue_deadlines >= 1);
        assert.ok(d.kpis.maintenance_due >= 1);
        assert.equal(d.kpis.revision_cost >= 300, true);
        assert.ok(!d.status_distribution.some((s) => s.count === 0));
        const dash = d.cost_by_supplier.find((s) => s.supplier === 'Dash Supplier');
        assert.equal(dash.mold_cost, 3000);
        assert.equal(dash.revision_cost, 300);
        assert.equal(dash.total_cost, 3300);
        assert.ok(d.upcoming_deadlines.some((m) => m.code === 'D-1' && m.days_left === -3));
        assert.ok(!d.upcoming_deadlines.some((m) => m.code === 'D-2'), 'active molds are not open work');
        assert.ok(d.maintenance_due.some((m) => m.code === 'D-1'));
        assert.ok(d.recent_activity.length > 0);
        // archived mold cost is excluded
        assert.ok(d.kpis.purchase_cost < 99999);
    });

});

describe('demo seed', () => {
    before(async () => {
        await setup();
    });
    after(closePool);

    it('loads the demo dataset and refuses to overwrite without --force', async () => {
        await assert.rejects(seedDatabase(), /already contains data/);
        const summary = await seedDatabase({ force: true });
        assert.equal(summary.molds, 40);
        const counts = await query(
            `SELECT (SELECT COUNT(*) FROM molds) AS molds, (SELECT COUNT(*) FROM molds WHERE is_archived = 1) AS archived,
                    (SELECT COUNT(*) FROM mold_trials) AS trials, (SELECT COUNT(*) FROM suppliers) AS suppliers,
                    (SELECT COUNT(*) FROM users WHERE role = N'admin') AS admins`,
        );
        const c = counts.recordset[0];
        assert.equal(c.molds, 40);
        assert.equal(c.archived, 3);
        assert.equal(c.suppliers, 7);
        assert.equal(c.admins, 1);
        assert.ok(c.trials > 50);
    });
});
