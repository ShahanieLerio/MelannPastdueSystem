// src/routes/export.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { Parser } = require('json2csv'); // for CSV export (install json2csv)
const PDFDocument = require('pdfkit'); // for PDF export (install pdfkit)

/** Helper: fetch loans (same filter logic as loanController) */
function buildFilters(q) {
    const clauses = [];
    const values = [];
    let idx = 1;
    if (q.collector_id) { clauses.push(`collector_id = $${idx++}`); values.push(q.collector_id); }
    if (q.moving_status) { clauses.push(`moving_status = $${idx++}`); values.push(q.moving_status); }
    if (q.location_status) { clauses.push(`location_status = $${idx++}`); values.push(q.location_status); }
    if (q.month_reported) { clauses.push(`month_reported = $${idx++}`); values.push(q.month_reported); }
    if (q.overdue === 'true') { clauses.push(`due_date < CURRENT_DATE AND running_balance > 0`); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return { where, values };
}

// GET /api/export/csv
router.get('/csv', async (req, res, next) => {
    try {
        const { where, values } = buildFilters(req.query);
        const sql = `SELECT loan_code, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, moving_status, location_status FROM loans ${where}`;
        const { rows } = await db.query(sql, values);
        const fields = ['loan_code', 'borrower_name', 'month_reported', 'due_date', 'outstanding_balance', 'amount_collected', 'running_balance', 'moving_status', 'location_status'];
        const parser = new Parser({ fields });
        const csv = parser.parse(rows);
        res.header('Content-Type', 'text/csv');
        res.attachment('loans_export.csv');
        res.send(csv);
    } catch (err) { next(err); }
});

// GET /api/export/pdf
router.get('/pdf', async (req, res, next) => {
    try {
        const { where, values } = buildFilters(req.query);
        const sql = `SELECT loan_code, borrower_name, month_reported, due_date, outstanding_balance, amount_collected, running_balance, moving_status, location_status FROM loans ${where}`;
        const { rows } = await db.query(sql, values);
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="loans_export.pdf"');
        doc.pipe(res);
        doc.fontSize(14).text('Melann Lending – Loan Export', { align: 'center' });
        doc.moveDown();
        const tableTop = 80;
        const colWidths = [80, 80, 60, 60, 70, 70, 70, 60, 60];
        const headers = ['Loan Code', 'Borrower', 'Month', 'Due', 'Outstanding', 'Collected', 'Running', 'Status', 'Location'];
        // Header row
        let x = doc.x;
        headers.forEach((h, i) => { doc.text(h, x, tableTop, { width: colWidths[i], align: 'left' }); x += colWidths[i]; });
        // Data rows
        let y = tableTop + 20;
        rows.forEach(row => {
            x = doc.x;
            const values = [row.loan_code, row.borrower_name, row.month_reported, row.due_date.toISOString().split('T')[0], row.outstanding_balance, row.amount_collected, row.running_balance, row.moving_status, row.location_status];
            values.forEach((v, i) => { doc.text(String(v), x, y, { width: colWidths[i], align: 'left' }); x += colWidths[i]; });
            y += 15;
        });
        doc.end();
    } catch (err) { next(err); }
});

module.exports = router;
