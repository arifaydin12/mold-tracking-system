// In-browser implementation of the Mold Tracking REST API used by the static demo.
// It mirrors the real backend: same routes, zod validation (demo/schemas.js is a generated copy of the server's schemas),
// role matrix, soft-delete rules, audit logging and error format. Data lives in localStorage (see store.js).
import registry from './schemas.js'
import { can } from '../utils/permissions.js'
import { getState, commit, nextId, hashPassword, SESSION_KEY } from './store.js'

const { schemas } = registry

export class ApiError extends Error {
    constructor(status, code, message, details) {
        super(message)
        this.status = status
        this.code = code
        this.details = details
    }
}
const badRequest = (m, d) => new ApiError(400, 'bad_request', m, d)
const unauthorized = (m = 'Authentication required') => new ApiError(401, 'unauthorized', m)
const forbidden = () => new ApiError(403, 'forbidden', 'You do not have permission to perform this action')
const notFound = (what) => new ApiError(404, 'not_found', `${what} not found`)
const conflict = (m) => new ApiError(409, 'conflict', m)
const validationFailed = (field, message, where = 'body') => new ApiError(400, 'validation_error', 'Validation failed', [{ field, message, in: where }])

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const nowIso = () => new Date().toISOString()
const todayStr = () => new Date().toISOString().slice(0, 10)
const addDays = (dateStr, n) => new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const diffDays = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100
const lc = (s) => String(s ?? '').toLowerCase()

// ---- helpers shared by the handlers ------------------------------------------------------------------------------

function meta(page, pageSize, total) {
    return { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) }
}

function paginate(rows, q) {
    const start = (q.page - 1) * q.page_size
    return { data: rows.slice(start, start + q.page_size), meta: meta(q.page, q.page_size, rows.length) }
}

/** Case-insensitive comparison with nulls last (like ORDER BY ... NULLS LAST). */
function compare(a, b, dir) {
    const mult = dir === 'asc' ? 1 : -1
    const an = a === null || a === undefined
    const bn = b === null || b === undefined
    if (an || bn) return an === bn ? 0 : an ? 1 : -1
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * mult
    return String(a).toLowerCase().localeCompare(String(b).toLowerCase()) * mult
}

function log(s, user, action, entityType, entityId, description) {
    s.activity.push({
        id: nextId(s, 'activity'),
        user_id: user?.id ?? null,
        action,
        entity_type: entityType,
        entity_id: entityId,
        description,
        created_at: nowIso(),
    })
}

const publicUser = (u) => {
    const { password_hash, ...rest } = u // eslint-disable-line no-unused-vars
    return clone(rest)
}

function sessionResponse(user) {
    const token = `demo.${user.id}.${Date.now().toString(36)}`
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user_id: user.id }))
    return { status: 200, data: { access_token: token, token_type: 'Bearer', expires_in: '15m', user: publicUser(user) } }
}

function moldRow(s, m) {
    const supplier = s.suppliers.find((x) => x.id === m.supplier_id)
    const revs = s.revisions.filter((r) => r.mold_id === m.id)
    return {
        ...m,
        supplier_name: supplier ? supplier.name : null,
        trial_count: s.trials.filter((t) => t.mold_id === m.id).length,
        revision_count: revs.length,
        maintenance_count: s.maintenance.filter((x) => x.mold_id === m.id).length,
        revision_cost: round2(revs.reduce((n, r) => n + Number(r.cost), 0)),
    }
}

const byDateDesc = (field) => (a, b) => (a[field] < b[field] ? 1 : a[field] > b[field] ? -1 : b.id - a.id)

function moldDetail(s, m) {
    const row = moldRow(s, m)
    const trials = s.trials.filter((t) => t.mold_id === m.id).sort(byDateDesc('trial_date'))
    const revisions = s.revisions.filter((r) => r.mold_id === m.id).sort(byDateDesc('revision_date'))
    const maintenance = s.maintenance.filter((x) => x.mold_id === m.id).sort(byDateDesc('maintenance_date'))
    const sum = (rows) => round2(rows.reduce((n, r) => n + Number(r.cost || 0), 0))
    const name = (id) => s.users.find((u) => u.id === id)?.full_name ?? null
    return clone({
        ...row,
        created_by_name: name(m.created_by),
        updated_by_name: name(m.updated_by),
        trials,
        revisions,
        maintenance,
        totals: {
            purchase_cost: m.cost,
            revision_cost: sum(revisions),
            maintenance_cost: sum(maintenance),
            total_cost: round2(Number(m.cost) + sum(revisions) + sum(maintenance)),
            trial_shots: trials.reduce((n, t) => n + t.quantity, 0),
        },
    })
}

