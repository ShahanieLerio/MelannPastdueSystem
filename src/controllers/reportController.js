// src/controllers/reportController.js
const db = require('../db');

/**
 * Aging of Receivables
 * Buckets: 0-30, 31-60, 61-90, 90+ days past due
 */
exports.getAgingReport = async (req, res, next) => {
  try {
    const sql = `
      WITH buckets_data AS (
        SELECT 
          COALESCE(c.name, 'Unassigned') as collector_name,
          CASE 
            WHEN (CURRENT_DATE - l.due_date) BETWEEN 1 AND 30 THEN '1-30 Days'
            WHEN (CURRENT_DATE - l.due_date) BETWEEN 31 AND 45 THEN '31-45 Days'
            WHEN (CURRENT_DATE - l.due_date) BETWEEN 46 AND 60 THEN '46-60 Days'
            WHEN (CURRENT_DATE - l.due_date) BETWEEN 61 AND 90 THEN '61-90 Days'
            WHEN (CURRENT_DATE - l.due_date) BETWEEN 91 AND 120 THEN '91-120 Days'
            WHEN (CURRENT_DATE - l.due_date) > 120 THEN '120+ Days'
            ELSE NULL -- Current or future
          END as bucket,
          l.outstanding_balance,
          l.amount_collected,
          l.running_balance
        FROM loans l
        LEFT JOIN collectors c ON l.collector_id = c.collector_id
        WHERE l.moving_status != 'Paid'
      )
      SELECT 
        collector_name,
        bucket,
        COUNT(*) as accounts,
        SUM(outstanding_balance) as reported_amount,
        SUM(amount_collected) as collected_amount,
        SUM(running_balance) as ending_balance
      FROM buckets_data
      WHERE bucket IS NOT NULL
      GROUP BY collector_name, bucket
      ORDER BY 
        collector_name, 
        CASE bucket
          WHEN '1-30 Days' THEN 1
          WHEN '31-45 Days' THEN 2
          WHEN '46-60 Days' THEN 3
          WHEN '61-90 Days' THEN 4
          WHEN '91-120 Days' THEN 5
          WHEN '120+ Days' THEN 6
        END;
    `;
    const { rows } = await db.query(sql);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Collector Performance Report
 * Metrics: Accounts, Total Outstanding, Amount Collected, Collection %, Paid Count
 */
exports.getCollectorPerformance = async (req, res, next) => {
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
    const { rows } = await db.query(sql);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/**
 * Masterlist & Monitoring Report
 * Grouped by Area -> Collector
 * Shows loan details + monthly payment columns for a given year
 */
exports.getMasterlist = async (req, res, next) => {
  const year = req.query.year || new Date().getFullYear();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  try {
    const sql = `
      SELECT 
        l.loan_id,
        l.area,
        l.city,
        l.barangay,
        c.name as collector_name,
        l.borrower_name,
        l.month_reported,
        l.outstanding_balance as principal,
        l.amount_collected as total_collected_lifetime,
        l.running_balance,
        l.moving_status,
        -- Aggregate payments for the selected year by month
        (
          SELECT json_agg(json_build_object('month', to_char(p.payment_date, 'MM'), 'amount', p.amount))
          FROM payments p
          WHERE p.loan_id = l.loan_id
          AND p.payment_date >= $1 AND p.payment_date <= $2
        ) as payments_breakdown
      FROM loans l
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      ORDER BY l.area NULLS LAST, c.name NULLS LAST, l.borrower_name
    `;

    const result = await db.query(sql, [startDate, endDate]);

    // Process rows to pivot payments in JS
    const processed = result.rows.map(row => {
      const monthly = {};
      // Init 01-12
      for (let i = 1; i <= 12; i++) {
        monthly[i.toString().padStart(2, '0')] = 0;
      }
      if (row.payments_breakdown) {
        row.payments_breakdown.forEach(p => {
          if (monthly[p.month] !== undefined) {
            monthly[p.month] += Number(p.amount);
          }
        });
      }
      return {
        ...row,
        monthly_payments: monthly,
        payments_breakdown: undefined // Remove raw
      };
    });

    res.json(processed);
  } catch (err) {
    next(err);
  }
};

/**
 * Monthly Summary Report
 * Modes: 'reported' (Past Due from Loan Records) or 'collection' (Payments from Transactions)
 * Pivot: Collector x Month
 */
exports.getMonthlyReport = async (req, res, next) => {
  const year = req.query.year || new Date().getFullYear();
  const type = req.query.type || 'reported'; // 'reported' or 'collection'

  try {
    let rows = [];

    if (type === 'reported') {
      // Sum 'outstanding_balance' grouped by Collector and Month Reported (MM-YY)
      // Note: month_reported is stored as 'MM-YY'. We only care if the year part matches the requested year?
      // Or essentially just group whatever is in 'month_reported'.
      // The user likely wants to see specific year's data. 
      // Let's assume month_reported 'MM-YY' year suffix matches 'YY'.
      const shortYear = year.toString().slice(-2);

      const sql = `
        SELECT 
          c.name as collector_name,
          l.month_reported, 
          SUM(l.outstanding_balance) as total_amount
        FROM loans l
        LEFT JOIN collectors c ON l.collector_id = c.collector_id
        WHERE l.month_reported LIKE $1
        GROUP BY c.name, l.month_reported
        ORDER BY c.name
      `;
      const result = await db.query(sql, [`%-${shortYear}`]);
      rows = result.rows;

    } else {
      // 45-day intervals for Collection Report
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const sql = `
        SELECT 
          c.name as collector_name,
          CASE 
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '01-01' AND '02-15' THEN 'Period 1'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '02-16' AND '03-31' THEN 'Period 2'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '04-01' AND '05-15' THEN 'Period 3'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '05-16' AND '06-30' THEN 'Period 4'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '07-01' AND '08-15' THEN 'Period 5'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '08-16' AND '09-30' THEN 'Period 6'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '10-01' AND '11-15' THEN 'Period 7'
            WHEN to_char(p.payment_date, 'MM-DD') BETWEEN '11-16' AND '12-31' THEN 'Period 8'
            ELSE 'Unknown'
          END as period,
          SUM(p.amount) as total_amount
        FROM payments p
        JOIN loans l ON p.loan_id = l.loan_id
        LEFT JOIN collectors c ON l.collector_id = c.collector_id
        WHERE p.payment_date >= $1 AND p.payment_date <= $2
        GROUP BY c.name, period
        ORDER BY c.name
      `;
      const result = await db.query(sql, [startDate, endDate]);
      rows = result.rows;
    }

    // Pivot Data
    const pivoted = {};

    rows.forEach(r => {
      const col = r.collector_name || 'Unassigned';
      if (!pivoted[col]) {
        pivoted[col] = { collector: col, total: 0, periods: {}, months: {} };
        // Init months for compatibility
        for (let i = 1; i <= 12; i++) pivoted[col].months[i.toString().padStart(2, '0')] = 0;
        // Init periods
        for (let i = 1; i <= 8; i++) pivoted[col].periods[`Period ${i}`] = 0;
      }

      if (type === 'reported') {
        // Existing Logic for Reported
        const [mm] = r.month_reported.split('-');
        if (pivoted[col].months[mm] !== undefined) {
          pivoted[col].months[mm] += Number(r.total_amount);
          pivoted[col].total += Number(r.total_amount);
        }
      } else {
        // New Logic for Collection
        if (pivoted[col].periods[r.period] !== undefined) {
          pivoted[col].periods[r.period] += Number(r.total_amount);
          pivoted[col].total += Number(r.total_amount);
        }
      }
    });


    res.json(Object.values(pivoted));

  } catch (err) {
  }
};

/**
 * Collection Summary Report (Date Range)
 * Sums total collections by Collector within a Date Range.
 */
exports.getCollectionSummary = async (req, res, next) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Start date and End date are required.' });
  }

  try {
    const sql = `
      SELECT 
        COALESCE(c.name, 'Unassigned') as collector_name,
        SUM(p.amount) as total_collected
      FROM payments p
      JOIN loans l ON p.loan_id = l.loan_id
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      WHERE p.payment_date >= $1 AND p.payment_date <= $2
      GROUP BY c.name
      ORDER BY total_collected DESC
    `;
    const { rows } = await db.query(sql, [start_date, end_date]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};
