const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { loadConfig } = require('../config/env');
const { getPool, sql } = require('./pool');

const SEED_FILE = path.join(__dirname, '..', '..', 'database', 'seed-data.json');

const DAY = 24 * 60 * 60 * 1000;
const dateOnly = (base, offsetDays) => new Date(base + offsetDays * DAY).toISOString().slice(0, 10);

// Children first, so foreign keys never block the cleanup.
const TABLES = ['login_logs', 'activity_logs', 'refresh_tokens', 'mold_maintenance', 'mold_revisions', 'mold_trials', 'molds', 'suppliers', 'users'];

/**
 * Loads database/seed-data.json into SQL Server. Dates are shifted so the data is "current" today.
 * Refuses to touch a database that already contains users unless { force: true } (which wipes every table).
 */
async function seedDatabase({ force = false, log = () => {} } = {}) {
    const config = loadConfig();
    const pool = await getPool();

    const existing = (await pool.request().query('SELECT COUNT(*) AS n FROM users')).recordset[0].n;
    if (existing > 0 && !force) {
        throw new Error('Database already contains data. Re-run with --force to wipe it and load the demo data.');
    }

    const data = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    const now = Date.now();
    const today = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00Z').getTime();
    const passwordHash = await bcrypt.hash(config.seedPassword, config.auth.bcryptRounds);

    const tx = new sql.Transaction(pool);
    await tx.begin();
    const q = async (text, params = {}) => {
        const req = new sql.Request(tx);
        for (const [k, v] of Object.entries(params)) req.input(k, v);
        return req.query(text);
    };

    try {
        for (const table of TABLES) await q(`DELETE FROM ${table}`);
        for (const table of TABLES) {
            await q(`IF EXISTS (SELECT 1 FROM sys.identity_columns WHERE object_id = OBJECT_ID('${table}')) DBCC CHECKIDENT ('${table}', RESEED, 0) WITH NO_INFOMSGS`);
        }

        const userIds = {};
        for (const u of data.users) {
            const r = await q(
                `INSERT INTO users (username, password_hash, full_name, email, department, role, is_active, created_at, last_login_at)
                 OUTPUT INSERTED.id VALUES (@username, @hash, @full_name, @email, @department, @role, @active, @created, @lastLogin)`,
                {
                    username: u.username,
                    hash: passwordHash,
                    full_name: u.full_name,
                    email: u.email,
                    department: u.department,
                    role: u.role,
                    active: u.is_active === false ? 0 : 1,
                    created: new Date(now - 700 * DAY),
                    lastLogin: u.is_active === false ? null : new Date(now - Math.floor(Math.random() * 3 * DAY)),
                },
            );
            userIds[u.username] = r.recordset[0].id;
        }

        const supplierIds = {};
        for (const s of data.suppliers) {
            const r = await q('INSERT INTO suppliers (name, country, contact_email) OUTPUT INSERTED.id VALUES (@name, @country, @email)', {
                name: s.name,
                country: s.country,
                email: s.contact_email,
            });
            supplierIds[s.name] = r.recordset[0].id;
        }

        const moldIds = {};
        for (const m of data.molds) {
            const createdAt = new Date(today + m.start_offset * DAY);
            const r = await q(
                `INSERT INTO molds (code, name, project, status, supplier_id, cavities, material, start_date, deadline, cost, payment_status, notes,
                                    is_archived, archived_at, created_by, created_at)
                 OUTPUT INSERTED.id
                 VALUES (@code, @name, @project, @status, @supplier, @cavities, @material, @start, @deadline, @cost, @payment, @notes,
                         @archived, @archivedAt, @createdBy, @createdAt)`,
                {
                    code: m.code,
                    name: m.name,
                    project: m.project,
                    status: m.status,
                    supplier: supplierIds[m.supplier] ?? null,
                    cavities: m.cavities,
                    material: m.material,
                    start: dateOnly(today, m.start_offset),
                    deadline: m.deadline_offset === null ? null : dateOnly(today, m.deadline_offset),
                    cost: m.cost,
                    payment: m.payment_status,
                    notes: m.notes,
                    archived: m.archived ? 1 : 0,
                    archivedAt: m.archived ? new Date(now - 5 * DAY) : null,
                    createdBy: userIds[m.created_by] ?? null,
                    createdAt,
                },
            );
            const moldId = r.recordset[0].id;
            moldIds[m.code] = moldId;

            for (const t of m.trials) {
                await q(
                    `INSERT INTO mold_trials (mold_id, trial_date, material, color, quantity, outcome, result, operator)
                     VALUES (@moldId, @date, @material, @color, @quantity, @outcome, @result, @operator)`,
                    { moldId, date: dateOnly(today, t.offset), material: t.material, color: t.color, quantity: t.quantity, outcome: t.outcome, result: t.result, operator: t.operator },
                );
            }
            for (const v of m.revisions) {
                await q(
                    `INSERT INTO mold_revisions (mold_id, revision_date, vendor, work_done, cost, payment_status, notes)
                     VALUES (@moldId, @date, @vendor, @work, @cost, @payment, @notes)`,
                    { moldId, date: dateOnly(today, v.offset), vendor: v.vendor, work: v.work_done, cost: v.cost, payment: v.payment_status, notes: v.notes },
                );
            }
            for (const x of m.maintenance) {
                await q(
                    `INSERT INTO mold_maintenance (mold_id, maintenance_date, description, technician, status, cost)
                     VALUES (@moldId, @date, @description, @technician, @status, @cost)`,
                    { moldId, date: dateOnly(today, x.offset), description: x.description, technician: x.technician, status: x.status, cost: x.cost },
                );
            }
        }

        for (const a of data.activity) {
            await q(
                `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, created_at)
                 VALUES (@user, @action, @type, @entity, @description, @createdAt)`,
                {
                    user: userIds[a.user] ?? null,
                    action: a.action,
                    type: a.entity_type,
                    entity: a.mold_code ? moldIds[a.mold_code] ?? null : null,
                    description: a.description,
                    createdAt: new Date(now + a.offset_minutes * 60 * 1000),
                },
            );
        }
        for (const l of data.logins) {
            await q(
                `INSERT INTO login_logs (user_id, username, success, ip_address, user_agent, created_at)
                 VALUES (@user, @username, @success, @ip, @agent, @createdAt)`,
                {
                    user: l.known ? userIds[l.username] ?? null : null,
                    username: l.username,
                    success: l.success ? 1 : 0,
                    ip: l.ip_address,
                    agent: l.user_agent,
                    createdAt: new Date(now + l.offset_minutes * 60 * 1000),
                },
            );
        }
        await tx.commit();
    } catch (err) {
        await tx.rollback().catch(() => {});
        throw err;
    }

    const summary = {
        users: data.users.length,
        suppliers: data.suppliers.length,
        molds: data.molds.length,
        trials: data.molds.reduce((n, m) => n + m.trials.length, 0),
        revisions: data.molds.reduce((n, m) => n + m.revisions.length, 0),
        maintenance: data.molds.reduce((n, m) => n + m.maintenance.length, 0),
        activity: data.activity.length,
        logins: data.logins.length,
    };
    log(summary);
    return summary;
}

module.exports = { seedDatabase };
