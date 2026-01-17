require('dotenv').config();
const db = require('./src/db');

async function testFilter() {
    try {
        console.log('--- Debugging Date Filter Logic ---');

        // Emulate parameters: Start 2024-01-01, End 2025-12-31
        // Expected Targets: "24-01", "25-12"
        const startTarget = '24-01';
        // const endTarget = '25-12';
        const endTarget = '25-12';

        console.log(`Filtering for YY-MM between ${startTarget} AND ${endTarget}`);

        const sql = `
            SELECT loan_code, borrower_name, month_reported,
                   (substring(month_reported, 4, 2) || '-' || substring(month_reported, 1, 2)) as converted_yymm
            FROM loans
            WHERE 
              (substring(month_reported, 4, 2) || '-' || substring(month_reported, 1, 2)) >= $1
              AND
              (substring(month_reported, 4, 2) || '-' || substring(month_reported, 1, 2)) <= $2
            LIMIT 20;
        `;

        const res = await db.query(sql, [startTarget, endTarget]);

        console.log(`Found ${res.rowCount} records matching conditions.`);
        res.rows.forEach(r => {
            console.log(`[MATCH] ${r.borrower_name} (${r.month_reported}) -> Converted: ${r.converted_yymm}`);
        });

        console.log('--- Checking for False Positives (should NOT match) ---');
        // Check for '01-26' specifically
        const checkSql = `
            SELECT loan_code, borrower_name, month_reported,
                   (substring(month_reported, 4, 2) || '-' || substring(month_reported, 1, 2)) as converted_yymm
            FROM loans
            WHERE month_reported = '01-26'
        `;
        const checkRes = await db.query(checkSql);
        checkRes.rows.forEach(r => {
            const yymm = r.converted_yymm;
            const included = (yymm >= startTarget && yymm <= endTarget);
            console.log(`[CHECK] ${r.borrower_name} (${r.month_reported}) -> ${yymm}. Included? ${included}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

testFilter();
