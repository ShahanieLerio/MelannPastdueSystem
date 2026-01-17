const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'melann_lending',
});

async function test() {
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables in database:', res.rows.map(r => r.table_name));
        process.exit(0);
    } catch (err) {
        console.error('Database connection error:', err.message);
        process.exit(1);
    }
}

test();
