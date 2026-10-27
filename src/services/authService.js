const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { loadConfig } = require('../config/env');
const { query } = require('../db/pool');
const { unauthorized, badRequest } = require('../utils/errors');
const { sha256 } = require('../utils/helpers');
const { logActivity, logLogin } = require('./auditService');
const { toPublicUser } = require('./userService');

// Compared against when the username does not exist so response time does not reveal valid usernames.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function signAccessToken(user) {
    const { auth } = loadConfig();
    return jwt.sign({ sub: user.id, role: user.role }, auth.jwtSecret, {
        algorithm: 'HS256',
        expiresIn: auth.accessTokenTtl,
    });
}

/** Creates and stores a refresh token; only its SHA-256 hash is persisted. */
async function createRefreshToken(userId) {
    const { auth } = loadConfig();
    const token = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    await query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (@userId, @hash, @expiresAt)',
        { userId, hash: sha256(token), expiresAt },
    );
    return { token, expiresAt };
}

async function startSession(user) {
    const refresh = await createRefreshToken(user.id);
    return { accessToken: signAccessToken(user), refreshToken: refresh.token, refreshExpiresAt: refresh.expiresAt };
}

async function login({ username, password }, ctx = {}) {
    const name = username.trim().toLowerCase();
    const { recordset } = await query('SELECT * FROM users WHERE username = @name', { name });
    const user = recordset[0];

    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok || !user.is_active) {
        await logLogin({ userId: user ? user.id : null, username: name, success: false, ip: ctx.ip, userAgent: ctx.userAgent });
        throw unauthorized('Invalid username or password');
    }

    await query('UPDATE users SET last_login_at = SYSUTCDATETIME() WHERE id = @id', { id: user.id });
    await logLogin({ userId: user.id, username: name, success: true, ip: ctx.ip, userAgent: ctx.userAgent });
    const session = await startSession(user);
    return { ...session, user: toPublicUser({ ...user, last_login_at: new Date() }) };
}

/** Exchanges a refresh token for a new access token and a rotated refresh token. */
async function refresh(token) {
    if (!token) throw unauthorized('No refresh token');
    const { recordset } = await query(
        `SELECT rt.id AS token_id, rt.expires_at, rt.revoked_at, u.*
           FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
          WHERE rt.token_hash = @hash`,
        { hash: sha256(token) },
    );
    const row = recordset[0];
    if (!row) throw unauthorized('Invalid refresh token');

    if (row.revoked_at) {
        // A rotated token was presented again: assume theft and end every session of that user.
        await revokeAllForUser(row.id);
        throw unauthorized('Refresh token was already used');
    }
    if (new Date(row.expires_at) < new Date() || !row.is_active) throw unauthorized('Session expired');

    await query('UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE id = @id', { id: row.token_id });
    const session = await startSession(row);
    return { ...session, user: toPublicUser(row) };
}

async function logout(token) {
    if (!token) return;
    await query('UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE token_hash = @hash AND revoked_at IS NULL', {
        hash: sha256(token),
    });
}

async function revokeAllForUser(userId) {
    await query('UPDATE refresh_tokens SET revoked_at = SYSUTCDATETIME() WHERE user_id = @userId AND revoked_at IS NULL', { userId });
}

async function changePassword(userId, { current_password, new_password }) {
    const { recordset } = await query('SELECT * FROM users WHERE id = @id', { id: userId });
    const user = recordset[0];
    if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
        throw badRequest('Current password is incorrect', [{ field: 'current_password', message: 'Current password is incorrect', in: 'body' }]);
    }
    const hash = await bcrypt.hash(new_password, loadConfig().auth.bcryptRounds);
    await query('UPDATE users SET password_hash = @hash, updated_at = SYSUTCDATETIME() WHERE id = @id', { hash, id: userId });
    await revokeAllForUser(userId);
    await logActivity({ userId, action: 'auth.change_password', entityType: 'user', entityId: userId, description: 'Changed own password' });
    // Other devices are signed out; the caller keeps working with a fresh session.
    return startSession(user);
}

module.exports = { login, refresh, logout, changePassword, revokeAllForUser, signAccessToken };
