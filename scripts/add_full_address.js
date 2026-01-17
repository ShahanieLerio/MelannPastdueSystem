require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'melann_lending',
});

const sql = `
ALTER TABLE loans ADD COLUMN IF NOT EXISTS full_address TEXT;
`;

async function main() {
    try {
        console.log('🚀 Adding partial address column...');
        await pool.query(sql);
        console.log('✅ Successfully added full_address column.');
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    } finally {
        await pool.end();
    }
}

main();
