import { beforeEach, describe, expect, it } from 'vitest'
import { handleRequest, ApiError } from '../demo/server.js'
import { _forgetState, getState, resetDemo, DEMO_PASSWORD } from '../demo/store.js'

// The in-browser demo backend must behave like the real API (same routes, validation, roles, audit trail).

const call = async (method, path, { body, query, token } = {}) => {
    try {
        return await handleRequest({ method, path, body, query, authorization: token ? `Bearer ${token}` : undefined })
    } catch (err) {
        if (err instanceof ApiError) return { status: err.status, data: { error: { code: err.code, message: err.message, details: err.details } } }
        throw err
    }
}

const login = async (username, password = DEMO_PASSWORD) => {
    const res = await call('POST', '/auth/login', { body: { username, password } })
    return res.data?.access_token
}

const mold = (overrides = {}) => ({ code: 'T-001', name: 'Test housing', cavities: 2, cost: 100, start_date: '2026-01-10', deadline: '2026-06-30', ...overrides })

let admin
let engineer
let viewer

beforeEach(async () => {
    _forgetState()
    await getState()
    admin = await login('admin')
    engineer = await login('engineer')
    viewer = await login('viewer')
})

describe('demo backend: authentication', () => {
    it('logs in and rejects bad credentials with one generic message', async () => {
        const ok = await call('POST', '/auth/login', { body: { username: 'ADMIN', password: DEMO_PASSWORD } })
        expect(ok.status).toBe(200)
        expect(ok.data.user).toMatchObject({ username: 'admin', role: 'admin' })
        expect(ok.data.user.password_hash).toBeUndefined()
        const bad = await call('POST', '/auth/login', { body: { username: 'admin', password: 'nope-nope1' } })
        const ghost = await call('POST', '/auth/login', { body: { username: 'ghost', password: 'nope-nope1' } })
        expect([bad.status, ghost.status]).toEqual([401, 401])
        expect(bad.data.error.message).toBe(ghost.data.error.message)
    })

    it('validates the login body', async () => {
        const res = await call('POST', '/auth/login', { body: { username: '' } })
        expect(res.status).toBe(400)
        expect(res.data.error.code).toBe('validation_error')
        expect(res.data.error.details.map((d) => d.field)).toContain('password')
    })

    it('requires a token and refuses deactivated accounts', async () => {
        expect((await call('GET', '/molds')).status).toBe(401)
        expect((await call('GET', '/molds', { token: 'garbage' })).status).toBe(401)
        const users = (await call('GET', '/users', { token: admin })).data.data
        const viewerUser = users.find((u) => u.username === 'viewer')
        await call('PATCH', `/users/${viewerUser.id}`, { token: admin, body: { is_active: false } })
        expect((await call('GET', '/molds', { token: viewer })).status).toBe(401)
        expect((await call('POST', '/auth/login', { body: { username: 'viewer', password: DEMO_PASSWORD } })).status).toBe(401)
    })

    it('resumes a session through the refresh endpoint and ends it on logout', async () => {
        await login('engineer')
        const refreshed = await call('POST', '/auth/refresh')
        expect(refreshed.status).toBe(200)
        expect(refreshed.data.user.username).toBe('engineer')
        await call('POST', '/auth/logout')
        expect((await call('POST', '/auth/refresh')).status).toBe(401)
    })

    it('changes the password with the same policy as the server', async () => {
        const weak = await call('POST', '/auth/change-password', { token: engineer, body: { current_password: DEMO_PASSWORD, new_password: 'short' } })
        expect(weak.status).toBe(400)
        const wrong = await call('POST', '/auth/change-password', { token: engineer, body: { current_password: 'wrong-pass1', new_password: 'Another-Pass1' } })
        expect(wrong.status).toBe(400)
        const ok = await call('POST', '/auth/change-password', { token: engineer, body: { current_password: DEMO_PASSWORD, new_password: 'Another-Pass1' } })
        expect(ok.status).toBe(200)
        expect((await call('POST', '/auth/login', { body: { username: 'engineer', password: DEMO_PASSWORD } })).status).toBe(401)
        expect((await call('POST', '/auth/login', { body: { username: 'engineer', password: 'Another-Pass1' } })).status).toBe(200)
    })
})

