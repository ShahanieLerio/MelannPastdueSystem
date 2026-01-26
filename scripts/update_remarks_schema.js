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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_remarks' AND column_name='priority') THEN
        ALTER TABLE loan_remarks ADD COLUMN priority VARCHAR(20) DEFAULT 'Lowest Priority';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_remarks' AND column_name='follow_up_date') THEN
        ALTER TABLE loan_remarks ADD COLUMN follow_up_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loan_remarks' AND column_name='is_read') THEN
        ALTER TABLE loan_remarks ADD COLUMN is_read BOOLEAN DEFAULT FALSE;
    END IF;
END $$;
`;

async function main() {
    try {
        console.log('🚀 Updating loan_remarks schema...');
        await pool.query(sql);
        console.log('✅ Successfully added priority, follow_up_date, and is_read columns.');
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    } finally {
        await pool.end();
    }
}

main();
