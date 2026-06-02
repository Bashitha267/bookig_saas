require("dotenv").config({ path: require('path').resolve(__dirname, '.env') });
const db = require("./lib/db");

async function run() {
  try {
    const columns = await db.query("DESCRIBE `room`");
    console.log("Room Table Columns:", columns);
    
    // Simulate updating room ID 4 (or any room ID)
    const testPayload = {
      roomType: 'Deluxe',
      capacityAdults: 2,
      capacityChildren: 0,
      price: 1500,
      hasAc: 1
    };
    
    const updates = [];
    const params = [];
    Object.keys(testPayload).forEach(field => {
      updates.push(`\`${field}\` = ?`);
      params.push(testPayload[field]);
    });
    
    const sql = `UPDATE room SET ${updates.join(', ')}, updatedAt = NOW() WHERE id = ?`;
    params.push(4); // Test with ID 4
    
    console.log("Executing SQL:", sql, "with params:", params);
    const result = await db.execute(sql, params);
    console.log("SQL execution result:", result);
  } catch (error) {
    console.error("Diagnostic error:", error);
  } finally {
    process.exit(0);
  }
}

run();
