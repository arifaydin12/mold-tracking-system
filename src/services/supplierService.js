const { query } = require('../db/pool');
const { notFound } = require('../utils/errors');
const { serializeRow, serializeRows } = require('../utils/helpers');
const { logActivity } = require('./auditService');

async function list() {
    const { recordset } = await query(
        `SELECT s.id, s.name, s.country, s.contact_email, s.created_at,
                (SELECT COUNT(*) FROM molds m WHERE m.supplier_id = s.id AND m.is_archived = 0) AS mold_count
           FROM suppliers s ORDER BY s.name`,
    );
    return serializeRows(recordset);
}

async function getById(id) {
    const { recordset } = await query('SELECT id, name, country, contact_email, created_at FROM suppliers WHERE id = @id', { id });
    if (!recordset[0]) throw notFound('Supplier');
    return serializeRow(recordset[0]);
}

async function create(data, actor) {
    const { recordset } = await query(
        'INSERT INTO suppliers (name, country, contact_email) OUTPUT INSERTED.id VALUES (@name, @country, @contact_email)',
        data,
    );
    const id = recordset[0].id;
    await logActivity({ userId: actor.id, action: 'supplier.create', entityType: 'supplier', entityId: id, description: `Created supplier ${data.name}` });
    return getById(id);
}

async function update(id, data, actor) {
    const existing = await getById(id);
    const sets = [];
    const params = { id };
    for (const col of ['name', 'country', 'contact_email']) {
        if (data[col] !== undefined) {
            sets.push(`${col} = @${col}`);
            params[col] = data[col];
        }
    }
    await query(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = @id`, params);
    await logActivity({ userId: actor.id, action: 'supplier.update', entityType: 'supplier', entityId: id, description: `Updated supplier ${existing.name}` });
    return getById(id);
}

module.exports = { list, getById, create, update };
