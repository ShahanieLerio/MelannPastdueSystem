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
        console.log('Checking for "status" column in "users" table...');

        // Check if column exists
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='status'
        `);

        if (res.rows.length === 0) {
            console.log('Column "status" does not exist. Adding it...');
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending' 
                CHECK (status IN ('pending', 'active', 'rejected'))
            `);
            console.log('✅ Column "status" added successfully.');
        } else {
            console.log('✅ Column "status" already exists.');
        }

        console.log('Ensuring "admin" user is active...');
        await pool.query(`UPDATE users SET status = 'active' WHERE username = 'admin'`);
        console.log('✅ Admin status set to active.');

    } catch (err) {
        console.error('❌ Error checking/updating schema:', err);
    } finally {
        await pool.end();
    }
}

main();
