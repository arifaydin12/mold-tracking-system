// In-browser "database" for the demo build: seeded from database/seed-data.json (the same file that
// feeds `npm run seed`), persisted in localStorage and resettable from the UI.
import seed from '../../../database/seed-data.json'

const STORAGE_KEY = 'mts.demo.db.v1'
export const SESSION_KEY = 'mts.demo.session'
export const DEMO_PASSWORD = 'Demo-2026'

const DAY = 86400000

/** Salted SHA-256 via WebCrypto, with a tiny fallback for environments without crypto.subtle. */
export async function hashPassword(password) {
    const salted = `mts-demo:${password}`
    if (globalThis.crypto?.subtle) {
        const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted))
        return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    }
    let h = 2166136261
    for (let i = 0; i < salted.length; i++) h = Math.imul(h ^ salted.charCodeAt(i), 16777619)
    return `fnv-${(h >>> 0).toString(16)}`
}

const isoDate = (base, offsetDays) => new Date(base + offsetDays * DAY).toISOString().slice(0, 10)

/** Builds a fresh database whose dates are relative to `now`. */
export async function buildSeedState(now = Date.now()) {
    const today = Date.parse(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z')
    const passwordHash = await hashPassword(DEMO_PASSWORD)
    const ids = { users: 0, suppliers: 0, molds: 0, trials: 0, revisions: 0, maintenance: 0, activity: 0, logins: 0 }
    const next = (k) => ++ids[k]

    const users = seed.users.map((u) => ({
        id: next('users'),
        username: u.username,
        password_hash: passwordHash,
        full_name: u.full_name,
        email: u.email,
        department: u.department,
        role: u.role,
        is_active: u.is_active !== false,
        created_at: new Date(now - 700 * DAY).toISOString(),
        updated_at: null,
        last_login_at: u.is_active === false ? null : new Date(now - 3600000).toISOString(),
    }))
    const userId = Object.fromEntries(users.map((u) => [u.username, u.id]))

    const suppliers = seed.suppliers.map((s) => ({
        id: next('suppliers'),
        name: s.name,
        country: s.country,
        contact_email: s.contact_email,
        created_at: new Date(now - 700 * DAY).toISOString(),
    }))
    const supplierId = Object.fromEntries(suppliers.map((s) => [s.name, s.id]))

    const molds = []
    const trials = []
    const revisions = []
    const maintenance = []
    const moldId = {}
    for (const m of seed.molds) {
        const id = next('molds')
        moldId[m.code] = id
        molds.push({
            id,
            code: m.code,
            name: m.name,
            project: m.project,
            status: m.status,
            supplier_id: supplierId[m.supplier] ?? null,
            cavities: m.cavities,
            material: m.material,
            start_date: isoDate(today, m.start_offset),
            deadline: m.deadline_offset === null ? null : isoDate(today, m.deadline_offset),
            cost: m.cost,
            payment_status: m.payment_status,
            notes: m.notes,
            is_archived: Boolean(m.archived),
            archived_at: m.archived ? new Date(now - 5 * DAY).toISOString() : null,
            created_by: userId[m.created_by] ?? null,
            updated_by: null,
            created_at: new Date(today + m.start_offset * DAY).toISOString(),
            updated_at: null,
        })
        for (const t of m.trials) {
            trials.push({ id: next('trials'), mold_id: id, trial_date: isoDate(today, t.offset), material: t.material, color: t.color, quantity: t.quantity, outcome: t.outcome, result: t.result, operator: t.operator })
        }
        for (const r of m.revisions) {
            revisions.push({ id: next('revisions'), mold_id: id, revision_date: isoDate(today, r.offset), vendor: r.vendor, work_done: r.work_done, cost: r.cost, payment_status: r.payment_status, notes: r.notes })
        }
        for (const x of m.maintenance) {
            maintenance.push({ id: next('maintenance'), mold_id: id, maintenance_date: isoDate(today, x.offset), description: x.description, technician: x.technician, status: x.status, cost: x.cost })
        }
    }

    const activity = seed.activity.map((a) => ({
        id: next('activity'),
        user_id: userId[a.user] ?? null,
        action: a.action,
        entity_type: a.entity_type,
        entity_id: a.mold_code ? moldId[a.mold_code] ?? null : null,
        description: a.description,
        created_at: new Date(now + a.offset_minutes * 60000).toISOString(),
    }))
    const logins = seed.logins.map((l) => ({
        id: next('logins'),
        user_id: l.known ? userId[l.username] ?? null : null,
        username: l.username,
        success: l.success,
        ip_address: l.ip_address,
        user_agent: l.user_agent,
        created_at: new Date(now + l.offset_minutes * 60000).toISOString(),
    }))

    return { users, suppliers, molds, trials, revisions, maintenance, activity, logins, ids, seeded_at: new Date(now).toISOString() }
}

let state = null

function save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
        /* storage full or blocked: keep working in memory */
    }
}

/** Returns the live state, loading it from localStorage or seeding it on first use. */
export async function getState() {
    if (state) return state
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
            state = JSON.parse(raw)
            return state
        }
    } catch {
        /* corrupted or unavailable storage: reseed */
    }
    state = await buildSeedState()
    save()
    return state
}

/** Call after mutating the state returned by getState(). */
export const commit = save

export async function resetDemo() {
    state = await buildSeedState()
    localStorage.removeItem(SESSION_KEY)
    save()
    return state
}

/** Test helper: forget the in-memory copy (and storage) so the next call reseeds. */
export function _forgetState() {
    state = null
    try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(SESSION_KEY)
    } catch {
        /* ignore */
    }
}

export const nextId = (s, key) => ++s.ids[key]
