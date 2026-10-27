/** Application error that is safe to show to API clients. */
class HttpError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const badRequest = (message, details) => new HttpError(400, 'bad_request', message, details);
const unauthorized = (message = 'Authentication required') => new HttpError(401, 'unauthorized', message);
const forbidden = (message = 'You do not have permission to perform this action') => new HttpError(403, 'forbidden', message);
const notFound = (what = 'Resource') => new HttpError(404, 'not_found', `${what} not found`);
const conflict = (message) => new HttpError(409, 'conflict', message);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
