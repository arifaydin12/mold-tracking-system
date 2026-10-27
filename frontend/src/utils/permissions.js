// Mirrors src/config/permissions.js on the server. The API remains the source of truth;
// this table only decides which buttons and pages the UI offers.
export const PERMISSIONS = {
    'molds:read': ['admin', 'engineer', 'viewer'],
    'molds:write': ['admin', 'engineer'],
    'molds:archive': ['admin', 'engineer'],
    'molds:restore': ['admin'],
    'records:write': ['admin', 'engineer'],
    'records:delete': ['admin', 'engineer'],
    'suppliers:write': ['admin', 'engineer'],
    'users:manage': ['admin'],
    'logs:read': ['admin'],
}

export const ROLES = ['admin', 'engineer', 'viewer']

export const can = (role, permission) => (PERMISSIONS[permission] || []).includes(role)

export const permissionsOf = (role) => Object.keys(PERMISSIONS).filter((p) => can(role, p))
