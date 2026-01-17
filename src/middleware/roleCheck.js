// src/middleware/roleCheck.js
/**
 * Middleware factory that checks if the authenticated user has one of the allowed roles.
 * Usage: app.use('/api/collector', verifyToken, checkRole(['collector', 'admin']), collectorRoutes);
 */
function checkRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}

module.exports = { checkRole };
