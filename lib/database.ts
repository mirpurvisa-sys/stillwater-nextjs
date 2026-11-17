import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { postgresSQL } from './sql';
let pool: Pool | undefined;
function connection() {
  if (!process.env.DATABASE_URL) throw new Error('Database setup required. Add DATABASE_URL and run supabase/setup.sql.');
  if (!pool) pool = new Pool({connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 20000, connectionTimeoutMillis: 10000});
  return pool;
}
class Statement {
  constructor(readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.sql, values); }
  async execute(client?: PoolClient) { return (client || connection()).query(postgresSQL(this.sql), this.values); }
  async first<T = QueryResultRow>(): Promise<T | null> { const r = await this.execute(); return (r.rows[0] as T) ?? null; }
  async all<T = QueryResultRow>(): Promise<{results: T[]}> { const r = await this.execute(); return {results: r.rows as T[]}; }
  async run() { const r = await this.execute(); return {success: true, changes: r.rowCount ?? 0}; }
}
export const database = {
  prepare(sql: string) { return new Statement(sql); },
  async batch(statements: Statement[]) {
    const client = await connection().connect();
    try { await client.query('BEGIN'); const results = []; for (const s of statements) results.push(await s.execute(client)); await client.query('COMMIT'); return results; }
    catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
};
