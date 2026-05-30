require("dotenv").config();
const db = require("./lib/db");
async function run() {
  const users = await db.query("SELECT id, firstName, lastName, username FROM `user` WHERE role = 'owner'");
  console.log("USERS:", users);
  const billing = await db.query("SELECT * FROM owner_billing ORDER BY id DESC LIMIT 20");
  console.log("BILLING:", billing);
  process.exit(0);
}
run();
