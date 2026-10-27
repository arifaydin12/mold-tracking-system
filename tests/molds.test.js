const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, login, as, validMold, closePool } = require('./helpers');

describe('molds', () => {
    let app;
    let admin;
    let engineer;
    let viewer;
    let supplierId;

    before(async () => {
        ({ app } = await setup());
        admin = as(app, (await login(app, 'admin')).token);
        engineer = as(app, (await login(app, 'engineer')).token);
        viewer = as(app, (await login(app, 'viewer')).token);
        const s = await engineer.post('/api/suppliers').send({ name: 'Test Toolworks', country: 'Poland' });
        supplierId = s.body.data.id;
    });
    after(closePool);

    describe('role enforcement', () => {
        it('lets viewers read but not write', async () => {
            assert.equal((await viewer.get('/api/molds')).status, 200);
            const create = await viewer.post('/api/molds').send(validMold({ code: 'V-1' }));
            assert.equal(create.status, 403);
            assert.equal(create.body.error.code, 'forbidden');
        });

        it('lets engineers create, edit and archive but not restore', async () => {
            const created = await engineer.post('/api/molds').send(validMold({ code: 'E-1' }));
            assert.equal(created.status, 201);
            const id = created.body.data.id;
            assert.equal((await engineer.patch(`/api/molds/${id}`).send({ name: 'Renamed by engineer' })).status, 200);
            assert.equal((await engineer.delete(`/api/molds/${id}`)).status, 204);
            assert.equal((await engineer.post(`/api/molds/${id}/restore`)).status, 403);
            assert.equal((await admin.post(`/api/molds/${id}/restore`)).status, 200);
        });

        it('blocks viewers from history writes and engineers from admin endpoints', async () => {
            const created = await admin.post('/api/molds').send(validMold({ code: 'R-1' }));
            const id = created.body.data.id;
            assert.equal((await viewer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-01' })).status, 403);
            assert.equal((await viewer.delete(`/api/molds/${id}`)).status, 403);
            assert.equal((await engineer.get('/api/users')).status, 403);
            assert.equal((await engineer.get('/api/logs/activity')).status, 403);
            assert.equal((await viewer.post('/api/suppliers').send({ name: 'Nope' })).status, 403);
        });
    });

    describe('create and read', () => {
        it('creates a mold with defaults and returns the full detail', async () => {
            const res = await engineer.post('/api/molds').send({ code: 'C-100', name: 'Minimal mold' });
            assert.equal(res.status, 201);
            const m = res.body.data;
            assert.equal(m.status, 'trial');
            assert.equal(m.cavities, 1);
            assert.equal(m.cost, 0);
            assert.equal(m.payment_status, 'unpaid');
            assert.equal(m.is_archived, false);
            assert.deepEqual([m.trials, m.revisions, m.maintenance], [[], [], []]);
            assert.equal(m.created_by_name, 'Test Engineer');
        });

        it('stores dates as YYYY-MM-DD and money with two decimals', async () => {
            const res = await engineer.post('/api/molds').send(validMold({ code: 'C-101', cost: '1999.999', supplier_id: supplierId }));
            assert.equal(res.status, 201);
            assert.equal(res.body.data.start_date, '2026-01-10');
            assert.equal(res.body.data.deadline, '2026-06-30');
            assert.equal(res.body.data.cost, 2000);
            assert.equal(res.body.data.supplier_name, 'Test Toolworks');
        });

        it('rejects duplicate codes with 409', async () => {
            await engineer.post('/api/molds').send(validMold({ code: 'DUP-1' }));
            const res = await engineer.post('/api/molds').send(validMold({ code: 'DUP-1' }));
            assert.equal(res.status, 409);
            assert.equal(res.body.error.code, 'conflict');
        });

        it('returns 404 for unknown ids and 400 for bad ids', async () => {
            assert.equal((await viewer.get('/api/molds/999999')).status, 404);
            const bad = await viewer.get('/api/molds/abc');
            assert.equal(bad.status, 400);
            assert.equal(bad.body.error.code, 'validation_error');
        });
    });

    describe('validation', () => {
        const cases = [
            ['missing code', { name: 'No code' }, 'code'],
            ['short name', { code: 'X-1', name: 'a' }, 'name'],
            ['bad characters in code', { code: '<script>', name: 'Valid name' }, 'code'],
            ['unknown status', validMold({ code: 'X-2', status: 'broken' }), 'status'],
            ['zero cavities', validMold({ code: 'X-3', cavities: 0 }), 'cavities'],
            ['fractional cavities', validMold({ code: 'X-4', cavities: 1.5 }), 'cavities'],
            ['negative cost', validMold({ code: 'X-5', cost: -1 }), 'cost'],
            ['non-numeric cost', validMold({ code: 'X-6', cost: 'abc' }), 'cost'],
            ['impossible date', validMold({ code: 'X-7', deadline: '2026-02-30' }), 'deadline'],
            ['wrong date format', validMold({ code: 'X-8', start_date: '10/01/2026' }), 'start_date'],
            ['deadline before start', validMold({ code: 'X-9', start_date: '2026-05-01', deadline: '2026-04-01' }), 'deadline'],
            ['unknown payment status', validMold({ code: 'X-10', payment_status: 'maybe' }), 'payment_status'],
            ['unknown supplier', validMold({ code: 'X-11', supplier_id: 987654 }), 'supplier_id'],
        ];
        for (const [label, body, field] of cases) {
            it(`rejects ${label}`, async () => {
                const res = await engineer.post('/api/molds').send(body);
                assert.equal(res.status, 400, JSON.stringify(res.body));
                assert.equal(res.body.error.code, 'validation_error');
                assert.ok(res.body.error.details.some((d) => d.field === field), `expected an issue on ${field}: ${JSON.stringify(res.body.error.details)}`);
            });
        }

        it('rejects empty PATCH bodies and malformed JSON', async () => {
            const { body } = await engineer.post('/api/molds').send(validMold({ code: 'P-1' }));
            assert.equal((await engineer.patch(`/api/molds/${body.data.id}`).send({})).status, 400);
            const res = await engineer.post('/api/molds').set('Content-Type', 'application/json').send('{"code":');
            assert.equal(res.status, 400);
            assert.equal(res.body.error.code, 'bad_request');
        });

        it('trims text and turns blank optional values into null', async () => {
            const res = await engineer.post('/api/molds').send(validMold({ code: '  T-TRIM  ', name: '  Padded name ', project: '   ', material: '' }));
            assert.equal(res.status, 201);
            assert.equal(res.body.data.code, 'T-TRIM');
            assert.equal(res.body.data.name, 'Padded name');
            assert.equal(res.body.data.project, null);
            assert.equal(res.body.data.material, null);
        });
    });

    describe('update', () => {
        it('applies partial updates without touching other fields', async () => {
            const { body } = await engineer.post('/api/molds').send(validMold({ code: 'U-1', project: 'Keep me' }));
            const res = await engineer.patch(`/api/molds/${body.data.id}`).send({ status: 'active', cost: 500 });
            assert.equal(res.status, 200);
            assert.equal(res.body.data.status, 'active');
            assert.equal(res.body.data.cost, 500);
            assert.equal(res.body.data.project, 'Keep me');
            assert.equal(res.body.data.updated_by, (await engineer.get('/api/auth/me')).body.user.id);
        });

        it('validates cross-field dates against stored values', async () => {
            const { body } = await engineer.post('/api/molds').send(validMold({ code: 'U-2', start_date: '2026-03-01', deadline: '2026-04-01' }));
            const res = await engineer.patch(`/api/molds/${body.data.id}`).send({ deadline: '2026-02-01' });
            assert.equal(res.status, 400);
        });

        it('clears nullable fields', async () => {
            const { body } = await engineer.post('/api/molds').send(validMold({ code: 'U-3', supplier_id: supplierId }));
            const res = await engineer.patch(`/api/molds/${body.data.id}`).send({ supplier_id: null, deadline: '' });
            assert.equal(res.status, 200);
            assert.equal(res.body.data.supplier_id, null);
            assert.equal(res.body.data.deadline, null);
        });
    });

    describe('archive (soft delete)', () => {
        it('hides archived molds from the default list, keeps their data and blocks edits', async () => {
            const { body } = await engineer.post('/api/molds').send(validMold({ code: 'A-1' }));
            const id = body.data.id;
            await engineer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-01', quantity: 10 });

            assert.equal((await engineer.delete(`/api/molds/${id}`)).status, 204);
            assert.equal((await engineer.delete(`/api/molds/${id}`)).status, 409);

            const list = await viewer.get('/api/molds?search=A-1');
            assert.equal(list.body.data.length, 0);
            const archived = await viewer.get('/api/molds?archived=true&search=A-1');
            assert.equal(archived.body.data.length, 1);
            assert.equal(archived.body.data[0].is_archived, true);

            const detail = await viewer.get(`/api/molds/${id}`);
            assert.equal(detail.body.data.trials.length, 1);

            assert.equal((await engineer.patch(`/api/molds/${id}`).send({ name: 'Edited' })).status, 409);
            assert.equal((await engineer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-02' })).status, 409);

            const restored = await admin.post(`/api/molds/${id}/restore`);
            assert.equal(restored.body.data.is_archived, false);
            assert.equal((await admin.post(`/api/molds/${id}/restore`)).status, 409);
        });
    });

    describe('history records', () => {
        let id;
        before(async () => {
            id = (await engineer.post('/api/molds').send(validMold({ code: 'H-1', cost: 1000 }))).body.data.id;
        });

        it('creates, lists, updates and deletes trials', async () => {
            const created = await engineer.post(`/api/molds/${id}/trials`).send({
                trial_date: '2026-02-01', material: 'PP', color: 'Black', quantity: 120, outcome: 'conditional', result: 'Minor flash', operator: 'T. Operator',
            });
            assert.equal(created.status, 201);
            assert.equal(created.body.data.trial_date, '2026-02-01');
            const trialId = created.body.data.id;

            const list = await viewer.get(`/api/molds/${id}/trials`);
            assert.equal(list.body.data.length, 1);

            const updated = await engineer.patch(`/api/molds/${id}/trials/${trialId}`).send({ outcome: 'pass' });
            assert.equal(updated.body.data.outcome, 'pass');
            assert.equal(updated.body.data.quantity, 120);

            assert.equal((await engineer.delete(`/api/molds/${id}/trials/${trialId}`)).status, 204);
            assert.equal((await engineer.delete(`/api/molds/${id}/trials/${trialId}`)).status, 404);
        });

        it('validates trial, revision and maintenance payloads', async () => {
            assert.equal((await engineer.post(`/api/molds/${id}/trials`).send({ quantity: 5 })).status, 400);
            assert.equal((await engineer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-01', quantity: -3 })).status, 400);
            assert.equal((await engineer.post(`/api/molds/${id}/trials`).send({ trial_date: '2026-02-01', outcome: 'great' })).status, 400);
            assert.equal((await engineer.post(`/api/molds/${id}/revisions`).send({ revision_date: '2026-02-01' })).status, 400);
            assert.equal((await engineer.post(`/api/molds/${id}/maintenance`).send({ maintenance_date: '2026-02-01', description: 'x' })).status, 400);
        });

        it('does not allow touching a record through another mold', async () => {
            const other = (await engineer.post('/api/molds').send(validMold({ code: 'H-2' }))).body.data.id;
            const rec = await engineer.post(`/api/molds/${id}/revisions`).send({ revision_date: '2026-03-01', work_done: 'Polish cavity', cost: 100 });
            assert.equal((await engineer.patch(`/api/molds/${other}/revisions/${rec.body.data.id}`).send({ cost: 1 })).status, 404);
            assert.equal((await engineer.delete(`/api/molds/${other}/revisions/${rec.body.data.id}`)).status, 404);
        });

        it('aggregates costs in the mold detail', async () => {
            await engineer.post(`/api/molds/${id}/revisions`).send({ revision_date: '2026-03-05', work_done: 'Add vents', cost: 250.5, vendor: 'Test Toolworks' });
            await engineer.post(`/api/molds/${id}/maintenance`).send({ maintenance_date: '2026-04-01', description: 'Cleaning', status: 'completed', cost: 80 });
            const { body } = await viewer.get(`/api/molds/${id}`);
            assert.equal(body.data.revisions.length, 2);
            assert.equal(body.data.maintenance.length, 1);
            assert.equal(body.data.totals.revision_cost, 350.5);
            assert.equal(body.data.totals.maintenance_cost, 80);
            assert.equal(body.data.totals.total_cost, 1430.5);
        });

        it('exposes history counts in the list', async () => {
            const list = await viewer.get('/api/molds?search=H-1');
            assert.equal(list.body.data[0].revision_count, 2);
            assert.equal(list.body.data[0].maintenance_count, 1);
        });
    });

    describe('list: search, filter, sort, pagination', () => {
        before(async () => {
            const rows = [
                ['L-01', 'Alpha cover', 'active', 300, '2026-09-01', 'paid'],
                ['L-02', 'Bravo clip', 'trial', 100, '2026-07-01', 'unpaid'],
                ['L-03', 'Charlie knob', 'revision', 200, null, 'partial'],
                ['L-04', 'Delta cap', 'active', 400, '2026-08-01', 'paid'],
                ['L-05', 'Echo bracket', 'maintenance', 50, '2026-10-01', 'paid'],
            ];
            for (const [code, name, status, cost, deadline, payment_status] of rows) {
                const res = await engineer.post('/api/molds').send({ code, name, status, cost, deadline, payment_status, supplier_id: code === 'L-01' ? supplierId : null });
                assert.equal(res.status, 201, JSON.stringify(res.body));
            }
        });

        it('paginates and reports metadata', async () => {
            const res = await viewer.get('/api/molds?search=L-0&page_size=2&page=2&sort=code&order=asc');
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.data.map((m) => m.code), ['L-03', 'L-04']);
            assert.deepEqual(res.body.meta, { page: 2, page_size: 2, total: 5, total_pages: 3 });
        });

        it('filters by status, payment status and supplier', async () => {
            const active = await viewer.get('/api/molds?status=active&search=L-0');
            assert.deepEqual(active.body.data.map((m) => m.code).sort(), ['L-01', 'L-04']);
            const unpaid = await viewer.get('/api/molds?payment_status=unpaid&search=L-0');
            assert.deepEqual(unpaid.body.data.map((m) => m.code), ['L-02']);
            const bySupplier = await viewer.get(`/api/molds?supplier_id=${supplierId}&search=L-0`);
            assert.deepEqual(bySupplier.body.data.map((m) => m.code), ['L-01']);
        });

        it('searches names case-insensitively and treats wildcards literally', async () => {
            const res = await viewer.get('/api/molds?search=BRAVO');
            assert.deepEqual(res.body.data.map((m) => m.code), ['L-02']);
            const wildcard = await viewer.get('/api/molds?search=%25');
            assert.equal(wildcard.body.data.length, 0);
        });

        it('sorts by cost and by deadline with missing deadlines last', async () => {
            const cost = await viewer.get('/api/molds?search=L-0&sort=cost&order=desc');
            assert.deepEqual(cost.body.data.map((m) => m.cost), [400, 300, 200, 100, 50]);
            const deadline = await viewer.get('/api/molds?search=L-0&sort=deadline&order=asc');
            assert.equal(deadline.body.data[0].code, 'L-02');
            assert.equal(deadline.body.data[4].code, 'L-03');
        });

        it('rejects invalid query parameters', async () => {
            assert.equal((await viewer.get('/api/molds?sort=password')).status, 400);
            assert.equal((await viewer.get('/api/molds?page=0')).status, 400);
            assert.equal((await viewer.get('/api/molds?page_size=1000')).status, 400);
            assert.equal((await viewer.get('/api/molds?status=nonsense')).status, 400);
        });
    });
});
