const { HttpError } = require('../utils/errors');

/** Turns zod issues into [{ field, message }] with dotted field paths. */
function formatIssues(error) {
    return error.issues.map((issue) => ({
        field: issue.path.join('.') || '_',
        message: issue.message,
    }));
}

/**
 * validate({ body, query, params }) parses each part with the given zod schema and
 * replaces it with the parsed (trimmed, coerced, defaulted) value.
 */
const validate = (schemas) => (req, _res, next) => {
    const details = [];
    for (const part of ['params', 'query', 'body']) {
        if (!schemas[part]) continue;
        const input = part === 'body' && req.body === undefined ? {} : req[part];
        const result = schemas[part].safeParse(input);
        if (result.success) {
            if (part === 'query') {
                Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
            } else {
                req[part] = result.data;
            }
        } else {
            // one message per field is enough for the client
            const seen = new Set();
            for (const d of formatIssues(result.error)) {
                if (!seen.has(d.field)) {
                    seen.add(d.field);
                    details.push({ ...d, in: part });
                }
            }
        }
    }
    if (details.length) return next(new HttpError(400, 'validation_error', 'Validation failed', details));
    next();
};

module.exports = { validate, formatIssues };
