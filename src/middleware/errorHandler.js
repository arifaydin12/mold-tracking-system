const { HttpError } = require('../utils/errors');

/** SQL Server error numbers we translate into client errors. */
function fromSqlError(err) {
    const number = err.number || err.originalError?.info?.number;
    if (number === 2627 || number === 2601) {
        const m = /\(([^)]*)\)/.exec(err.message);
        const what = /uq_molds_code/i.test(err.message)
            ? 'A mold with this code already exists'
            : /uq_users_username/i.test(err.message)
              ? 'This username is already taken'
              : /uq_suppliers_name/i.test(err.message)
                ? 'A supplier with this name already exists'
                : `Duplicate value${m ? ` (${m[1]})` : ''}`;
        return new HttpError(409, 'conflict', what);
    }
    if (number === 547) return new HttpError(400, 'bad_request', 'A referenced record does not exist or is still in use');
    return null;
}

const notFoundHandler = (req, _res, next) =>
    next(new HttpError(404, 'not_found', `Route not found: ${req.method} ${req.originalUrl.split('?')[0]}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
    let error = err;
    if (err.type === 'entity.parse.failed') error = new HttpError(400, 'bad_request', 'Malformed JSON body');
    else if (err.type === 'entity.too.large') error = new HttpError(413, 'payload_too_large', 'Request body too large');
    else if (!(err instanceof HttpError)) error = fromSqlError(err) || err;

    if (error instanceof HttpError) {
        const body = { error: { code: error.code, message: error.message } };
        if (error.details) body.error.details = error.details;
        return res.status(error.status).json(body);
    }

    console.error(`[${req.method} ${req.originalUrl}]`, err);
    res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong on the server' } });
};

module.exports = { errorHandler, notFoundHandler };
