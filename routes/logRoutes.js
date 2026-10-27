const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// Admin only routes
router.get('/logs/aktivite', requireAdmin, logController.getAktiviteLogs);
router.get('/logs/giris', requireAdmin, logController.getGirisLogs);

// Authenticated user routes
router.get('/stats/system', logController.getSystemStats);

module.exports = router;
