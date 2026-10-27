const express = require('express');
const router = express.Router();
const kalipController = require('../controllers/kalipController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

router.get('/kaliplar', kalipController.getKaliplar);
router.post('/kaliplar', kalipController.createKalip);
router.put('/kaliplar/:id', kalipController.updateKalip);
router.delete('/kaliplar/:id', kalipController.deleteKalip);

// Process routes (mounted at /api, so path is /deneme)
router.post('/deneme', kalipController.createDeneme);
router.post('/revizyon', kalipController.createRevizyon);
router.post('/bakim', kalipController.createBakim);

module.exports = router;
