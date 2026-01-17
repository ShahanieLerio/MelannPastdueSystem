// src/controllers/loanController.js
const db = require('../db');
const { validationResult, body } = require('express-validator');

/** Helper: build WHERE clause from query params */
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
    // Note: Date filtering will be applied in-memory after fetching to ensure reliability
    // matching user requirements for Month Reported vs Date Range
    /*
    if (q.start_date) { ... }
    if (q.end_date) { ... }
    */

    if (q.search) {
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

/** GET /api/loans */
exports.listLoans = async (req, res, next) => {
    try {
        const { where, values } = buildFilters(req.query, req.user);
        const sql = `
      SELECT l.*, c.name as collector_name 
      FROM loans l
      LEFT JOIN collectors c ON l.collector_id = c.collector_id
      ${where} 
      ORDER BY l.borrower_name ASC`;

        const { rows } = await db.query(sql, values);

        console.log('[DEBUG] Loans fetch count (DB):', rows.length);
        console.log('[DEBUG] Query Params:', req.query);

        // In-Memory Date Filtering
        let filtered = rows;
        const { start_date, end_date } = req.query;

        // Parse Helper: "MM-YY" -> YYYYMM integer (e.g. "10-25" -> 202510)
        const parseMonthRep = (str) => {
            if (!str || typeof str !== 'string') return 0;
            const parts = str.trim().split('-');
            if (parts.length !== 2) return 0;
            const m = parseInt(parts[0], 10);
            const y = 2000 + parseInt(parts[1], 10);
            return (y * 100) + m;
        };

        // Parse Helper: YYYY-MM-DD -> YYYYMM integer (e.g. "2025-10-01" -> 202510)
        const parseInputDate = (str) => {
            if (!str) return 0;
            const parts = str.split('-'); // YYYY-MM-DD
            if (parts.length < 2) return 0;
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            return (y * 100) + m;
        };

        if (start_date) {
            const startVal = parseInputDate(start_date);
            console.log('[DEBUG] Filtering Start:', startVal);
            if (startVal > 0) {
                const pre = filtered.length;
                filtered = filtered.filter(l => {
                    const val = parseMonthRep(l.month_reported);
                    // console.log(`[DEBUG] Check ${l.month_reported} (${val}) >= ${startVal}? ${val >= startVal}`);
                    return val >= startVal;
                });
                console.log(`[DEBUG] After Start Filter: ${filtered.length} (Removed ${pre - filtered.length})`);
            }
        }

        if (end_date) {
            const endVal = parseInputDate(end_date);
            console.log('[DEBUG] Filtering End:', endVal);
            if (endVal > 0) {
                const pre = filtered.length;
                filtered = filtered.filter(l => parseMonthRep(l.month_reported) <= endVal);
                console.log(`[DEBUG] After End Filter: ${filtered.length} (Removed ${pre - filtered.length})`);
            }
        }

        console.log('[DEBUG] Final count returning:', filtered.length);
        res.json(filtered);
    } catch (err) {
        console.error('[ERROR] listLoans failed:', err);
        next(err);
    }
};

/** GET /api/loans/:id */
exports.getLoan = async (req, res, next) => {
    try {
        const { rows } = await db.query('SELECT * FROM loans WHERE loan_id = $1', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Loan not found' });
        // If collector, ensure they own the loan
        if (req.user && req.user.role === 'collector') {
            const loan = rows[0];
            const collectorRes = await db.query('SELECT collector_id FROM collectors WHERE user_id = $1', [req.user.userId]);
            if (!collectorRes.rowCount || collectorRes.rows[0].collector_id !== loan.collector_id) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
};

/** Validation chain for create / update */
const loanValidators = [
    body('loan_code').isString().trim().notEmpty(),
    body('collector_id').isUUID(),
    body('borrower_name').isString().trim().notEmpty(),
    body('month_reported').matches(/^\d{2}-\d{2}$/), // MM-YY
    body('due_date').isISO8601(),
    body('outstanding_balance').isFloat({ min: 0 }),
    body('amount_collected').optional().isFloat({ min: 0 }).default(0),
    body('moving_status').optional().isIn(['Moving', 'NM', 'NMSR', 'Paid']).default('Moving'),
    body('location_status').optional().isIn(['L', 'NL']).default('NL'),
    body('area').optional().isString().trim(),
    body('city').optional().isString().trim(),
    body('barangay').optional().isString().trim(),
    body('full_address').optional().isString().trim()
];

/** POST /api/loans */
exports.createLoan = [
    ...loanValidators,
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Validation errors:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        const {
            loan_code, collector_id, borrower_name, month_reported, due_date,
            outstanding_balance, amount_collected = 0, moving_status = 'Moving', location_status = 'NL',
            area, city, barangay, full_address
        } = req.body;
        console.log('Creating loan with payload:', req.body);
        if (Number(amount_collected) > Number(outstanding_balance)) {
            return res.status(400).json({ error: 'Amount collected cannot exceed outstanding balance' });
        }
        try {
            const { rows: completeRows } = await db.withClient(req.user.userId, async (client) => {
                const dup = await client.query('SELECT 1 FROM loans WHERE loan_code = $1', [loan_code]);
                if (dup.rowCount) {
                    const error = new Error('Loan code already exists');
                    error.status = 409;
                    throw error;
                }

                const sql = `INSERT INTO loans (
                    loan_code, collector_id, borrower_name, month_reported, due_date,
                    outstanding_balance, amount_collected, moving_status, location_status,
                    area, city, barangay, full_address
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
                ) RETURNING *`;

                const params = [
                    loan_code,
                    collector_id,
                    borrower_name,
                    month_reported,
                    due_date,
                    Number(outstanding_balance),
                    Number(amount_collected),
                    moving_status,
                    location_status,
                    area,
                    city,
                    barangay,
                    full_address
                ];

                const { rows } = await client.query(sql, params);

                // Fetch name for response
                const { rows: result } = await client.query(
                    'SELECT l.*, c.name as collector_name FROM loans l LEFT JOIN collectors c ON l.collector_id = c.collector_id WHERE l.loan_id = $1',
                    [rows[0].loan_id]
                );
                return result[0];
            });

            res.status(201).json(completeRows);
        } catch (err) {
            if (err.status) return res.status(err.status).json({ error: err.message });
            console.error('Error creating loan:', err);
            next(err);
        }
    }
];

/** PUT /api/loans/:id */
exports.updateLoan = [
    ...loanValidators,
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const loanId = req.params.id;
        try {
            const resultRows = await db.withClient(req.user.userId, async (client) => {
                const existingRes = await client.query('SELECT * FROM loans WHERE loan_id = $1', [loanId]);
                if (!existingRes.rowCount) {
                    const error = new Error('Loan not found');
                    error.status = 404;
                    throw error;
                }
                const existing = existingRes.rows[0];

                // Role‑based field restrictions
                if (req.user && req.user.role === 'collector') {
                    const { amount_collected } = req.body;
                    if (amount_collected === undefined) {
                        const error = new Error('Collectors may only update amount_collected');
                        error.status = 400;
                        throw error;
                    }
                    if (Number(amount_collected) > Number(existing.outstanding_balance)) {
                        const error = new Error('Amount collected cannot exceed outstanding balance');
                        error.status = 400;
                        throw error;
                    }
                    const sql = `UPDATE loans SET amount_collected = $1, updated_at = now() WHERE loan_id = $2 RETURNING *`;
                    const { rows } = await client.query(sql, [amount_collected, loanId]);
                    return rows[0];
                }

                const {
                    loan_code, collector_id, borrower_name, month_reported, due_date,
                    outstanding_balance, amount_collected, moving_status = 'Moving', location_status = 'NL',
                    area, city, barangay, full_address
                } = req.body;

                // Keep existing amount_collected if not provided in payload
                const finalAmountCollected = amount_collected !== undefined ? Number(amount_collected) : Number(existing.amount_collected);

                if (finalAmountCollected > Number(outstanding_balance)) {
                    const error = new Error('Amount collected cannot exceed outstanding balance');
                    error.status = 400;
                    throw error;
                }
                if (loan_code !== existing.loan_code) {
                    const dup = await client.query('SELECT 1 FROM loans WHERE loan_code = $1', [loan_code]);
                    if (dup.rowCount) {
                        const error = new Error('Loan code already exists');
                        error.status = 409;
                        throw error;
                    }
                }
                const sql = `UPDATE loans SET
                    loan_code=$1, collector_id=$2, borrower_name=$3, month_reported=$4, due_date=$5,
                    outstanding_balance=$6, amount_collected=$7, moving_status=$8, location_status=$9,
                    area=$10, city=$11, barangay=$12, full_address=$13,
                    updated_at=now()
                    WHERE loan_id=$14 RETURNING *`;
                const params = [
                    loan_code,
                    collector_id,
                    borrower_name,
                    month_reported,
                    due_date,
                    Number(outstanding_balance),
                    finalAmountCollected,
                    moving_status,
                    location_status,
                    area,
                    city,
                    barangay,
                    full_address,
                    loanId
                ];
                await client.query(sql, params);

                // Join for response
                const { rows: completeRows } = await client.query(
                    'SELECT l.*, c.name as collector_name FROM loans l LEFT JOIN collectors c ON l.collector_id = c.collector_id WHERE l.loan_id = $1',
                    [loanId]
                );
                return completeRows[0];
            });

            res.json(resultRows);
        } catch (err) {
            if (err.status) return res.status(err.status).json({ error: err.message });
            console.error('Error updating loan:', err);
            next(err);
        }
    }
];

/** DELETE /api/loans/:id */
exports.deleteLoan = async (req, res, next) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        const result = await db.query('DELETE FROM loans WHERE loan_id = $1 RETURNING *', [req.params.id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Loan not found' });
        res.json({ message: 'Loan deleted' });
    } catch (err) {
        next(err);
    }
};

/** GET /api/loans/:id/history */
exports.getLoanHistory = async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                lh.field_name, 
                lh.old_value, 
                lh.new_value, 
                lh.changed_at, 
                u.full_name as changed_by_name 
            FROM loan_history lh
            JOIN users u ON lh.changed_by = u.user_id
            WHERE lh.loan_id = $1
            ORDER BY lh.changed_at DESC
        `;
        const { rows } = await db.query(sql, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/** GET /api/loans/:id/payments */
exports.getPaymentHistory = async (req, res, next) => {
    try {
        const sql = `
            SELECT 
                p.payment_id,
                p.amount,
                p.payment_date,
                u.full_name as recorded_by_name,
                l.borrower_name
            FROM payments p
            JOIN users u ON p.recorded_by = u.user_id
            JOIN loans l ON p.loan_id = l.loan_id
            WHERE p.loan_id = $1
            ORDER BY p.payment_date DESC
        `;
        const { rows } = await db.query(sql, [req.params.id]);
        res.json(rows);
    } catch (err) {
        next(err);
    }
};

/** POST /api/loans/:id/payments */
exports.addPayment = async (req, res, next) => {
    const { amount, payment_date } = req.body;
    const loanId = req.params.id;

    if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    try {
        const result = await db.withClient(req.user.userId, async (client) => {
            // Check if loan exists
            const loanRes = await client.query('SELECT outstanding_balance, amount_collected FROM loans WHERE loan_id = $1', [loanId]);
            if (!loanRes.rowCount) {
                const error = new Error('Loan not found');
                error.status = 404;
                throw error;
            }

            const loan = loanRes.rows[0];
            const runningBalance = Number(loan.outstanding_balance) - Number(loan.amount_collected);

            if (Number(amount) > runningBalance) {
                const error = new Error(`Payment amount (₱${Number(amount).toLocaleString()}) exceeds the running balance (₱${Number(runningBalance).toLocaleString()})`);
                error.status = 400;
                throw error;
            }

            const sql = `INSERT INTO payments (loan_id, amount, recorded_by, payment_date) VALUES ($1, $2, $3, COALESCE($4, NOW())) RETURNING *`;
            const { rows } = await client.query(sql, [loanId, Number(amount), req.user.userId, payment_date || null]);
            return rows[0];
        });

        res.status(201).json(result);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        next(err);
    }
};
