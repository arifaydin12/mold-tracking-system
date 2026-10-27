const userService = require('../services/userService');
const { asyncHandler } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => res.json(await userService.list(req.query)));
exports.get = asyncHandler(async (req, res) => res.json({ data: await userService.getById(req.params.id) }));
exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await userService.create(req.body, req.user) }));
exports.update = asyncHandler(async (req, res) => res.json({ data: await userService.update(req.params.id, req.body, req.user) }));
exports.resetPassword = asyncHandler(async (req, res) => {
    await userService.resetPassword(req.params.id, req.body.new_password, req.user);
    res.status(204).end();
});
