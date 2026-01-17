// src/middleware/setUserContext.js
const db = require('../db');

/**
 * Middleware that sets a PostgreSQL session variable with the current user ID.
 * This allows triggers (e.g., loan_history) to record who made the change.
 */
function setUserContext(req, res, next) {
    if (req.user && req.user.userId) {
        // Use SET LOCAL so it only applies to the current transaction/connection.
        // Important: PostgreSQL SET command doesn't always support parameters through all drivers/versions.
        // Using set_config function is more robust with parameterized queries.
        db.query("SELECT set_config('app.current_user', $1, true)", [req.user.userId])
            .then(() => next())
            .catch(err => {
                console.error('Error setting user context:', err);
                next(err);
            });
    } else {
        next();
    }
}

module.exports = { setUserContext };
