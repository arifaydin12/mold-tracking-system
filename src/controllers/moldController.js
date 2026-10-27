const moldService = require('../services/moldService');
const supplierService = require('../services/supplierService');
const recordService = require('../services/recordService');
const { asyncHandler } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => res.json(await moldService.list(req.query)));
exports.get = asyncHandler(async (req, res) => res.json({ data: await moldService.getById(req.params.id) }));
exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await moldService.create(req.body, req.user) }));
exports.update = asyncHandler(async (req, res) => res.json({ data: await moldService.update(req.params.id, req.body, req.user) }));
exports.archive = asyncHandler(async (req, res) => {
    await moldService.archive(req.params.id, req.user);
    res.status(204).end();
});
exports.restore = asyncHandler(async (req, res) => res.json({ data: await moldService.restore(req.params.id, req.user) }));

/** Builds list/create/update/remove handlers for one kind of history record. */
const recordHandlers = (service) => ({
    list: asyncHandler(async (req, res) => res.json({ data: await service.list(req.params.id) })),
    create: asyncHandler(async (req, res) => res.status(201).json({ data: await service.create(req.params.id, req.body, req.user) })),
    update: asyncHandler(async (req, res) =>
        res.json({ data: await service.update(req.params.id, req.params.recordId, req.body, req.user) })),
    remove: asyncHandler(async (req, res) => {
        await service.remove(req.params.id, req.params.recordId, req.user);
        res.status(204).end();
    }),
});

exports.trials = recordHandlers(recordService.trials);
exports.revisions = recordHandlers(recordService.revisions);
exports.maintenance = recordHandlers(recordService.maintenance);

exports.suppliers = {
    list: asyncHandler(async (_req, res) => res.json({ data: await supplierService.list() })),
    create: asyncHandler(async (req, res) => res.status(201).json({ data: await supplierService.create(req.body, req.user) })),
    update: asyncHandler(async (req, res) => res.json({ data: await supplierService.update(req.params.id, req.body, req.user) })),
};
