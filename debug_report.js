const db = require('./src/db');

async function testQuery() {
    try {
        const sql = `
      SELECT 
        COALESCE(c.name, 'Unassigned') as collector_name,
        COUNT(l.loan_id) as total_accounts,
        SUM(l.outstanding_balance) as total_outstanding,
        SUM(l.amount_collected) as total_collected,
        SUM(l.running_balance) as total_running_balance,
        ROUND((SUM(l.amount_collected) / NULLIF(SUM(l.outstanding_balance), 0)) * 100, 2) as collection_rate,
        COUNT(l.loan_id) FILTER (WHERE l.moving_status = 'Paid') as paid_accounts
      FROM loans l
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      GROUP BY c.name
      ORDER BY total_collected DESC;
    `;
        console.log("Running Query...");
        const { rows } = await db.query(sql);
        console.log("Query Result:", JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error("Query Error:", err);
    }
}

testQuery();
