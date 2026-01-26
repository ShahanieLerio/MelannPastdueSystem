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
CREATE TABLE IF NOT EXISTS loan_remarks (
    remark_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    remark TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
`;

async function main() {
    try {
        console.log('🚀 Adding loan_remarks table...');
        await pool.query(sql);
        console.log('✅ Successfully added loan_remarks table.');
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    } finally {
        await pool.end();
    }
}

main();
