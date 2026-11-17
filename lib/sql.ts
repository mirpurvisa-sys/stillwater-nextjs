/** Translate the original parameterised SQLite queries to PostgreSQL syntax. */
export function postgresSQL(sql: string): string {
  let index = 0;
  return sql
    .replace(/json_extract\(\s*([a-zA-Z_][\w.]*)\s*,\s*'\$\.([a-zA-Z_]\w*)'\s*\)/g,
      (_, column: string, field: string) => `(${column}::jsonb ->> '${field}')`)
    .replace(/\b(FROM|JOIN|INTO|UPDATE)\s+(records|members|grants|audit|files)\b/gi,
      '$1 stillwater.$2')
    .replace(/\?/g, () => `$${++index}`);
}
