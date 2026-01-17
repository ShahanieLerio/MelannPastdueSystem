// scripts/fix_collector_schema.js
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
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'collectors'
        `);
        console.log('Current columns:', rows.map(r => `${r.column_name} (Nullable: ${r.is_nullable})`).join(', '));

        const hasArea = rows.some(r => r.column_name === 'area');
        const hasCity = rows.some(r => r.column_name === 'city');
        const hasBrgy = rows.some(r => r.column_name === 'barangay');

        if (hasArea || hasCity || hasBrgy) {
            console.log('🛠 Fixing NOT NULL constraints on collectors table...');
            if (hasArea) await pool.query('ALTER TABLE collectors ALTER COLUMN area DROP NOT NULL');
            if (hasCity) await pool.query('ALTER TABLE collectors ALTER COLUMN city DROP NOT NULL');
            if (hasBrgy) await pool.query('ALTER TABLE collectors ALTER COLUMN barangay DROP NOT NULL');
            console.log('✅ Constraints updated.');
        } else {
            console.log('✅ No location columns found in collectors table that need fixing.');
        }

    } catch (err) {
        console.error('❌ Error fixing schema:', err.message);
    } finally {
        await pool.end();
    }
}

main();