function findMold(s, id) {
    const m = s.molds.find((x) => x.id === id)
    if (!m) throw notFound('Mold')
    return m
}

function assertEditable(s, id) {
    const m = findMold(s, id)
    if (m.is_archived) throw conflict('This mold is archived. Restore it before making changes.')
    return m
}

function assertSupplier(s, supplierId) {
    if (supplierId === null || supplierId === undefined) return
    if (!s.suppliers.some((x) => x.id === supplierId)) throw validationFailed('supplier_id', 'Supplier does not exist')
}

const codeTaken = (s, code, exceptId) => s.molds.some((m) => lc(m.code) === lc(code) && m.id !== exceptId)

// ---- route handlers ----------------------------------------------------------------------------------------------

const routes = []
const route = (method, pattern, opts, handler) => {
    const keys = []
    const regex = new RegExp(`^${pattern.replace(/:([a-zA-Z]+)/g, (_, k) => (keys.push(k), '([^/]+)'))}/?$`)
    routes.push({ method, regex, keys, opts, handler })
}

route('GET', '/health', { auth: false }, () => ({ status: 200, data: { status: 'ok', uptime_seconds: 0, database: 'up' } }))

// auth
route('POST', '/auth/login', { auth: false, body: schemas.login }, async ({ s, body }) => {
    const name = body.username.trim().toLowerCase()
    const user = s.users.find((u) => u.username === name)
    const ok = user && user.password_hash === (await hashPassword(body.password))
    const login = (success) =>
        s.logins.push({
            id: nextId(s, 'logins'),
            user_id: user?.id ?? null,
            username: name,
            success,
            ip_address: 'browser',
            user_agent: navigator.userAgent.slice(0, 255),
            created_at: nowIso(),
        })
    if (!user || !ok || !user.is_active) {
        login(false)
        commit()
        throw unauthorized('Invalid username or password')
    }
    user.last_login_at = nowIso()
    login(true)
    commit()
    return sessionResponse(user)
})
route('POST', '/auth/refresh', { auth: false }, ({ s }) => {
    let session = null
    try {
        session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    } catch {
        /* ignore */
    }
    const user = session && s.users.find((u) => u.id === session.user_id)
    if (!user || !user.is_active) {
        localStorage.removeItem(SESSION_KEY)
        throw unauthorized('No refresh token')
    }
    return sessionResponse(user)
})
route('POST', '/auth/logout', { auth: false }, () => {
    localStorage.removeItem(SESSION_KEY)
    return { status: 204 }
})
route('GET', '/auth/me', {}, ({ user }) => ({ status: 200, data: { user: publicUser(user) } }))
route('PATCH', '/auth/me', { body: schemas.updateProfile }, ({ s, user, body }) => {
    for (const k of ['full_name', 'email', 'department']) if (body[k] !== undefined) user[k] = body[k]
    user.updated_at = nowIso()
    log(s, user, 'user.update_profile', 'user', user.id, 'Updated own profile')
    commit()
    return { status: 200, data: { user: publicUser(user) } }
})
route('POST', '/auth/change-password', { body: schemas.changePassword }, async ({ s, user, body }) => {
    if (user.password_hash !== (await hashPassword(body.current_password))) {
        throw badRequest('Current password is incorrect', [{ field: 'current_password', message: 'Current password is incorrect', in: 'body' }])
    }
    user.password_hash = await hashPassword(body.new_password)
    user.updated_at = nowIso()
    log(s, user, 'auth.change_password', 'user', user.id, 'Changed own password')
    commit()
    return sessionResponse(user)
})

