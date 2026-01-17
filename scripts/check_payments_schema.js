const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'melann_lending',
});

async function main() {
    try {
        const { rows } = await pool.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'payments'
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
