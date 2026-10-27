const crypto = require('node:crypto');

/** Wraps an async Express handler so rejected promises reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const DATE_ONLY_KEY = /(_date|deadline)$/;

/** Converts Date values to ISO strings ("YYYY-MM-DD" for DATE columns) and BIT-like flags to booleans. */
function serializeRow(row, booleanKeys = []) {
    if (!row) return row;
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
            out[key] = DATE_ONLY_KEY.test(key) ? value.toISOString().slice(0, 10) : value.toISOString();
        } else if (booleanKeys.includes(key) || key.startsWith('is_')) {
            out[key] = Boolean(value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

const serializeRows = (rows, booleanKeys) => rows.map((r) => serializeRow(r, booleanKeys));

function buildMeta(page, pageSize, total) {
    return { page, page_size: pageSize, total, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Escapes LIKE wildcards so user input is matched literally. */
const likeTerm = (value) => `%${String(value).replace(/[\\%_\[]/g, (c) => `\\${c}`)}%`;

module.exports = { asyncHandler, serializeRow, serializeRows, buildMeta, sha256, likeTerm };
