// Compares two projects' table definitions (PostgREST OpenAPI descriptions:
// metadata only, no rows) and lists every difference in tables, columns,
// types, defaults, NOT NULL, primary and foreign keys.
//
//   node supabase/tools/compare-schema.mjs <production.json> <development.json>
//
// Get a description with: GET <SUPABASE_URL>/rest/v1/ and the project's
// service-role key as apikey and Bearer token.
import fs from 'node:fs';

const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')).definitions);
// Newer PostgREST versions label some PostgreSQL types differently (14.18
// reports integer columns as int32, 14.5 as integer); same column type.
const SAME_TYPE = { int32: 'integer', int64: 'bigint' };
const describe = (p) => [
  SAME_TYPE[p.format] || p.format || 'jsonb',
  p.default !== undefined ? `default ${p.default}` : '',
  (p.description || '').match(/<pk\/>/) ? 'pk' : '',
  ((p.description || '').match(/<fk table='([^']+)' column='([^']+)'/) || []).slice(1).join('.'),
  p.enum ? `enum(${p.enum.join(',')})` : '',
].filter(Boolean).join(' ');

const diffs = [];
for (const table of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (!a[table]) { diffs.push(`+ table ${table} only in development`); continue; }
  if (!b[table]) { diffs.push(`- table ${table} missing in development`); continue; }
  const ra = new Set(a[table].required || []), rb = new Set(b[table].required || []);
  for (const col of new Set([...Object.keys(a[table].properties), ...Object.keys(b[table].properties)])) {
    const pa = a[table].properties[col], pb = b[table].properties[col];
    if (!pb) { diffs.push(`- ${table}.${col} missing in development`); continue; }
    if (!pa) { diffs.push(`+ ${table}.${col} only in development`); continue; }
    const da = describe(pa) + (ra.has(col) ? ' not null' : ''), db = describe(pb) + (rb.has(col) ? ' not null' : '');
    if (da !== db) diffs.push(`~ ${table}.${col}: production "${da}" / development "${db}"`);
  }
}
console.log(diffs.length ? diffs.join('\n') : `Identical: ${Object.keys(a).length} tables, same columns, types, defaults, NOT NULL, keys.`);
process.exit(diffs.length ? 1 : 0);
