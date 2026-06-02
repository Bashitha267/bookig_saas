require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });
const db = require("./lib/db");

async function run() {
  try {
    // 1. Check if column already exists
    const columns = await db.query("DESCRIBE `room`");
    const hasAcExists = columns.some(col => col.Field === 'hasAc');
    
    if (hasAcExists) {
      console.log("Column 'hasAc' already exists in 'room' table.");
    } else {
      console.log("Adding 'hasAc' column to 'room' table...");
      await db.execute("ALTER TABLE `room` ADD COLUMN `hasAc` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`");
      console.log("Column 'hasAc' successfully added to 'room' table!");
    }
  } catch (error) {
    console.error("Database alteration failed:", error);
  } finally {
    process.exit(0);
  }
}

run();