describe('demo backend: role enforcement', () => {
    it('lets viewers read but not write', async () => {
        expect((await call('GET', '/molds', { token: viewer })).status).toBe(200)
        expect((await call('POST', '/molds', { token: viewer, body: mold() })).status).toBe(403)
        expect((await call('DELETE', '/molds/1', { token: viewer })).status).toBe(403)
        expect((await call('POST', '/molds/1/trials', { token: viewer, body: { trial_date: '2026-01-01' } })).status).toBe(403)
    })

    it('lets engineers write and archive but not restore or manage users', async () => {
        const created = await call('POST', '/molds', { token: engineer, body: mold() })
        expect(created.status).toBe(201)
        const id = created.data.data.id
        expect((await call('DELETE', `/molds/${id}`, { token: engineer })).status).toBe(204)
        expect((await call('POST', `/molds/${id}/restore`, { token: engineer })).status).toBe(403)
        expect((await call('POST', `/molds/${id}/restore`, { token: admin })).status).toBe(200)
        expect((await call('GET', '/users', { token: engineer })).status).toBe(403)
        expect((await call('GET', '/logs/activity', { token: engineer })).status).toBe(403)
    })
})

describe('demo backend: molds', () => {
    it('is seeded with the same dataset as the SQL seed', async () => {
        const all = await call('GET', '/molds', { token: viewer, query: { archived: 'all', page_size: 100 } })
        expect(all.data.meta.total).toBe(40)
        const live = await call('GET', '/molds', { token: viewer, query: { page_size: 100 } })
        expect(live.data.meta.total).toBe(37)
        const archived = await call('GET', '/molds', { token: viewer, query: { archived: 'true' } })
        expect(archived.data.meta.total).toBe(3)
    })

    it('creates with defaults, trims input and normalises money', async () => {
        const res = await call('POST', '/molds', { token: engineer, body: { code: '  C-1  ', name: ' Minimal ', cost: '1999.999', project: '  ' } })
        expect(res.status).toBe(201)
        expect(res.data.data).toMatchObject({ code: 'C-1', name: 'Minimal', status: 'trial', cavities: 1, cost: 2000, project: null, payment_status: 'unpaid', is_archived: false })
        expect(res.data.data.created_by_name).toBe('Anna Weber')
    })

    it('rejects duplicate codes (case-insensitive) and unknown suppliers', async () => {
        await call('POST', '/molds', { token: engineer, body: mold({ code: 'DUP-1' }) })
        const dup = await call('POST', '/molds', { token: engineer, body: mold({ code: 'dup-1' }) })
        expect(dup.status).toBe(409)
        const sup = await call('POST', '/molds', { token: engineer, body: mold({ code: 'S-1', supplier_id: 99999 }) })
        expect(sup.status).toBe(400)
        expect(sup.data.error.details[0].field).toBe('supplier_id')
    })

    const invalid = [
        ['missing code', { name: 'No code' }, 'code'],
        ['bad status', mold({ code: 'X-1', status: 'broken' }), 'status'],
        ['zero cavities', mold({ code: 'X-2', cavities: 0 }), 'cavities'],
        ['negative cost', mold({ code: 'X-3', cost: -1 }), 'cost'],
        ['impossible date', mold({ code: 'X-4', deadline: '2026-02-30' }), 'deadline'],
        ['deadline before start', mold({ code: 'X-5', start_date: '2026-05-01', deadline: '2026-04-01' }), 'deadline'],
    ]
    for (const [label, body, field] of invalid) {
        it(`validates ${label}`, async () => {
            const res = await call('POST', '/molds', { token: engineer, body })
            expect(res.status).toBe(400)
            expect(res.data.error.details.some((d) => d.field === field)).toBe(true)
        })
    }

    it('applies partial updates and re-validates dates against stored values', async () => {
        const { data } = await call('POST', '/molds', { token: engineer, body: mold({ code: 'U-1', project: 'Keep' }) })
        const id = data.data.id
        const upd = await call('PATCH', `/molds/${id}`, { token: engineer, body: { status: 'active', cost: 5 } })
        expect(upd.data.data).toMatchObject({ status: 'active', cost: 5, project: 'Keep' })
        expect((await call('PATCH', `/molds/${id}`, { token: engineer, body: { deadline: '2025-01-01' } })).status).toBe(400)
        expect((await call('PATCH', `/molds/${id}`, { token: engineer, body: {} })).status).toBe(400)
    })

    it('searches, filters, sorts and paginates', async () => {
        const page = await call('GET', '/molds', { token: viewer, query: { page_size: 5, page: 2, sort: 'code', order: 'asc' } })
        expect(page.data.data).toHaveLength(5)
        expect(page.data.meta).toEqual({ page: 2, page_size: 5, total: 37, total_pages: 8 })
        const codes = page.data.data.map((m) => m.code)
        expect(codes).toEqual([...codes].sort())
        const trial = await call('GET', '/molds', { token: viewer, query: { status: 'trial', page_size: 50 } })
        expect(trial.data.data.every((m) => m.status === 'trial')).toBe(true)
        const byCost = await call('GET', '/molds', { token: viewer, query: { sort: 'cost', order: 'desc', page_size: 50 } })
        const costs = byCost.data.data.map((m) => m.cost)
        expect(costs).toEqual([...costs].sort((a, b) => b - a))
        const search = await call('GET', '/molds', { token: viewer, query: { search: 'FAN SHROUD' } })
        expect(search.data.data.map((m) => m.name)).toEqual(['Fan shroud'])
        expect((await call('GET', '/molds', { token: viewer, query: { search: '%' } })).data.data).toHaveLength(0)
        expect((await call('GET', '/molds', { token: viewer, query: { sort: 'password' } })).status).toBe(400)
        expect((await call('GET', '/molds', { token: viewer, query: { page_size: 1000 } })).status).toBe(400)
    })

    it('archives (soft delete) and blocks edits until restored', async () => {
        const { data } = await call('POST', '/molds', { token: engineer, body: mold({ code: 'A-1' }) })
        const id = data.data.id
        await call('POST', `/molds/${id}/trials`, { token: engineer, body: { trial_date: '2026-02-01', quantity: 10 } })
        expect((await call('DELETE', `/molds/${id}`, { token: engineer })).status).toBe(204)
        expect((await call('DELETE', `/molds/${id}`, { token: engineer })).status).toBe(409)
        expect((await call('GET', '/molds', { token: viewer, query: { search: 'A-1' } })).data.data).toHaveLength(0)
        expect((await call('GET', `/molds/${id}`, { token: viewer })).data.data.trials).toHaveLength(1)
        expect((await call('PATCH', `/molds/${id}`, { token: engineer, body: { name: 'Edit' } })).status).toBe(409)
        expect((await call('POST', `/molds/${id}/trials`, { token: engineer, body: { trial_date: '2026-02-02' } })).status).toBe(409)
        expect((await call('POST', `/molds/${id}/restore`, { token: admin })).data.data.is_archived).toBe(false)
        expect((await call('POST', `/molds/${id}/restore`, { token: admin })).status).toBe(409)
    })
})

