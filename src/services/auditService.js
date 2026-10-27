const { query } = require('../db/pool');

/**
 * Appends a row to activity_logs. A failure to write the audit trail is reported
 * but never turns an already-completed operation into an error response.
 */
async function logActivity({ userId = null, action, entityType = null, entityId = null, description = null }) {
    try {
        await query(
            `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description)
             VALUES (@userId, @action, @entityType, @entityId, @description)`,
            { userId, action, entityType, entityId, description: description && description.slice(0, 2000) },
        );
    } catch (err) {
        console.error('Failed to write activity log:', err.message);
    }
}

/** Records a login attempt (successful or not). */
async function logLogin({ userId = null, username, success, ip = null, userAgent = null }) {
    try {
        await query(
            `INSERT INTO login_logs (user_id, username, success, ip_address, user_agent)
             VALUES (@userId, @username, @success, @ip, @userAgent)`,
            {
                userId,
                username: String(username).slice(0, 50),
                success: success ? 1 : 0,
                ip: ip && String(ip).slice(0, 64),
                userAgent: userAgent && String(userAgent).slice(0, 255),
            },
        );
    } catch (err) {
        console.error('Failed to write login log:', err.message);
    }
}

module.exports = { logActivity, logLogin };
