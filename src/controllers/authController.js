// src/controllers/authController.js
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * POST /api/auth/login
 * Expected body: { username, password }
 * Returns: { token, user: { id, username, full_name, role } }
 */
async function login(req, res, next) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    try {
        const { rows } = await db.query('SELECT user_id, username, full_name, role, password_hash, status FROM users WHERE username = $1', [username]);
        if (!rows.length) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const user = rows[0];

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is pending approval. Please contact the administrator.' });
        }

        const payload = {
            userId: user.user_id,
            username: user.username,
            role: user.role,
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, user: { id: user.user_id, username: user.username, full_name: user.full_name, role: user.role } });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/auth/register
 * Expected body: { username, password, full_name, role }
 */
async function register(req, res, next) {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Default role to collector if not provided or invalid, strictly checked against schema constraint
    const validRoles = ['admin', 'supervisor', 'collector'];
    const userRole = validRoles.includes(role) ? role : 'collector';

    try {
        // Check if user exists
        const check = await db.query('SELECT user_id FROM users WHERE username = $1 OR email = $2', [username, `${username}@example.com`]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hash = await bcrypt.hash(password, 12);
        // We'll generate a dummy email since it's required by schema but not asked in the simple UI request
        // ideally UI asks for email. For now, let's append a dummy domain.
        const email = `${username}_${Date.now()}@melann.local`;

        const { rows } = await db.query(
            `INSERT INTO users (username, full_name, email, role, password_hash, status)
             VALUES ($1, $2, $3, $4, $5, 'pending')
             RETURNING user_id, username, full_name, role, status, created_at`,
            [username, full_name, email, userRole, hash]
        );

        const newUser = rows[0];
        // Don't auto-login, just return success
        res.status(201).json({ message: 'Registration successful! Please wait for admin approval.', user: newUser });
    } catch (err) {
        next(err);
    }
}

async function listPendingUsers(req, res, next) {
    try {
        const { rows } = await db.query("SELECT user_id, username, full_name, role, status, created_at FROM users WHERE status = 'pending' ORDER BY created_at DESC");
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

async function approveUser(req, res, next) {
    const { id } = req.params;
    const { status } = req.body; // Expect { status: 'active' } or 'rejected'

    if (!['active', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use 'active' or 'rejected'." });
    }

    try {
        const { rows } = await db.query(
            'UPDATE users SET status = $1, updated_at = now() WHERE user_id = $2 RETURNING user_id, username, status',
            [status, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: `User ${rows[0].username} is now ${status}`, user: rows[0] });
    } catch (err) {
        next(err);
    }
}

async function listCollectors(req, res, next) {
    try {
        const { rows } = await db.query('SELECT * FROM collectors ORDER BY name ASC');
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

async function createCollector(req, res, next) {
    const { name } = req.body;
    console.log('Creating collector:', { name, userId: req.user.userId });
    try {
        const { rows } = await db.query(
            'INSERT INTO collectors (name, user_id) VALUES ($1, $2) RETURNING *',
            [name, req.user.userId]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating collector:', err);
        next(err);
    }
}

async function updateCollector(req, res, next) {
    const { name } = req.body;
    try {
        const { rows } = await db.query(
            'UPDATE collectors SET name = $1, updated_at = now() WHERE collector_id = $2 RETURNING *',
            [name, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Collector not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
}

async function deleteCollector(req, res, next) {
    try {
        await db.query('DELETE FROM collectors WHERE collector_id = $1', [req.params.id]);
        res.sendStatus(204);
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ error: 'Cannot delete collector with assigned loans' });
        next(err);
    }
}

module.exports = { login, register, listPendingUsers, approveUser, listCollectors, createCollector, updateCollector, deleteCollector };
