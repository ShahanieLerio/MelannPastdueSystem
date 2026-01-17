const db = require('./src/db');

async function run() {
    try {
        console.log('Checking column types...');
        const schema = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'loans' AND column_name IN ('borrower_name', 'loan_code');
    `);
        console.log(schema.rows);

        console.log('Testing search query with "3027"...');
        const q1 = "3027";
        const sql1 = `
      SELECT l.*, c.name as collector_name 
      FROM loans l
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      WHERE (l.borrower_name ILIKE $1 OR l.loan_code ILIKE $1)
      ORDER BY l.borrower_name ASC`;

        // Note: In controller we used: values.push(`%${q.search}%`)
        const res1 = await db.query(sql1, [`%${q1}%`]);
        console.log('Result count for 3027:', res1.rows.length);

        console.log('Testing search query with "Abing"...');
        const q2 = "Abing";
        const res2 = await db.query(sql1, [`%${q2}%`]);
        console.log('Result count for Abing:', res2.rows.length);

    } catch (err) {
        console.error('An error occurred:', err);
    } finally {
        // We cannot easily close the pool if it's not exposed, but the script will exit eventually or we force it.
        process.exit();
    }
}

run();
