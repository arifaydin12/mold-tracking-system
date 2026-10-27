const { query } = require('../db/pool');
const { serializeRows, buildMeta, likeTerm } = require('../utils/helpers');

async function listActivity(q) {
    const where = ['1 = 1'];
    const params = {};
    if (q.user_id) {
        where.push('a.user_id = @userId');
        params.userId = q.user_id;
    }
    if (q.action) {
        where.push('a.action = @action');
        params.action = q.action;
    }
    if (q.entity_type) {
        where.push('a.entity_type = @entityType');
        params.entityType = q.entity_type;
    }
    if (q.from) {
        where.push('a.created_at >= @from');
        params.from = new Date(q.from);
    }
    if (q.to) {
        where.push('a.created_at <= @to');
        params.to = new Date(q.to);
    }
    if (q.search) {
        where.push(`(a.description LIKE @search ESCAPE '\\' OR a.action LIKE @search ESCAPE '\\' OR u.full_name LIKE @search ESCAPE '\\')`);
        params.search = likeTerm(q.search);
    }
    const clause = where.join(' AND ');
    const from = 'FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id';

    const total = (await query(`SELECT COUNT(*) AS n ${from} WHERE ${clause}`, params)).recordset[0].n;
    const { recordset } = await query(
        `SELECT a.id, a.user_id, u.full_name AS user_name, u.username, a.action, a.entity_type, a.entity_id, a.description, a.created_at
         ${from} WHERE ${clause}
         ORDER BY a.created_at DESC, a.id DESC
         OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
        { ...params, offset: (q.page - 1) * q.page_size, size: q.page_size },
    );
    return { data: serializeRows(recordset), meta: buildMeta(q.page, q.page_size, total) };
}

async function listLogins(q) {
    const where = ['1 = 1'];
    const params = {};
    if (q.success !== undefined) {
        where.push('l.success = @success');
        params.success = q.success ? 1 : 0;
    }
    if (q.from) {
        where.push('l.created_at >= @from');
        params.from = new Date(q.from);
    }
    if (q.to) {
        where.push('l.created_at <= @to');
        params.to = new Date(q.to);
    }
    if (q.search) {
        where.push(`(l.username LIKE @search ESCAPE '\\' OR l.ip_address LIKE @search ESCAPE '\\')`);
        params.search = likeTerm(q.search);
    }
    const clause = where.join(' AND ');

    const total = (await query(`SELECT COUNT(*) AS n FROM login_logs l WHERE ${clause}`, params)).recordset[0].n;
    const { recordset } = await query(
        `SELECT l.id, l.user_id, l.username, l.success, l.ip_address, l.user_agent, l.created_at
           FROM login_logs l WHERE ${clause}
          ORDER BY l.created_at DESC, l.id DESC
          OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
        { ...params, offset: (q.page - 1) * q.page_size, size: q.page_size },
    );
    return { data: serializeRows(recordset, ['success']), meta: buildMeta(q.page, q.page_size, total) };
}

module.exports = { listActivity, listLogins };
