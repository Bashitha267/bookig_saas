require("dotenv").config(); const db = require("./lib/db"); async function run() { const result = await db.query("DESCRIBE property"); console.log(JSON.stringify(result)); process.exit(0); } run();
