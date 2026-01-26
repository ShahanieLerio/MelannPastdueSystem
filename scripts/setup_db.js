const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'melann_lending',
        // No explicit SSL for local fallback unless configured
    };

const pool = new Pool(poolConfig);

async function setupDatabase() {
    try {
        const schemaPath = path.join(__dirname, '..', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Reading schema from:', schemaPath);
        console.log('Connecting to database...');

        // Execute the schema SQL
        await pool.query(schemaSql);

        console.log('✅ Schema applied successfully!');

        // Verify tables
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables created:', res.rows.map(r => r.table_name));

    } catch (err) {
        console.error('❌ Error setting up database:', err);
    } finally {
        await pool.end();
    }
}

setupDatabase();
