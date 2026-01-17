// scripts/update_schema_location_fields.js
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
-- 1. Add Area, City, and Barangay columns to loans table
ALTER TABLE loans ADD COLUMN IF NOT EXISTS area VARCHAR(100);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS barangay VARCHAR(100);

-- 2. Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_loans_area ON loans(area);
CREATE INDEX IF NOT EXISTS idx_loans_city ON loans(city);
CREATE INDEX IF NOT EXISTS idx_loans_barangay ON loans(barangay);

-- 3. Update audit trigger function if needed (optional, but keep it consistent)
-- Existing trg_loan_audit only audits specific fields. Let's add these if we want history.
`;

async function main() {
    try {
        console.log('🚀 Updating database schema to include Area, City, and Barangay...');
        await pool.query(sql);
        console.log('✅ Successfully added location fields and indexes.');
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    } finally {
        await pool.end();
    }
}

main();
