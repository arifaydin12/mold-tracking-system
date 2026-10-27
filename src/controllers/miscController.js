const logService = require('../services/logService');
const statsService = require('../services/statsService');
const { query } = require('../db/pool');
const { asyncHandler } = require('../utils/helpers');

const startedAt = Date.now();

exports.health = async (_req, res) => {
    const body = { status: 'ok', uptime_seconds: Math.round((Date.now() - startedAt) / 1000), database: 'up' };
    try {
        await query('SELECT 1 AS ok');
        res.json(body);
    } catch (err) {
        res.status(503).json({ ...body, status: 'degraded', database: 'down' });
    }
};

exports.dashboard = asyncHandler(async (_req, res) => res.json({ data: await statsService.dashboard() }));
exports.activityLogs = asyncHandler(async (req, res) => res.json(await logService.listActivity(req.query)));
exports.loginLogs = asyncHandler(async (req, res) => res.json(await logService.listLogins(req.query)));