// molds
route('GET', '/molds', { perm: 'molds:read', query: schemas.listMolds }, ({ s, query: q }) => {
    let rows = s.molds.map((m) => moldRow(s, m))
    if (q.archived === 'false') rows = rows.filter((m) => !m.is_archived)
    else if (q.archived === 'true') rows = rows.filter((m) => m.is_archived)
    if (q.search) {
        const needle = lc(q.search)
        rows = rows.filter((m) => [m.code, m.name, m.project, m.material, m.supplier_name].some((v) => lc(v).includes(needle)))
    }
    if (q.status) rows = rows.filter((m) => m.status === q.status)
    if (q.supplier_id) rows = rows.filter((m) => m.supplier_id === q.supplier_id)
    if (q.payment_status) rows = rows.filter((m) => m.payment_status === q.payment_status)
    const key = q.sort === 'supplier' ? 'supplier_name' : q.sort
    rows.sort((a, b) => compare(a[key], b[key], q.order) || (q.order === 'asc' ? a.id - b.id : b.id - a.id))
    return { status: 200, data: clone(paginate(rows, q)) }
})
route('POST', '/molds', { perm: 'molds:write', body: schemas.createMold }, ({ s, user, body }) => {
    assertSupplier(s, body.supplier_id)
    if (codeTaken(s, body.code)) throw conflict('A mold with this code already exists')
    const mold = { id: nextId(s, 'molds'), ...body, is_archived: false, archived_at: null, created_by: user.id, updated_by: null, created_at: nowIso(), updated_at: null }
    s.molds.push(mold)
    log(s, user, 'mold.create', 'mold', mold.id, `Created mold ${mold.code} - ${mold.name}`)
    commit()
    return { status: 201, data: { data: moldDetail(s, mold) } }
})
route('GET', '/molds/:id', { perm: 'molds:read', params: schemas.idParams }, ({ s, params }) => ({
    status: 200,
    data: { data: moldDetail(s, findMold(s, params.id)) },
}))
route('PATCH', '/molds/:id', { perm: 'molds:write', params: schemas.idParams, body: schemas.updateMold }, ({ s, user, params, body }) => {
    const mold = assertEditable(s, params.id)
    assertSupplier(s, body.supplier_id)
    const start = body.start_date !== undefined ? body.start_date : mold.start_date
    const deadline = body.deadline !== undefined ? body.deadline : mold.deadline
    if (start && deadline && deadline < start) throw validationFailed('deadline', 'Deadline must not be before the start date')
    if (body.code !== undefined && codeTaken(s, body.code, mold.id)) throw conflict('A mold with this code already exists')
    const before = mold.code
    Object.assign(mold, body, { updated_by: user.id, updated_at: nowIso() })
    log(s, user, 'mold.update', 'mold', mold.id, `Updated mold ${before} (${Object.keys(body).join(', ')})`)
    commit()
    return { status: 200, data: { data: moldDetail(s, mold) } }
})
route('DELETE', '/molds/:id', { perm: 'molds:archive', params: schemas.idParams }, ({ s, user, params }) => {
    const mold = findMold(s, params.id)
    if (mold.is_archived) throw conflict('Mold is already archived')
    Object.assign(mold, { is_archived: true, archived_at: nowIso(), updated_by: user.id, updated_at: nowIso() })
    log(s, user, 'mold.archive', 'mold', mold.id, `Archived mold ${mold.code}`)
    commit()
    return { status: 204 }
})
route('POST', '/molds/:id/restore', { perm: 'molds:restore', params: schemas.idParams }, ({ s, user, params }) => {
    const mold = findMold(s, params.id)
    if (!mold.is_archived) throw conflict('Mold is not archived')
    Object.assign(mold, { is_archived: false, archived_at: null, updated_by: user.id, updated_at: nowIso() })
    log(s, user, 'mold.restore', 'mold', mold.id, `Restored mold ${mold.code}`)
    commit()
    return { status: 200, data: { data: moldDetail(s, mold) } }
})

