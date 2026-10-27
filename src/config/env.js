require('dotenv').config();

const bool = (value, fallback) => {
    if (value === undefined || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
};

/**
 * Reads configuration from process.env on every call so tests can override
 * variables (e.g. DB_NAME) before building the app.
 */
function loadConfig() {
    const env = process.env;
    return {
        env: env.NODE_ENV || 'development',
        isProduction: env.NODE_ENV === 'production',
        isTest: env.NODE_ENV === 'test',
        port: int(env.PORT, 5000),
        trustProxy: bool(env.TRUST_PROXY, false),
        corsOrigins: (env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        db: {
            server: env.DB_SERVER || 'localhost',
            port: int(env.DB_PORT, 1433),
            database: env.DB_NAME || 'MoldTracking',
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            options: {
                encrypt: bool(env.DB_ENCRYPT, false),
                trustServerCertificate: bool(env.DB_TRUST_CERT, true),
            },
            pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
        },
        auth: {
            jwtSecret: env.JWT_SECRET,
            accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
            refreshTokenTtlDays: int(env.REFRESH_TOKEN_TTL_DAYS, 7),
            cookieSecure: bool(env.COOKIE_SECURE, false),
            bcryptRounds: int(env.BCRYPT_ROUNDS, 10),
        },
        rateLimit: {
            loginMax: int(env.LOGIN_RATE_LIMIT_MAX, 10),
            loginWindowMin: int(env.LOGIN_RATE_LIMIT_WINDOW_MIN, 15),
            apiMax: int(env.API_RATE_LIMIT_MAX, 600),
        },
        seedPassword: env.SEED_PASSWORD || 'Demo-2026',
    };
}

function assertConfig(config) {
    const problems = [];
    if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 16) {
        problems.push('JWT_SECRET must be set to a random string of at least 16 characters');
    }
    if (!config.db.user || !config.db.password) {
        problems.push('DB_USER and DB_PASSWORD must be set');
    }
    if (problems.length) {
        throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}\nCopy .env.example to .env and fill it in.`);
    }
}

module.exports = { loadConfig, assertConfig };
