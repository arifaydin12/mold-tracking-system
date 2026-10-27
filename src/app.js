const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const { loadConfig } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const createApiRouter = require('./routes');

const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');

/** Builds the Express application (no listening, no DB connection - see server.js). */
function createApp(config = loadConfig()) {
    const app = express();
    app.disable('x-powered-by');
    if (config.trustProxy) app.set('trust proxy', 1);

    app.use(helmet());
    app.use(
        cors({
            origin(origin, cb) {
                // Same-origin / curl requests carry no Origin header.
                if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
                return cb(null, false);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        }),
    );
    if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    // API documentation (handwritten OpenAPI document rendered with Swagger UI)
    const spec = YAML.parse(fs.readFileSync(openapiPath, 'utf8'));
    app.get('/api/docs/openapi.json', (_req, res) => res.json(spec));
    app.use(
        '/api/docs',
        (req, res, next) => {
            // Swagger UI ships inline bootstrap code, so the strict default CSP is relaxed for this page only.
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:");
            next();
        },
        swaggerUi.serve,
        swaggerUi.setup(spec, { customSiteTitle: 'Mold Tracking API', swaggerOptions: { persistAuthorization: true } }),
    );

    app.use('/api', apiLimiter(config.rateLimit), createApiRouter(config));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

module.exports = { createApp };
