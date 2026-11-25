import { Pool } from 'pg';

const globalForPg = globalThis;

const hasUrl = Boolean(process.env.DATABASE_URL);
const hasParts = Boolean(process.env.DB_PASSWORD && process.env.DB_NAME);

console.log('[db] env terbaca -> DB_* lengkap:', hasParts, '| DATABASE_URL:', hasUrl);

const pool =
  globalForPg.pgPoolV3 ||
  new Pool(
    hasUrl
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 5432),
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pgPoolV3 = pool;
}

export default pool;