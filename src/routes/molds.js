const express = require('express');
const { schemas } = require('../validation/schemas');
const { validate } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');
const ctrl = require('../controllers/moldController');

const router = express.Router();
const read = requirePermission('molds:read');

router.get('/', read, validate({ query: schemas.listMolds }), ctrl.list);
router.post('/', requirePermission('molds:write'), validate({ body: schemas.createMold }), ctrl.create);
router.get('/:id', read, validate({ params: schemas.idParams }), ctrl.get);
router.patch('/:id', requirePermission('molds:write'), validate({ params: schemas.idParams, body: schemas.updateMold }), ctrl.update);
// Soft delete: the mold and its history stay in the database and can be restored by an admin.
router.delete('/:id', requirePermission('molds:archive'), validate({ params: schemas.idParams }), ctrl.archive);
router.post('/:id/restore', requirePermission('molds:restore'), validate({ params: schemas.idParams }), ctrl.restore);

/** Mounts list/create/update/delete for one kind of history record under /:id/<segment>. */
function mountRecords(segment, handlers, createSchema, updateSchema) {
    router.get(`/:id/${segment}`, read, validate({ params: schemas.idParams }), handlers.list);
    router.post(`/:id/${segment}`, requirePermission('records:write'), validate({ params: schemas.idParams, body: createSchema }), handlers.create);
    router.patch(
        `/:id/${segment}/:recordId`,
        requirePermission('records:write'),
        validate({ params: schemas.childParams, body: updateSchema }),
        handlers.update,
    );
    router.delete(`/:id/${segment}/:recordId`, requirePermission('records:delete'), validate({ params: schemas.childParams }), handlers.remove);
}

mountRecords('trials', ctrl.trials, schemas.createTrial, schemas.updateTrial);
mountRecords('revisions', ctrl.revisions, schemas.createRevision, schemas.updateRevision);
mountRecords('maintenance', ctrl.maintenance, schemas.createMaintenance, schemas.updateMaintenance);

module.exports = router;
