const express = require('express');
const { schemas } = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');
const ctrl = require('../controllers/userController');

const router = express.Router();
router.use(requirePermission('users:manage'));

router.get('/', validate({ query: schemas.listUsers }), ctrl.list);
router.post('/', validate({ body: schemas.createUser }), ctrl.create);
router.get('/:id', validate({ params: schemas.idParams }), ctrl.get);
router.patch('/:id', validate({ params: schemas.idParams, body: schemas.updateUser }), ctrl.update);
router.post('/:id/reset-password', validate({ params: schemas.idParams, body: schemas.resetPassword }), ctrl.resetPassword);

module.exports = router;
