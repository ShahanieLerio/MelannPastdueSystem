// src/middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT token and attach user info to request
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access token missing' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        // user payload should contain at least { userId, role }
        req.user = user;
        next();
    });
}

module.exports = { verifyToken };
