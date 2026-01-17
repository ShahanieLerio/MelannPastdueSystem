// scripts/remove_location_from_collectors.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'melann_lending',
});

async function main() {
    try {
        console.log('🔍 Checking collectors table columns...');
        const { rows } = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'collectors'
        `);
        const columns = rows.map(r => r.column_name);
        console.log('Current columns:', columns.join(', '));

        const colsToRemove = ['area', 'city', 'barangay'];
        let dropped = false;

        for (const col of colsToRemove) {
            if (columns.includes(col)) {
                console.log(`🗑 Dropping column: ${col} from collectors table...`);
                await pool.query(`ALTER TABLE collectors DROP COLUMN IF EXISTS ${col}`);
                dropped = true;
            }
        }

        if (dropped) {
            console.log('✅ Location columns removed from collectors table.');
        } else {
            console.log('✅ No location columns found to remove.');
        }

    } catch (err) {
        console.error('❌ Error cleaning schema:', err.message);
    } finally {
        await pool.end();
    }
}

main();
