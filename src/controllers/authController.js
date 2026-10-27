const { loadConfig } = require('../config/env');
const authService = require('../services/authService');
const userService = require('../services/userService');
const { asyncHandler } = require('../utils/helpers');

const COOKIE_NAME = 'mts_refresh';

function cookieOptions(expires) {
    const { auth } = loadConfig();
    return { httpOnly: true, sameSite: 'lax', secure: auth.cookieSecure, path: '/api/auth', expires };
}

function sendSession(res, session, status = 200) {
    res.cookie(COOKIE_NAME, session.refreshToken, cookieOptions(session.refreshExpiresAt));
    const body = { access_token: session.accessToken, token_type: 'Bearer', expires_in: loadConfig().auth.accessTokenTtl };
    if (session.user) body.user = session.user;
    res.status(status).json(body);
}

exports.login = asyncHandler(async (req, res) => {
    const session = await authService.login(req.body, { ip: req.ip, userAgent: req.get('user-agent') });
    sendSession(res, session);
});

exports.refresh = asyncHandler(async (req, res) => {
    try {
        const session = await authService.refresh(req.cookies?.[COOKIE_NAME]);
        sendSession(res, session);
    } catch (err) {
        res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
        throw err;
    }
});

exports.logout = asyncHandler(async (req, res) => {
    await authService.logout(req.cookies?.[COOKIE_NAME]);
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
    res.json({ user: await userService.getById(req.user.id) });
});

exports.updateMe = asyncHandler(async (req, res) => {
    res.json({ user: await userService.updateProfile(req.user.id, req.body) });
});

exports.changePassword = asyncHandler(async (req, res) => {
    const session = await authService.changePassword(req.user.id, req.body);
    sendSession(res, session);
});
