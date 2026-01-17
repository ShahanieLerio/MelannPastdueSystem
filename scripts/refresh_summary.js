// scripts/refresh_summary.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'melann_lending',
});

async function main() {
    try {
        console.log('🔄 Refreshing materialized view: loan_summary...');
        await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY loan_summary;');
        console.log('✅ Materialized view refreshed successfully.');
    } catch (err) {
        if (err.code === '42P16') {
            // Materialized view does not have a unique index, cannot refresh concurrently
            console.warn('⚠️ Could not refresh concurrently. Trying normal refresh...');
            try {
                await pool.query('REFRESH MATERIALIZED VIEW loan_summary;');
                console.log('✅ Materialized view refreshed successfully.');
            } catch (innerErr) {
                console.error('❌ Error refreshing materialized view:', innerErr.message);
            }
        } else {
            console.error('❌ Error refreshing materialized view:', err.message);
        }
    } finally {
        await pool.end();
    }
}

main();
