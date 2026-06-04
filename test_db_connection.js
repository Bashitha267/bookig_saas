require('dotenv').config();
const mysql = require('mysql2/promise');
const { pool } = require('./lib/db');

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);

async function run() {
  try {
    console.log("Testing connection pool...");
    const connection = await pool.getConnection();
    console.log("Connection successful!");
    const [rows] = await connection.execute("SELECT 1");
    console.log("Query test successful:", rows);
    connection.release();
  } catch (err) {
    console.error("Connection failed with error stack:");
    console.error(err);
  }
  process.exit(0);
}
run();
