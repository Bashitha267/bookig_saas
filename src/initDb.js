import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'postgres', // Connect to default db first to check/create the target db
  password: process.env.DB_PASSWORD || 'admin_password',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function init() {
  let client;
  try {
    client = await pool.connect();
    
    // Check if target database exists
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [process.env.DB_NAME || 'booking_db']);
    if (dbCheck.rowCount === 0) {
      console.log(`Database '${process.env.DB_NAME || 'booking_db'}' does not exist. Creating...`);
      // CREATE DATABASE cannot run inside a transaction block, so we do it directly
      await client.query(`CREATE DATABASE "${process.env.DB_NAME || 'booking_db'}"`);
      console.log("Database created successfully.");
    } else {
      console.log(`Database '${process.env.DB_NAME || 'booking_db'}' already exists.`);
    }
    client.release();
    await pool.end();

    // Now connect to the actual target database
    const targetPool = new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'booking_db',
      password: process.env.DB_PASSWORD || 'admin_password',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });

    const targetClient = await targetPool.connect();

    console.log("Applying schema.sql...");
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await targetClient.query(schemaSql);
    console.log("Schema applied successfully.");

    console.log("Applying seed.sql...");
    const seedPath = path.join(__dirname, '../db/seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await targetClient.query(seedSql);
    console.log("Seed data applied successfully.");

    targetClient.release();
    await targetPool.end();
    console.log("Database initialization completed successfully!");
  } catch (error) {
    console.error("Error during database initialization:", error);
    if (client) client.release();
    process.exit(1);
  }
}

init();
