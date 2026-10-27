const { query } = require('../db/pool');
const { notFound } = require('../utils/errors');
const { serializeRow, serializeRows } = require('../utils/helpers');
const { logActivity } = require('./auditService');
const moldService = require('./moldService');

/**
 * Trials, revisions and maintenance entries share the same CRUD shape, so one
 * factory builds the service for each of them from a small descriptor.
 */
function createRecordService({ table, entity, label, dateColumn, columns, summarize }) {
    const base = `SELECT * FROM ${table}`;

    async function getOne(moldId, recordId) {
        const { recordset } = await query(`${base} WHERE id = @recordId AND mold_id = @moldId`, { recordId, moldId });
        if (!recordset[0]) throw notFound(label);
        return serializeRow(recordset[0]);
    }

    async function list(moldId) {
        await moldService.getRow(moldId);
        const { recordset } = await query(`${base} WHERE mold_id = @moldId ORDER BY ${dateColumn} DESC, id DESC`, { moldId });
        return serializeRows(recordset);
    }

    async function create(moldId, data, actor) {
        const mold = await moldService.assertEditable(moldId);
        const names = columns.join(', ');
        const values = columns.map((c) => `@${c}`).join(', ');
        const params = { moldId };
        for (const c of columns) params[c] = data[c] ?? null;
        const { recordset } = await query(
            `INSERT INTO ${table} (mold_id, ${names}) OUTPUT INSERTED.id VALUES (@moldId, ${values})`,
            params,
        );
        const id = recordset[0].id;
        await logActivity({
            userId: actor.id,
            action: `${entity}.create`,
            entityType: entity,
            entityId: id,
            description: `Added ${label.toLowerCase()} to mold ${mold.code}: ${summarize(data)}`,
        });
        return getOne(moldId, id);
    }

    async function update(moldId, recordId, data, actor) {
        const mold = await moldService.assertEditable(moldId);
        await getOne(moldId, recordId);
        const sets = [];
        const params = { recordId, moldId };
        for (const c of columns) {
            if (data[c] !== undefined) {
                sets.push(`${c} = @${c}`);
                params[c] = data[c];
            }
        }
        await query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = @recordId AND mold_id = @moldId`, params);
        await logActivity({
            userId: actor.id,
            action: `${entity}.update`,
            entityType: entity,
            entityId: recordId,
            description: `Updated ${label.toLowerCase()} of mold ${mold.code} (${Object.keys(data).join(', ')})`,
        });
        return getOne(moldId, recordId);
    }

    async function remove(moldId, recordId, actor) {
        const mold = await moldService.assertEditable(moldId);
        await getOne(moldId, recordId);
        await query(`DELETE FROM ${table} WHERE id = @recordId AND mold_id = @moldId`, { recordId, moldId });
        await logActivity({
            userId: actor.id,
            action: `${entity}.delete`,
            entityType: entity,
            entityId: recordId,
            description: `Deleted ${label.toLowerCase()} of mold ${mold.code}`,
        });
    }

    return { list, create, update, remove };
}

const trials = createRecordService({
    table: 'mold_trials',
    entity: 'trial',
    label: 'Trial',
    dateColumn: 'trial_date',
    columns: ['trial_date', 'material', 'color', 'quantity', 'outcome', 'result', 'operator'],
    summarize: (d) => `${d.trial_date}, ${d.quantity ?? 0} pcs, ${d.outcome}`,
});

const revisions = createRecordService({
    table: 'mold_revisions',
    entity: 'revision',
    label: 'Revision',
    dateColumn: 'revision_date',
    columns: ['revision_date', 'vendor', 'work_done', 'cost', 'payment_status', 'notes'],
    summarize: (d) => `${d.revision_date}, ${String(d.work_done).slice(0, 60)}`,
});

const maintenance = createRecordService({
    table: 'mold_maintenance',
    entity: 'maintenance',
    label: 'Maintenance record',
    dateColumn: 'maintenance_date',
    columns: ['maintenance_date', 'description', 'technician', 'status', 'cost'],
    summarize: (d) => `${d.maintenance_date}, ${d.status}`,
});

module.exports = { trials, revisions, maintenance };
