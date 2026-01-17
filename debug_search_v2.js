const db = require('./src/db');

// Mock buildFilters from controller
function buildFilters(q, user) {
    const clauses = [];
    const values = [];
    let idx = 1;
    // Role‑based restriction: collectors see only their own loans
    if (user && user.role === 'collector') {
        clauses.push(`l.collector_id = (SELECT collector_id FROM collectors WHERE user_id = $${idx++})`);
        values.push(user.userId);
    } else {
        if (q.collector_id) { clauses.push(`l.collector_id = $${idx++}`); values.push(q.collector_id); }
    }
    if (q.moving_status) { clauses.push(`l.moving_status = $${idx++}`); values.push(q.moving_status); }
    if (q.location_status) { clauses.push(`l.location_status = $${idx++}`); values.push(q.location_status); }
    if (q.month_reported) { clauses.push(`l.month_reported = $${idx++}`); values.push(q.month_reported); }
    if (q.overdue === 'true') { clauses.push(`l.due_date < CURRENT_DATE AND l.running_balance > 0`); }

    if (q.search) {
        // EXACT match of controller logic
        clauses.push(`(l.borrower_name ILIKE $${idx} OR l.loan_code::text ILIKE $${idx})`);
        values.push(`%${q.search}%`);
        idx++;
    }
    if (q.code) {
        clauses.push(`l.loan_code = $${idx++}`);
        values.push(q.code);
    }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { where, values };
}

async function run() {
    try {
        const user = { role: 'admin' };
        const q = { search: '3027' };

        const { where, values } = buildFilters(q, user);
        const sql = `
      SELECT l.*, c.name as collector_name 
      FROM loans l
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      ${where} 
      ORDER BY l.borrower_name ASC`;

        console.log('SQL:', sql);
        console.log('Values:', values);

        const { rows } = await db.query(sql, values);
        console.log('Rows found:', rows.length);
        if (rows.length > 0) {
            console.log('First row code:', rows[0].loan_code);
            console.log('First row name:', rows[0].borrower_name);
        }

    } catch (err) {
        console.error('An error occurred:', err);
    } finally {
        process.exit();
    }
}

run();
