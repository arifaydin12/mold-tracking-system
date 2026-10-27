const { query } = require('../db/pool');
const { serializeRows } = require('../utils/helpers');

const TODAY = 'CAST(SYSUTCDATETIME() AS DATE)';

/** Aggregates everything the dashboard needs in a handful of queries. */
async function dashboard() {
    const [kpi, status, suppliers, deadlines, maintenance, recent] = await Promise.all([
        query(`
            SELECT
              COUNT(*) AS total_molds,
              SUM(CASE WHEN m.status = N'active' THEN 1 ELSE 0 END) AS active_molds,
              SUM(CASE WHEN m.status = N'revision' THEN 1 ELSE 0 END) AS in_revision,
              SUM(CASE WHEN m.status IN (N'trial', N'revision', N'maintenance') AND m.deadline < ${TODAY} THEN 1 ELSE 0 END) AS overdue_deadlines,
              SUM(CASE WHEN m.status IN (N'trial', N'revision', N'maintenance') AND m.deadline BETWEEN ${TODAY} AND DATEADD(day, 14, ${TODAY}) THEN 1 ELSE 0 END) AS due_soon,
              SUM(CASE WHEN m.payment_status <> N'paid' THEN 1 ELSE 0 END) AS unpaid_molds,
              COALESCE(SUM(m.cost), 0) AS purchase_cost,
              (SELECT COALESCE(SUM(r.cost), 0) FROM mold_revisions r JOIN molds mm ON mm.id = r.mold_id WHERE mm.is_archived = 0) AS revision_cost,
              (SELECT COALESCE(SUM(x.cost), 0) FROM mold_maintenance x JOIN molds mm ON mm.id = x.mold_id WHERE mm.is_archived = 0) AS maintenance_cost,
              (SELECT COUNT(*) FROM mold_maintenance x JOIN molds mm ON mm.id = x.mold_id
                WHERE mm.is_archived = 0 AND x.status <> N'completed' AND x.maintenance_date <= DATEADD(day, 30, ${TODAY})) AS maintenance_due
            FROM molds m WHERE m.is_archived = 0`),
        query(`SELECT status, COUNT(*) AS count FROM molds WHERE is_archived = 0 GROUP BY status`),
        query(`
            SELECT COALESCE(s.name, N'Unassigned') AS supplier,
                   SUM(m.cost) AS mold_cost,
                   SUM(COALESCE(rv.revision_cost, 0)) AS revision_cost,
                   COUNT(*) AS molds
              FROM molds m
              LEFT JOIN suppliers s ON s.id = m.supplier_id
              LEFT JOIN (SELECT mold_id, SUM(cost) AS revision_cost FROM mold_revisions GROUP BY mold_id) rv ON rv.mold_id = m.id
             WHERE m.is_archived = 0
             GROUP BY COALESCE(s.name, N'Unassigned')
             ORDER BY SUM(m.cost) + SUM(COALESCE(rv.revision_cost, 0)) DESC`),
        query(`
            SELECT TOP 8 m.id, m.code, m.name, m.status, m.deadline, s.name AS supplier_name,
                   DATEDIFF(day, ${TODAY}, m.deadline) AS days_left
              FROM molds m LEFT JOIN suppliers s ON s.id = m.supplier_id
             WHERE m.is_archived = 0 AND m.status IN (N'trial', N'revision', N'maintenance')
               AND m.deadline IS NOT NULL AND m.deadline <= DATEADD(day, 45, ${TODAY})
             ORDER BY m.deadline ASC, m.id ASC`),
        query(`
            SELECT TOP 8 x.id, x.mold_id, m.code, m.name, x.maintenance_date AS due_date, x.status, x.description,
                   DATEDIFF(day, ${TODAY}, x.maintenance_date) AS days_left
              FROM mold_maintenance x JOIN molds m ON m.id = x.mold_id
             WHERE m.is_archived = 0 AND x.status <> N'completed' AND x.maintenance_date <= DATEADD(day, 30, ${TODAY})
             ORDER BY x.maintenance_date ASC, x.id ASC`),
        query(`
            SELECT TOP 8 a.id, a.action, a.entity_type, a.entity_id, a.description, a.created_at, u.full_name AS user_name
              FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id
             ORDER BY a.created_at DESC, a.id DESC`),
    ]);

    const k = kpi.recordset[0];
    const num = (v) => Number(v || 0);
    const round = (v) => Math.round(num(v) * 100) / 100;
    return {
        kpis: {
            total_molds: num(k.total_molds),
            active_molds: num(k.active_molds),
            in_revision: num(k.in_revision),
            overdue_deadlines: num(k.overdue_deadlines),
            due_soon: num(k.due_soon),
            unpaid_molds: num(k.unpaid_molds),
            maintenance_due: num(k.maintenance_due),
            purchase_cost: round(k.purchase_cost),
            revision_cost: round(k.revision_cost),
            maintenance_cost: round(k.maintenance_cost),
            total_cost: round(num(k.purchase_cost) + num(k.revision_cost) + num(k.maintenance_cost)),
        },
        status_distribution: status.recordset.map((r) => ({ status: r.status, count: r.count })),
        cost_by_supplier: suppliers.recordset.map((r) => ({
            supplier: r.supplier,
            mold_cost: round(r.mold_cost),
            revision_cost: round(r.revision_cost),
            total_cost: round(num(r.mold_cost) + num(r.revision_cost)),
            molds: r.molds,
        })),
        upcoming_deadlines: serializeRows(deadlines.recordset),
        maintenance_due: serializeRows(maintenance.recordset),
        recent_activity: serializeRows(recent.recordset),
    };
}

module.exports = { dashboard };
