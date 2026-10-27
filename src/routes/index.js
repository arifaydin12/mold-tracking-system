const express = require('express');
const { schemas } = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { authenticate, requirePermission } = require('../middleware/auth');
const misc = require('../controllers/miscController');
const moldCtrl = require('../controllers/moldController');
const createAuthRouter = require('./auth');
const moldsRouter = require('./molds');
const usersRouter = require('./users');

module.exports = function createApiRouter(config) {
    const router = express.Router();

    // Public
    router.get('/health', misc.health);
    router.use('/auth', createAuthRouter(config));

    // Everything below needs a valid access token
    router.use(authenticate);
    router.use('/molds', moldsRouter);
    router.use('/users', usersRouter);

    router.get('/suppliers', requirePermission('molds:read'), moldCtrl.suppliers.list);
    router.post('/suppliers', requirePermission('suppliers:write'), validate({ body: schemas.createSupplier }), moldCtrl.suppliers.create);
    router.patch(
        '/suppliers/:id',
        requirePermission('suppliers:write'),
        validate({ params: schemas.idParams, body: schemas.updateSupplier }),
        moldCtrl.suppliers.update,
    );

    router.get('/stats/dashboard', requirePermission('molds:read'), misc.dashboard);
    router.get('/logs/activity', requirePermission('logs:read'), validate({ query: schemas.listActivityLogs }), misc.activityLogs);
    router.get('/logs/logins', requirePermission('logs:read'), validate({ query: schemas.listLoginLogs }), misc.loginLogs);

    return router;
};
