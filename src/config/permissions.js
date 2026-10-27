/**
 * Role matrix. Every protected route names a permission; this table decides which roles hold it.
 * The React app and the in-browser demo backend mirror this table (frontend/src/utils/permissions.js).
 */
const PERMISSIONS = {
    'molds:read': ['admin', 'engineer', 'viewer'],
    'molds:write': ['admin', 'engineer'],
    'molds:archive': ['admin', 'engineer'],
    'molds:restore': ['admin'],
    'records:write': ['admin', 'engineer'],
    'records:delete': ['admin', 'engineer'],
    'suppliers:write': ['admin', 'engineer'],
    'users:manage': ['admin'],
    'logs:read': ['admin'],
};

const can = (role, permission) => (PERMISSIONS[permission] || []).includes(role);

module.exports = { PERMISSIONS, can };
