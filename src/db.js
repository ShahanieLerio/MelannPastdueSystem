// src/db.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'melann_lending',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    /**
     * Executes a callback within a database client.
     * If userId is provided, sets app.current_user for the transaction.
     */
    withClient: async (userId, callback) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Ensure userId is a valid UUID or use a fallback 'zero' UUID to prevent trigger cast errors
            const dbUserId = (userId && typeof userId === 'string' && userId.trim() !== '')
                ? userId
                : '00000000-0000-0000-0000-000000000000';

            await client.query("SELECT set_config('app.current_user', $1, true)", [dbUserId]);

            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

