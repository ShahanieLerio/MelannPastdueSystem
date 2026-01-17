const db = require('./src/db');

async function testQuery() {
    console.log("Testing Aging Report...");
    try {
        const sqlAging = `
      SELECT 
        CASE 
          WHEN (CURRENT_DATE - due_date) <= 0 THEN 'Current'
          WHEN (CURRENT_DATE - due_date) <= 30 THEN '1-30 Days'
          WHEN (CURRENT_DATE - due_date) <= 60 THEN '31-60 Days'
          WHEN (CURRENT_DATE - due_date) <= 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END AS bucket,
        COUNT(*) as count,
        SUM(running_balance) as total_balance
      FROM loans
      WHERE moving_status != 'Paid'
      GROUP BY bucket
      ORDER BY 
        CASE bucket
          WHEN 'Current' THEN 1
          WHEN '1-30 Days' THEN 2
          WHEN '31-60 Days' THEN 3
          WHEN '61-90 Days' THEN 4
          WHEN '90+ Days' THEN 5
        END;
    `;
        const resAging = await db.query(sqlAging);
        console.log("Aging Result:", JSON.stringify(resAging.rows, null, 2));
    } catch (err) {
        console.error("Aging Query Error:", err);
    }

    console.log("Testing Performance Report...");
    try {
        const sqlPerf = `
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
        const resPerf = await db.query(sqlPerf);
        console.log("Performance Result:", JSON.stringify(resPerf.rows, null, 2));

    } catch (err) {
        console.error("Performance Query Error:", err);
    }
}

testQuery();