describe('demo backend: history records and totals', () => {
    it('creates, updates and deletes records and aggregates costs', async () => {
        const { data } = await call('POST', '/molds', { token: engineer, body: mold({ code: 'H-1', cost: 1000 }) })
        const id = data.data.id
        const trial = await call('POST', `/molds/${id}/trials`, { token: engineer, body: { trial_date: '2026-02-01', quantity: 120, outcome: 'conditional' } })
        expect(trial.status).toBe(201)
        expect((await call('PATCH', `/molds/${id}/trials/${trial.data.data.id}`, { token: engineer, body: { outcome: 'pass' } })).data.data).toMatchObject({ outcome: 'pass', quantity: 120 })
        await call('POST', `/molds/${id}/revisions`, { token: engineer, body: { revision_date: '2026-03-05', work_done: 'Add vents', cost: 250.5 } })
        await call('POST', `/molds/${id}/maintenance`, { token: engineer, body: { maintenance_date: '2026-04-01', description: 'Cleaning', cost: 80 } })
        const detail = (await call('GET', `/molds/${id}`, { token: viewer })).data.data
        expect(detail.totals).toMatchObject({ purchase_cost: 1000, revision_cost: 250.5, maintenance_cost: 80, total_cost: 1330.5, trial_shots: 120 })
        expect((await call('DELETE', `/molds/${id}/trials/${trial.data.data.id}`, { token: engineer })).status).toBe(204)
        expect((await call('DELETE', `/molds/${id}/trials/${trial.data.data.id}`, { token: engineer })).status).toBe(404)
    })

    it('validates records and keeps them scoped to their mold', async () => {
        const a = (await call('POST', '/molds', { token: engineer, body: mold({ code: 'H-2' }) })).data.data.id
        const b = (await call('POST', '/molds', { token: engineer, body: mold({ code: 'H-3' }) })).data.data.id
        expect((await call('POST', `/molds/${a}/trials`, { token: engineer, body: { quantity: 5 } })).status).toBe(400)
        expect((await call('POST', `/molds/${a}/revisions`, { token: engineer, body: { revision_date: '2026-02-01' } })).status).toBe(400)
        const rec = await call('POST', `/molds/${a}/revisions`, { token: engineer, body: { revision_date: '2026-03-01', work_done: 'Polish' } })
        expect((await call('PATCH', `/molds/${b}/revisions/${rec.data.data.id}`, { token: engineer, body: { cost: 1 } })).status).toBe(404)
    })
})