// trials / revisions / maintenance share one implementation
function mountRecords(segment, cfg) {
    const { collection, entity, label, dateField, columns, createSchema, updateSchema, summarize } = cfg
    const find = (s, moldId, recordId) => {
        const rec = s[collection].find((r) => r.id === recordId && r.mold_id === moldId)
        if (!rec) throw notFound(label)
        return rec
    }
    route('GET', `/molds/:id/${segment}`, { perm: 'molds:read', params: schemas.idParams }, ({ s, params }) => {
        findMold(s, params.id)
        const rows = s[collection].filter((r) => r.mold_id === params.id).sort(byDateDesc(dateField))
        return { status: 200, data: { data: clone(rows) } }
    })
    route('POST', `/molds/:id/${segment}`, { perm: 'records:write', params: schemas.idParams, body: createSchema }, ({ s, user, params, body }) => {
        const mold = assertEditable(s, params.id)
        const rec = { id: nextId(s, collection), mold_id: mold.id }
        for (const c of columns) rec[c] = body[c] ?? null
        s[collection].push(rec)
        log(s, user, `${entity}.create`, entity, rec.id, `Added ${label.toLowerCase()} to mold ${mold.code}: ${summarize(body)}`)
        commit()
        return { status: 201, data: { data: clone(rec) } }
    })
    route('PATCH', `/molds/:id/${segment}/:recordId`, { perm: 'records:write', params: schemas.childParams, body: updateSchema }, ({ s, user, params, body }) => {
        const mold = assertEditable(s, params.id)
        const rec = find(s, mold.id, params.recordId)
        for (const c of columns) if (body[c] !== undefined) rec[c] = body[c]
        log(s, user, `${entity}.update`, entity, rec.id, `Updated ${label.toLowerCase()} of mold ${mold.code} (${Object.keys(body).join(', ')})`)
        commit()
        return { status: 200, data: { data: clone(rec) } }
    })
    route('DELETE', `/molds/:id/${segment}/:recordId`, { perm: 'records:delete', params: schemas.childParams }, ({ s, user, params }) => {
        const mold = assertEditable(s, params.id)
        const rec = find(s, mold.id, params.recordId)
        s[collection] = s[collection].filter((r) => r !== rec)
        log(s, user, `${entity}.delete`, entity, rec.id, `Deleted ${label.toLowerCase()} of mold ${mold.code}`)
        commit()
        return { status: 204 }
    })
}

mountRecords('trials', {
    collection: 'trials',
    entity: 'trial',
    label: 'Trial',
    dateField: 'trial_date',
    columns: ['trial_date', 'material', 'color', 'quantity', 'outcome', 'result', 'operator'],
    createSchema: schemas.createTrial,
    updateSchema: schemas.updateTrial,
    summarize: (d) => `${d.trial_date}, ${d.quantity ?? 0} pcs, ${d.outcome}`,
})
mountRecords('revisions', {
    collection: 'revisions',
    entity: 'revision',
    label: 'Revision',
    dateField: 'revision_date',
    columns: ['revision_date', 'vendor', 'work_done', 'cost', 'payment_status', 'notes'],
    createSchema: schemas.createRevision,
    updateSchema: schemas.updateRevision,
    summarize: (d) => `${d.revision_date}, ${String(d.work_done).slice(0, 60)}`,
})
mountRecords('maintenance', {
    collection: 'maintenance',
    entity: 'maintenance',
    label: 'Maintenance record',
    dateField: 'maintenance_date',
    columns: ['maintenance_date', 'description', 'technician', 'status', 'cost'],
    createSchema: schemas.createMaintenance,
    updateSchema: schemas.updateMaintenance,
    summarize: (d) => `${d.maintenance_date}, ${d.status}`,
})

