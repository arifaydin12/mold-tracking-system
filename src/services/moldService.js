const { query } = require('../db/pool');
const { notFound, conflict, HttpError } = require('../utils/errors');
const { serializeRow, serializeRows, buildMeta, likeTerm } = require('../utils/helpers');
const { logActivity } = require('./auditService');

const LIST_SELECT = `
    SELECT m.id, m.code, m.name, m.project, m.status, m.supplier_id, s.name AS supplier_name,
           m.cavities, m.material, m.start_date, m.deadline, m.cost, m.payment_status,
           m.is_archived, m.archived_at, m.created_at, m.updated_at,
           (SELECT COUNT(*) FROM mold_trials t WHERE t.mold_id = m.id) AS trial_count,
           (SELECT COUNT(*) FROM mold_revisions r WHERE r.mold_id = m.id) AS revision_count,
           (SELECT COUNT(*) FROM mold_maintenance mt WHERE mt.mold_id = m.id) AS maintenance_count,
           (SELECT COALESCE(SUM(r.cost), 0) FROM mold_revisions r WHERE r.mold_id = m.id) AS revision_cost
      FROM molds m
      LEFT JOIN suppliers s ON s.id = m.supplier_id`;

// Whitelisted ORDER BY expressions (never interpolate user input directly).
const SORT = {
    code: (d) => `m.code ${d}`,
    name: (d) => `m.name ${d}`,
    status: (d) => `m.status ${d}`,
    deadline: (d) => `CASE WHEN m.deadline IS NULL THEN 1 ELSE 0 END, m.deadline ${d}`,
    cost: (d) => `m.cost ${d}`,
    created_at: (d) => `m.created_at ${d}`,
    supplier: (d) => `CASE WHEN s.name IS NULL THEN 1 ELSE 0 END, s.name ${d}`,
};

const WRITABLE = ['code', 'name', 'project', 'status', 'supplier_id', 'cavities', 'material', 'start_date', 'deadline', 'cost', 'payment_status', 'notes'];

