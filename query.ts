import { Pool } from 'pg';
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_zhNWE0TMpYR9@ep-super-forest-am0q8xx6.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`);
  console.log(res.rows.map(r => r.column_name));
  pool.end();
}
main();
