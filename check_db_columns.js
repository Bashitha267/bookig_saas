require('dotenv').config();
const db = require('./lib/db');
async function run() {
  try {
    const columns = await db.query("DESCRIBE `booking`");
    console.log("COLUMNS:", columns.map(c => c.Field));
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit(0);
}
run();
