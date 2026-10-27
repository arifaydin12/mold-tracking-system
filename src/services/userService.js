const bcrypt = require('bcrypt');
const { loadConfig } = require('../config/env');
const { query } = require('../db/pool');
const { notFound, conflict } = require('../utils/errors');
const { serializeRow, serializeRows, buildMeta, likeTerm } = require('../utils/helpers');
const { logActivity } = require('./auditService');

const PUBLIC_COLUMNS = 'id, username, full_name, email, department, role, is_active, created_at, updated_at, last_login_at';

const toPublicUser = (row) => {
    const { password_hash, ...rest } = row; // eslint-disable-line no-unused-vars
    const pick = ['id', 'username', 'full_name', 'email', 'department', 'role', 'is_active', 'created_at', 'updated_at', 'last_login_at'];
    return serializeRow(Object.fromEntries(pick.map((k) => [k, rest[k] === undefined ? null : rest[k]])));
};

const SORT_COLUMNS = {
    username: 'username',
    full_name: 'full_name',
    role: 'role',
    created_at: 'created_at',
    last_login_at: 'last_login_at',
};

async function list(q) {
    const where = ['1 = 1'];
    const params = {};
    if (q.search) {
        where.push(`(username LIKE @search ESCAPE '\\' OR full_name LIKE @search ESCAPE '\\' OR email LIKE @search ESCAPE '\\')`);
        params.search = likeTerm(q.search);
    }
    if (q.role) {
        where.push('role = @role');
        params.role = q.role;
    }
    if (q.is_active !== undefined) {
        where.push('is_active = @isActive');
        params.isActive = q.is_active ? 1 : 0;
    }
    const clause = where.join(' AND ');
    const dir = q.order === 'desc' ? 'DESC' : 'ASC';

    const total = (await query(`SELECT COUNT(*) AS n FROM users WHERE ${clause}`, params)).recordset[0].n;
    const { recordset } = await query(
        `SELECT ${PUBLIC_COLUMNS} FROM users WHERE ${clause}
         ORDER BY ${SORT_COLUMNS[q.sort]} ${dir}, id ASC
         OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY`,
        { ...params, offset: (q.page - 1) * q.page_size, size: q.page_size },
    );
    return { data: serializeRows(recordset), meta: buildMeta(q.page, q.page_size, total) };
}

async function getById(id) {
    const { recordset } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = @id`, { id });
    if (!recordset[0]) throw notFound('User');
    return toPublicUser(recordset[0]);
}

async function create(data, actor) {
    const hash = await bcrypt.hash(data.password, loadConfig().auth.bcryptRounds);
    const { recordset } = await query(
        `INSERT INTO users (username, password_hash, full_name, email, department, role)
         OUTPUT INSERTED.id
         VALUES (@username, @hash, @full_name, @email, @department, @role)`,
        { username: data.username, hash, full_name: data.full_name, email: data.email, department: data.department, role: data.role },
    );
    const id = recordset[0].id;
    await logActivity({
        userId: actor.id,
        action: 'user.create',
        entityType: 'user',
        entityId: id,
        description: `Created user ${data.username} (${data.role})`,
    });
    return getById(id);
}

async function countOtherActiveAdmins(excludeId) {
    const { recordset } = await query(
        "SELECT COUNT(*) AS n FROM users WHERE role = N'admin' AND is_active = 1 AND id <> @id",
        { id: excludeId },
    );
    return recordset[0].n;
}

async function update(id, data, actor) {
    const existing = await getById(id);

    const losesAdmin =
        existing.role === 'admin' && existing.is_active && (data.role === 'viewer' || data.role === 'engineer' || data.is_active === false);
    if (losesAdmin) {
        if (id === actor.id) throw conflict('You cannot demote or deactivate your own account');
        if ((await countOtherActiveAdmins(id)) === 0) throw conflict('The last active administrator cannot be demoted or deactivated');
    }
    if (id === actor.id && data.is_active === false) throw conflict('You cannot deactivate your own account');

    const columns = ['full_name', 'email', 'department', 'role', 'is_active'];
    const sets = [];
    const params = { id };
    for (const col of columns) {
        if (data[col] !== undefined) {
            sets.push(`${col} = @${col}`);
            params[col] = col === 'is_active' ? (data[col] ? 1 : 0) : data[col];
        }
    }
    await query(`UPDATE users SET ${sets.join(', ')}, updated_at = SYSUTCDATETIME() WHERE id = @id`, params);

    if (data.is_active === false || (data.role && data.role !== existing.role)) {
        await query('UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE user_id = @id AND revoked_at IS NULL', { id });
    }
    const changed = Object.keys(data).join(', ');
    await logActivity({
        userId: actor.id,
        action: data.is_active === false ? 'user.deactivate' : data.is_active === true && !existing.is_active ? 'user.activate' : 'user.update',
        entityType: 'user',
        entityId: id,
        description: `Updated user ${existing.username} (${changed})`,
    });
    return getById(id);
}

async function resetPassword(id, newPassword, actor) {
    const existing = await getById(id);
    const hash = await bcrypt.hash(newPassword, loadConfig().auth.bcryptRounds);
    await query('UPDATE users SET password_hash = @hash, updated_at = SYSUTCDATETIME() WHERE id = @id', { hash, id });
    await query('UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE user_id = @id AND revoked_at IS NULL', { id });
    await logActivity({
        userId: actor.id,
        action: 'user.reset_password',
        entityType: 'user',
        entityId: id,
        description: `Reset password of ${existing.username}`,
    });
}

async function updateProfile(id, data) {
    const sets = [];
    const params = { id };
    for (const col of ['full_name', 'email', 'department']) {
        if (data[col] !== undefined) {
            sets.push(`${col} = @${col}`);
            params[col] = data[col];
        }
    }
    await query(`UPDATE users SET ${sets.join(', ')}, updated_at = SYSUTCDATETIME() WHERE id = @id`, params);
    await logActivity({ userId: id, action: 'user.update_profile', entityType: 'user', entityId: id, description: 'Updated own profile' });
    return getById(id);
}

module.exports = { list, getById, create, update, resetPassword, updateProfile, toPublicUser };