describe('demo backend: users, audit and dashboard', () => {
    it('manages users with the same protections as the server', async () => {
        const created = await call('POST', '/users', { token: admin, body: { username: 'New.User', password: 'Start-Pass1', full_name: 'New User', role: 'engineer' } })
        expect(created.status).toBe(201)
        expect(created.data.data.username).toBe('new.user')
        expect((await call('POST', '/users', { token: admin, body: { username: 'new.user', password: 'Start-Pass1', full_name: 'Dup' } })).status).toBe(409)
        const bad = await call('POST', '/users', { token: admin, body: { username: 'a', password: 'x', full_name: '', role: 'boss', email: 'nope' } })
        expect(bad.data.error.details.map((d) => d.field).sort()).toEqual(['email', 'full_name', 'password', 'role', 'username'])

        const me = (await call('GET', '/auth/me', { token: admin })).data.user
        expect((await call('PATCH', `/users/${me.id}`, { token: admin, body: { is_active: false } })).status).toBe(409)
        expect((await call('PATCH', `/users/${me.id}`, { token: admin, body: { role: 'viewer' } })).status).toBe(409)

        const reset = await call('POST', `/users/${created.data.data.id}/reset-password`, { token: admin, body: { new_password: 'Reset-Pass9' } })
        expect(reset.status).toBe(204)
        expect((await call('POST', '/auth/login', { body: { username: 'new.user', password: 'Reset-Pass9' } })).status).toBe(200)
    })

    it('records an audit trail for writes and failed sign-ins', async () => {
        const { data } = await call('POST', '/molds', { token: engineer, body: mold({ code: 'AU-1' }) })
        await call('PATCH', `/molds/${data.data.id}`, { token: engineer, body: { status: 'active' } })
        await call('POST', '/auth/login', { body: { username: 'engineer', password: 'wrong-pass1' } })
        const activity = await call('GET', '/logs/activity', { token: admin, query: { search: 'AU-1', page_size: 50 } })
        const actions = activity.data.data.map((a) => a.action)
        expect(actions).toEqual(expect.arrayContaining(['mold.create', 'mold.update']))
        expect(activity.data.data.find((a) => a.action === 'mold.create').user_name).toBe('Anna Weber')
        const failed = await call('GET', '/logs/logins', { token: admin, query: { success: 'false', search: 'engineer' } })
        expect(failed.data.data[0]).toMatchObject({ username: 'engineer', success: false })
        expect((await call('GET', '/logs/activity', { token: viewer })).status).toBe(403)
    })

    it('computes the dashboard from the data', async () => {
        const res = await call('GET', '/stats/dashboard', { token: viewer })
        const d = res.data.data
        expect(d.kpis.total_molds).toBe(37)
        expect(d.status_distribution.reduce((n, s) => n + s.count, 0)).toBe(37)
        expect(d.kpis.total_cost).toBeCloseTo(d.kpis.purchase_cost + d.kpis.revision_cost + d.kpis.maintenance_cost, 2)
        expect(d.cost_by_supplier.reduce((n, s) => n + s.mold_cost, 0)).toBeCloseTo(d.kpis.purchase_cost, 2)
        expect(d.upcoming_deadlines.length).toBeGreaterThan(0)
        expect(d.upcoming_deadlines.every((m) => ['trial', 'revision', 'maintenance'].includes(m.status))).toBe(true)
        expect(d.upcoming_deadlines.map((m) => m.deadline)).toEqual([...d.upcoming_deadlines.map((m) => m.deadline)].sort())
        expect(d.maintenance_due.every((m) => m.status !== 'completed')).toBe(true)
        expect(d.recent_activity.length).toBe(8)
    })

    it('manages suppliers', async () => {
        const created = await call('POST', '/suppliers', { token: engineer, body: { name: 'Fresh Supplier' } })
        expect(created.status).toBe(201)
        expect((await call('POST', '/suppliers', { token: engineer, body: { name: 'fresh supplier' } })).status).toBe(409)
        expect((await call('POST', '/suppliers', { token: viewer, body: { name: 'Nope' } })).status).toBe(403)
        expect((await call('GET', '/suppliers', { token: viewer })).data.data.some((s) => s.name === 'Fresh Supplier')).toBe(true)
    })

    it('answers unknown routes with the standard error shape and resets on demand', async () => {
        const res = await call('GET', '/nothing-here', { token: viewer })
        expect(res.status).toBe(404)
        expect(res.data.error.code).toBe('not_found')

        await call('POST', '/molds', { token: engineer, body: mold({ code: 'RESET-1' }) })
        await resetDemo()
        const s = await getState()
        expect(s.molds.some((m) => m.code === 'RESET-1')).toBe(false)
        expect(s.molds).toHaveLength(40)
    })
})
