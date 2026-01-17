const db = require('./src/db');
async function run() {
    try {
        const res = await db.query("SELECT username FROM users LIMIT 1");
        console.log(JSON.stringify(res.rows));
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
}
run();