// suppliers
const supplierRow = (s, x) => ({ ...x, mold_count: s.molds.filter((m) => m.supplier_id === x.id && !m.is_archived).length })
route('GET', '/suppliers', { perm: 'molds:read' }, ({ s }) => ({
    status: 200,
    data: { data: clone([...s.suppliers].sort((a, b) => compare(a.name, b.name, 'asc')).map((x) => supplierRow(s, x))) },
}))
route('POST', '/suppliers', { perm: 'suppliers:write', body: schemas.createSupplier }, ({ s, user, body }) => {
    if (s.suppliers.some((x) => lc(x.name) === lc(body.name))) throw conflict('A supplier with this name already exists')
    const sup = { id: nextId(s, 'suppliers'), ...body, created_at: nowIso() }
    s.suppliers.push(sup)
    log(s, user, 'supplier.create', 'supplier', sup.id, `Created supplier ${sup.name}`)
    commit()
    return { status: 201, data: { data: clone(sup) } }
})
route('PATCH', '/suppliers/:id', { perm: 'suppliers:write', params: schemas.idParams, body: schemas.updateSupplier }, ({ s, user, params, body }) => {
    const sup = s.suppliers.find((x) => x.id === params.id)
    if (!sup) throw notFound('Supplier')
    if (body.name !== undefined && s.suppliers.some((x) => lc(x.name) === lc(body.name) && x.id !== sup.id)) throw conflict('A supplier with this name already exists')
    Object.assign(sup, body)
    log(s, user, 'supplier.update', 'supplier', sup.id, `Updated supplier ${sup.name}`)
    commit()
    return { status: 200, data: { data: clone(sup) } }
})

// users
const countOtherActiveAdmins = (s, exceptId) => s.users.filter((u) => u.role === 'admin' && u.is_active && u.id !== exceptId).length
route('GET', '/users', { perm: 'users:manage', query: schemas.listUsers }, ({ s, query: q }) => {
    let rows = s.users
    if (q.search) {
        const n = lc(q.search)
        rows = rows.filter((u) => [u.username, u.full_name, u.email].some((v) => lc(v).includes(n)))
    }
    if (q.role) rows = rows.filter((u) => u.role === q.role)
    if (q.is_active !== undefined) rows = rows.filter((u) => u.is_active === q.is_active)
    rows = [...rows].sort((a, b) => compare(a[q.sort], b[q.sort], q.order) || a.id - b.id)
    const page = paginate(rows, q)
    return { status: 200, data: { data: page.data.map(publicUser), meta: page.meta } }
})
route('POST', '/users', { perm: 'users:manage', body: schemas.createUser }, async ({ s, user, body }) => {
    if (s.users.some((u) => u.username === body.username)) throw conflict('This username is already taken')
    const created = {
        id: nextId(s, 'users'),
        username: body.username,
        password_hash: await hashPassword(body.password),
        full_name: body.full_name,
        email: body.email,
        department: body.department,
        role: body.role,
        is_active: true,
        created_at: nowIso(),
        updated_at: null,
        last_login_at: null,
    }
    s.users.push(created)
    log(s, user, 'user.create', 'user', created.id, `Created user ${created.username} (${created.role})`)
    commit()
    return { status: 201, data: { data: publicUser(created) } }
})
route('GET', '/users/:id', { perm: 'users:manage', params: schemas.idParams }, ({ s, params }) => {
    const u = s.users.find((x) => x.id === params.id)
    if (!u) throw notFound('User')
    return { status: 200, data: { data: publicUser(u) } }
})
route('PATCH', '/users/:id', { perm: 'users:manage', params: schemas.idParams, body: schemas.updateUser }, ({ s, user, params, body }) => {
    const target = s.users.find((x) => x.id === params.id)
    if (!target) throw notFound('User')
    const losesAdmin = target.role === 'admin' && target.is_active && (body.role === 'viewer' || body.role === 'engineer' || body.is_active === false)
    if (losesAdmin) {
        if (target.id === user.id) throw conflict('You cannot demote or deactivate your own account')
        if (countOtherActiveAdmins(s, target.id) === 0) throw conflict('The last active administrator cannot be demoted or deactivated')
    }
    if (target.id === user.id && body.is_active === false) throw conflict('You cannot deactivate your own account')
    const wasActive = target.is_active
    Object.assign(target, body, { updated_at: nowIso() })
    const action = body.is_active === false ? 'user.deactivate' : body.is_active === true && !wasActive ? 'user.activate' : 'user.update'
    log(s, user, action, 'user', target.id, `Updated user ${target.username} (${Object.keys(body).join(', ')})`)
    commit()
    return { status: 200, data: { data: publicUser(target) } }
})
route('POST', '/users/:id/reset-password', { perm: 'users:manage', params: schemas.idParams, body: schemas.resetPassword }, async ({ s, user, params, body }) => {
    const target = s.users.find((x) => x.id === params.id)
    if (!target) throw notFound('User')
    target.password_hash = await hashPassword(body.new_password)
    target.updated_at = nowIso()
    log(s, user, 'user.reset_password', 'user', target.id, `Reset password of ${target.username}`)
    commit()
    return { status: 204 }
})

