// scripts/update_schema_payments.js
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
-- Create Payments table
CREATE TABLE IF NOT EXISTS payments (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    recorded_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger to update loans.amount_collected when a payment is added
CREATE OR REPLACE FUNCTION trg_update_loan_collected()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE loans 
    SET amount_collected = amount_collected + NEW.amount,
        updated_at = now()
    WHERE loan_id = NEW.loan_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_payment_insert ON payments;

CREATE TRIGGER trg_after_payment_insert
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION trg_update_loan_collected();
`;

async function main() {
    try {
        console.log('🚀 Updating database schema to include payments...');
        await pool.query(sql);
        console.log('✅ Successfully added payments table and trigger.');
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
    } finally {
        await pool.end();
    }
}

main();
