import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 10000,      // drop idle connections after 10s (before server cuts them)
  connectionTimeoutMillis: 5000,
  keepAlive: true,               // send TCP keepalives so the OS detects dead connections
  keepAliveInitialDelayMillis: 5000,
});

// Swallow connection-level errors so a stale socket never crashes the process
pool.on('error', (err) => {
  console.error('pg pool error (stale connection):', err.message);
});

export default pool;