// stats + logs
route('GET', '/stats/dashboard', { perm: 'molds:read' }, ({ s }) => {
    const today = todayStr()
    const live = s.molds.filter((m) => !m.is_archived)
    const liveIds = new Set(live.map((m) => m.id))
    const open = (m) => ['trial', 'revision', 'maintenance'].includes(m.status)
    const revisions = s.revisions.filter((r) => liveIds.has(r.mold_id))
    const maint = s.maintenance.filter((x) => liveIds.has(x.mold_id))
    const purchase = live.reduce((n, m) => n + Number(m.cost), 0)
    const revCost = revisions.reduce((n, r) => n + Number(r.cost), 0)
    const maintCost = maint.reduce((n, x) => n + Number(x.cost), 0)
    const maintDue = maint.filter((x) => x.status !== 'completed' && x.maintenance_date <= addDays(today, 30))

    const statusCounts = {}
    live.forEach((m) => (statusCounts[m.status] = (statusCounts[m.status] || 0) + 1))

    const bySupplier = new Map()
    for (const m of live) {
        const name = s.suppliers.find((x) => x.id === m.supplier_id)?.name ?? 'Unassigned'
        const entry = bySupplier.get(name) || { supplier: name, mold_cost: 0, revision_cost: 0, molds: 0 }
        entry.mold_cost += Number(m.cost)
        entry.revision_cost += s.revisions.filter((r) => r.mold_id === m.id).reduce((n, r) => n + Number(r.cost), 0)
        entry.molds += 1
        bySupplier.set(name, entry)
    }

    const codeOf = (id) => s.molds.find((m) => m.id === id)
    const userName = (id) => s.users.find((u) => u.id === id)?.full_name ?? null
    return {
        status: 200,
        data: {
            data: clone({
                kpis: {
                    total_molds: live.length,
                    active_molds: live.filter((m) => m.status === 'active').length,
                    in_revision: live.filter((m) => m.status === 'revision').length,
                    overdue_deadlines: live.filter((m) => open(m) && m.deadline && m.deadline < today).length,
                    due_soon: live.filter((m) => open(m) && m.deadline && m.deadline >= today && m.deadline <= addDays(today, 14)).length,
                    unpaid_molds: live.filter((m) => m.payment_status !== 'paid').length,
                    maintenance_due: maintDue.length,
                    purchase_cost: round2(purchase),
                    revision_cost: round2(revCost),
                    maintenance_cost: round2(maintCost),
                    total_cost: round2(purchase + revCost + maintCost),
                },
                status_distribution: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
                cost_by_supplier: [...bySupplier.values()]
                    .map((e) => ({ ...e, mold_cost: round2(e.mold_cost), revision_cost: round2(e.revision_cost), total_cost: round2(e.mold_cost + e.revision_cost) }))
                    .sort((a, b) => b.total_cost - a.total_cost),
                upcoming_deadlines: live
                    .filter((m) => open(m) && m.deadline && m.deadline <= addDays(today, 45))
                    .sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : a.id - b.id))
                    .slice(0, 8)
                    .map((m) => ({
                        id: m.id,
                        code: m.code,
                        name: m.name,
                        status: m.status,
                        deadline: m.deadline,
                        supplier_name: s.suppliers.find((x) => x.id === m.supplier_id)?.name ?? null,
                        days_left: diffDays(m.deadline, today),
                    })),
                maintenance_due: maintDue
                    .sort((a, b) => (a.maintenance_date < b.maintenance_date ? -1 : a.maintenance_date > b.maintenance_date ? 1 : a.id - b.id))
                    .slice(0, 8)
                    .map((x) => ({
                        id: x.id,
                        mold_id: x.mold_id,
                        code: codeOf(x.mold_id).code,
                        name: codeOf(x.mold_id).name,
                        due_date: x.maintenance_date,
                        status: x.status,
                        description: x.description,
                        days_left: diffDays(x.maintenance_date, today),
                    })),
                recent_activity: [...s.activity]
                    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
                    .slice(0, 8)
                    .map((a) => ({ ...a, user_name: userName(a.user_id) })),
            }),
        },
    }
})

