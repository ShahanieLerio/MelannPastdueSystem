// scripts/seed.js
/*
  Simple seed script to create an admin user, a collector, and sample loans.
  Run with: npm run seed
*/
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'melann_lending',
});

async function main() {
    try {
        // 0. Ensure status column exists (migration-like step)
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected'))`);
        } catch (e) {
            console.log('ℹ️ Status column might already exist or error:', e.message);
        }

        // 1. Create admin user
        const adminPassword = 'AdminPass123';
        const hash = await bcrypt.hash(adminPassword, 12);
        const adminRes = await pool.query(
            `INSERT INTO users (username, full_name, email, role, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'
       RETURNING user_id`,
            ['admin', 'System Administrator', 'admin@example.com', 'admin', hash]
        );
        const adminId = adminRes.rows[0].user_id;
        console.log('✅ Admin user created (or updated). Username: admin, password:', adminPassword);

        // 2. Create a collector linked to admin
        // Find if collector already exists by name
        const checkCollector = await pool.query('SELECT collector_id FROM collectors WHERE name = $1', ['Sir Jhun']);
        let collectorId;
        if (checkCollector.rowCount > 0) {
            collectorId = checkCollector.rows[0].collector_id;
            console.log('ℹ️ Collector already exists. Name: Sir Jhun');
        } else {
            const collectorRes = await pool.query(
                `INSERT INTO collectors (user_id, name)
           VALUES ($1, $2)
           RETURNING collector_id`,
                [adminId, 'Sir Jhun']
            );
            collectorId = collectorRes.rows[0].collector_id;
            console.log('✅ Collector created. Name: Sir Jhun');
        }

        // 3. Insert sample loans (if none exist)
        const loanCountRes = await pool.query('SELECT COUNT(*) FROM loans');
        const loanCount = parseInt(loanCountRes.rows[0].count, 10);
        if (loanCount === 0) {
            const sampleLoans = [
                {
                    loan_code: 'LN-001',
                    borrower_name: 'Juan Dela Cruz',
                    month_reported: '01-26',
                    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks ahead
                    outstanding_balance: 50000,
                    amount_collected: 0,
                    moving_status: 'Moving',
                    location_status: 'NL',
                },
                {
                    loan_code: 'LN-002',
                    borrower_name: 'Maria Santos',
                    month_reported: '01-26',
                    due_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days overdue
                    outstanding_balance: 75000,
                    amount_collected: 20000,
                    moving_status: 'Moving',
                    location_status: 'L',
                },
                {
                    loan_code: 'LN-003',
                    borrower_name: 'Pedro Reyes',
                    month_reported: '01-26',
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days ahead
                    outstanding_balance: 120000,
                    amount_collected: 120000,
                    moving_status: 'Paid',
                    location_status: 'L',
                },
            ];

            for (const loan of sampleLoans) {
                await pool.query(
                    `INSERT INTO loans (loan_code, collector_id, borrower_name, month_reported, due_date,
                           outstanding_balance, amount_collected, moving_status, location_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [
                        loan.loan_code,
                        collectorId,
                        loan.borrower_name,
                        loan.month_reported,
                        loan.due_date,
                        loan.outstanding_balance,
                        loan.amount_collected,
                        loan.moving_status,
                        loan.location_status,
                    ]
                );
                console.log(`✅ Inserted loan ${loan.loan_code}`);
            }
        } else {
            console.log('ℹ️ Loans already exist, skipping sample data insertion.');
        }
    } catch (err) {
        console.error('❌ Seed script error:', err);
    } finally {
        await pool.end();
        console.log('🔚 Seed script finished.');
    }
}

main();