async function list(q) {
    const where = [];
    const params = {};
    if (q.archived === 'false') where.push('m.is_archived = 0');
    else if (q.archived === 'true') where.push('m.is_archived = 1');
    if (q.search) {
        where.push(`(m.code LIKE @search ESCAPE '\\' OR m.name LIKE @search ESCAPE '\\' OR m.project LIKE @search ESCAPE '\\' OR m.material LIKE @search ESCAPE '\\' OR s.name LIKE @search ESCAPE '\\')`);
        params.search = likeTerm(q.search);
    }
    if (q.status) {
        where.push('m.status = @status');
        params.status = q.status;
    }
    if (q.supplier_id) {
        where.push('m.supplier_id = @supplierId');
        params.supplierId = q.supplier_id;
    }
    if (q.payment_status) {
        where.push('m.payment_status = @paymentStatus');
        params.paymentStatus = q.payment_status;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dir = q.order === 'asc' ? 'ASC' : 'DESC';

    const total = (
        await query(`SELECT COUNT(*) AS n FROM molds m LEFT JOIN suppliers s ON s.id = m.supplier_id ${clause}`, params)
    ).recordset[0].n;
    const { recordset } = await query(
        `${LIST_SELECT} ${clause}
         ORDER BY ${SORT[q.sort](dir)}, m.id ${dir}
         OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
        { ...params, offset: (q.page - 1) * q.page_size, size: q.page_size },
    );
    return { data: serializeRows(recordset), meta: buildMeta(q.page, q.page_size, total) };
}

async function getRow(id) {
    const { recordset } = await query(
        `SELECT m.*, s.name AS supplier_name, cu.full_name AS created_by_name, uu.full_name AS updated_by_name
           FROM molds m
           LEFT JOIN suppliers s ON s.id = m.supplier_id
           LEFT JOIN users cu ON cu.id = m.created_by
           LEFT JOIN users uu ON uu.id = m.updated_by
          WHERE m.id = @id`,
        { id },
    );
    if (!recordset[0]) throw notFound('Mold');
    return serializeRow(recordset[0]);
}

/** Full mold with its trial, revision and maintenance history. */
async function getById(id) {
    const mold = await getRow(id);
    const [trials, revisions, maintenance] = await Promise.all([
        query('SELECT * FROM mold_trials WHERE mold_id = @id ORDER BY trial_date DESC, id DESC', { id }),
        query('SELECT * FROM mold_revisions WHERE mold_id = @id ORDER BY revision_date DESC, id DESC', { id }),
        query('SELECT * FROM mold_maintenance WHERE mold_id = @id ORDER BY maintenance_date DESC, id DESC', { id }),
    ]);
    const t = serializeRows(trials.recordset);
    const r = serializeRows(revisions.recordset);
    const mt = serializeRows(maintenance.recordset);
    const sum = (rows) => Math.round(rows.reduce((acc, x) => acc + Number(x.cost || 0), 0) * 100) / 100;
    return {
        ...mold,
        trials: t,
        revisions: r,
        maintenance: mt,
        totals: {
            purchase_cost: mold.cost,
            revision_cost: sum(r),
            maintenance_cost: sum(mt),
            total_cost: Math.round((Number(mold.cost) + sum(r) + sum(mt)) * 100) / 100,
            trial_shots: t.reduce((acc, x) => acc + x.quantity, 0),
        },
    };
}

async function assertSupplier(supplierId) {
    if (supplierId === null || supplierId === undefined) return;
    const { recordset } = await query('SELECT 1 AS ok FROM suppliers WHERE id = @id', { id: supplierId });
    if (!recordset[0]) {
        throw new HttpError(400, 'validation_error', 'Validation failed', [
            { field: 'supplier_id', message: 'Supplier does not exist', in: 'body' },
        ]);
    }
}

/** Loads a mold and refuses to change archived ones. */
async function assertEditable(id) {
    const mold = await getRow(id);
    if (mold.is_archived) throw conflict('This mold is archived. Restore it before making changes.');
    return mold;
}

async function create(data, actor) {
    await assertSupplier(data.supplier_id);
    const { recordset } = await query(
        `INSERT INTO molds (code, name, project, status, supplier_id, cavities, material, start_date, deadline, cost, payment_status, notes, created_by)
         OUTPUT INSERTED.id
         VALUES (@code, @name, @project, @status, @supplier_id, @cavities, @material, @start_date, @deadline, @cost, @payment_status, @notes, @actor)`,
        { ...data, actor: actor.id },
    );
    const id = recordset[0].id;
    await logActivity({ userId: actor.id, action: 'mold.create', entityType: 'mold', entityId: id, description: `Created mold ${data.code} - ${data.name}` });
    return getById(id);
}

async function update(id, data, actor) {
    const existing = await assertEditable(id);
    await assertSupplier(data.supplier_id);
    const effectiveStart = data.start_date !== undefined ? data.start_date : existing.start_date;
    const effectiveDeadline = data.deadline !== undefined ? data.deadline : existing.deadline;
    if (effectiveStart && effectiveDeadline && effectiveDeadline < effectiveStart) {
        throw new HttpError(400, 'validation_error', 'Validation failed', [
            { field: 'deadline', message: 'Deadline must not be before the start date', in: 'body' },
        ]);
    }

    const sets = [];
    const params = { id, actor: actor.id };
    for (const col of WRITABLE) {
        if (data[col] !== undefined) {
            sets.push(`${col} = @${col}`);
            params[col] = data[col];
        }
    }
    await query(`UPDATE molds SET ${sets.join(', ')}, updated_by = @actor, updated_at = SYSUTCDATETIME() WHERE id = @id`, params);

    const changed = Object.keys(data).join(', ');
    await logActivity({ userId: actor.id, action: 'mold.update', entityType: 'mold', entityId: id, description: `Updated mold ${existing.code} (${changed})` });
    return getById(id);
}

async function archive(id, actor) {
    const existing = await getRow(id);
    if (existing.is_archived) throw conflict('Mold is already archived');
    await query(
        'UPDATE molds SET is_archived = 1, archived_at = SYSUTCDATETIME(), updated_by = @actor, updated_at = SYSUTCDATETIME() WHERE id = @id',
        { id, actor: actor.id },
    );
    await logActivity({ userId: actor.id, action: 'mold.archive', entityType: 'mold', entityId: id, description: `Archived mold ${existing.code}` });
}

async function restore(id, actor) {
    const existing = await getRow(id);
    if (!existing.is_archived) throw conflict('Mold is not archived');
    await query(
        'UPDATE molds SET is_archived = 0, archived_at = NULL, updated_by = @actor, updated_at = SYSUTCDATETIME() WHERE id = @id',
        { id, actor: actor.id },
    );
    await logActivity({ userId: actor.id, action: 'mold.restore', entityType: 'mold', entityId: id, description: `Restored mold ${existing.code}` });
    return getById(id);
}

module.exports = { list, getById, getRow, assertEditable, create, update, archive, restore };
