const express = require('express');
const { schemas } = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/authController');

module.exports = function createAuthRouter(config) {
    const router = express.Router();

    router.post('/login', loginLimiter(config.rateLimit), validate({ body: schemas.login }), ctrl.login);
    router.post('/refresh', ctrl.refresh);
    router.post('/logout', ctrl.logout);
    router.get('/me', authenticate, ctrl.me);
    router.patch('/me', authenticate, validate({ body: schemas.updateProfile }), ctrl.updateMe);
    router.post('/change-password', authenticate, validate({ body: schemas.changePassword }), ctrl.changePassword);

    return router;
};
