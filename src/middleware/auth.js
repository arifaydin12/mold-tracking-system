const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config/env');
const { can } = require('../config/permissions');
const { query } = require('../db/pool');
const { unauthorized, forbidden } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

/**
 * Verifies the Bearer access token, then reloads the user so role changes and
 * deactivation take effect immediately instead of when the token expires.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload;
    try {
        payload = jwt.verify(token, loadConfig().auth.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
        throw unauthorized(err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token');
    }

    const { recordset } = await query(
        'SELECT id, username, full_name, email, department, role, is_active FROM users WHERE id = @id',
        { id: payload.sub },
    );
    const user = recordset[0];
    if (!user || !user.is_active) throw unauthorized('Account is disabled or no longer exists');

    req.user = { ...user, is_active: Boolean(user.is_active) };
    next();
});

/** Allows the request only when the signed-in user's role holds the permission. */
const requirePermission = (permission) => (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, permission)) return next(forbidden());
    next();
};

module.exports = { authenticate, requirePermission };