route('GET', '/logs/activity', { perm: 'logs:read', query: schemas.listActivityLogs }, ({ s, query: q }) => {
    const userOf = (id) => s.users.find((u) => u.id === id)
    let rows = s.activity.map((a) => ({ ...a, user_name: userOf(a.user_id)?.full_name ?? null, username: userOf(a.user_id)?.username ?? null }))
    if (q.user_id) rows = rows.filter((a) => a.user_id === q.user_id)
    if (q.action) rows = rows.filter((a) => a.action === q.action)
    if (q.entity_type) rows = rows.filter((a) => a.entity_type === q.entity_type)
    if (q.from) rows = rows.filter((a) => Date.parse(a.created_at) >= Date.parse(q.from))
    if (q.to) rows = rows.filter((a) => Date.parse(a.created_at) <= Date.parse(q.to))
    if (q.search) {
        const n = lc(q.search)
        rows = rows.filter((a) => [a.description, a.action, a.user_name].some((v) => lc(v).includes(n)))
    }
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    return { status: 200, data: clone(paginate(rows, q)) }
})
route('GET', '/logs/logins', { perm: 'logs:read', query: schemas.listLoginLogs }, ({ s, query: q }) => {
    let rows = [...s.logins]
    if (q.success !== undefined) rows = rows.filter((l) => l.success === q.success)
    if (q.from) rows = rows.filter((l) => Date.parse(l.created_at) >= Date.parse(q.from))
    if (q.to) rows = rows.filter((l) => Date.parse(l.created_at) <= Date.parse(q.to))
    if (q.search) {
        const n = lc(q.search)
        rows = rows.filter((l) => [l.username, l.ip_address].some((v) => lc(v).includes(n)))
    }
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id))
    return { status: 200, data: clone(paginate(rows, q)) }
})

// ---- request pipeline --------------------------------------------------------------------------------------------

function validate(opts, input) {
    const details = []
    const out = {}
    for (const part of ['params', 'query', 'body']) {
        if (!opts[part]) continue
        const result = opts[part].safeParse(input[part])
        if (result.success) out[part] = result.data
        else {
            const seen = new Set()
            for (const issue of result.error.issues) {
                const field = issue.path.join('.') || '_'
                if (seen.has(field)) continue
                seen.add(field)
                details.push({ field, message: issue.message, in: part })
            }
        }
    }
    if (details.length) throw new ApiError(400, 'validation_error', 'Validation failed', details)
    return out
}

function authenticate(s, authorization) {
    const [scheme, token] = String(authorization || '').split(' ')
    const m = scheme === 'Bearer' && /^demo\.(\d+)\./.exec(token || '')
    if (!m) throw unauthorized()
    const user = s.users.find((u) => u.id === Number(m[1]))
    if (!user || !user.is_active) throw unauthorized('Account is disabled or no longer exists')
    return user
}

/**
 * Handles one API call. `path` is relative to /api (e.g. "/molds/3/trials").
 * Returns { status, data } or throws ApiError.
 */
export async function handleRequest({ method, path, query = {}, body, authorization }) {
    const s = await getState()
    const m = method.toUpperCase()
    const cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/'

    for (const r of routes) {
        if (r.method !== m) continue
        const match = r.regex.exec(cleanPath)
        if (!match) continue

        const user = r.opts.auth === false ? null : authenticate(s, authorization)
        if (r.opts.perm && !can(user.role, r.opts.perm)) throw forbidden()

        const rawParams = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]))
        const strQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]))
        const parsed = validate(r.opts, { params: rawParams, query: strQuery, body: body === undefined ? {} : body })
        return r.handler({ s, user, params: parsed.params || rawParams, query: parsed.query || strQuery, body: parsed.body || body || {} })
    }
    throw new ApiError(404, 'not_found', `Route not found: ${m} /api${cleanPath}`)
}
