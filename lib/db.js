const mysql = require('mysql2/promise');

function parseDatabaseUrl(databaseUrl) {
  try {
    const u = new URL(databaseUrl);
    return {
      host: u.hostname,
      port: u.port || 3306,
      user: u.username,
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch (err) {
    return null;
  }
}

const databaseUrl = process.env.DATABASE_URL;
let poolConfig = {};
if (databaseUrl) {
  const cfg = parseDatabaseUrl(databaseUrl);
  if (cfg) poolConfig = { ...cfg };
}

// Fallback to individual env vars
poolConfig.host = poolConfig.host || process.env.DB_HOST || '127.0.0.1';
poolConfig.user = poolConfig.user || process.env.DB_USER || 'root';
poolConfig.password = poolConfig.password || process.env.DB_PASSWORD || '';
poolConfig.database = poolConfig.database || process.env.DB_NAME || '';
poolConfig.port = poolConfig.port || process.env.DB_PORT || 3306;

const pool = mysql.createPool({
  host: poolConfig.host,
  user: poolConfig.user,
  password: poolConfig.password,
  database: poolConfig.database,
  port: poolConfig.port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function execute(sql, params) {
  const [result] = await pool.execute(sql, params);
  return result;
}

module.exports = { pool, query, execute };
