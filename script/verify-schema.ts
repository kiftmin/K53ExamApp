/**
 * Compares server/db.ts against the live Postgres catalog.
 * drizzle-kit 0.27 has no `push --dry-run`, so this is the parity gate:
 * run before/after editing db.ts. Exits non-zero on any difference.
 */
import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../server/db.js';

const TYPE_MAP: Record<string, string> = {
  PgText: 'text',
  PgInteger: 'integer',
  PgSerial: 'integer',
  PgBoolean: 'boolean',
  PgJsonb: 'jsonb',
  PgTimestamp: 'timestamp without time zone',
  PgReal: 'real',
};

async function main() {
  const colsResult = await db.execute(sql`
    select table_name, column_name, data_type, is_nullable, column_default
    from information_schema.columns where table_schema = 'public'
  `);
  const liveCols = new Map<string, any>();
  for (const r of colsResult.rows) liveCols.set(`${r.table_name}.${r.column_name}`, r);

  const idxResult = await db.execute(sql`select indexname from pg_indexes where schemaname = 'public'`);
  const liveIndexes = new Set<string>(idxResult.rows.map((r) => r.indexname as string));

  const fkResult = await db.execute(sql`
    select tc.table_name, kcu.column_name, ccu.table_name as ref_table, ccu.column_name as ref_column, rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  `);
  const liveFks = new Set<string>(
    fkResult.rows.map((r) => `${r.table_name}.${r.column_name}->${r.ref_table}.${r.ref_column}:${String(r.delete_rule).toLowerCase()}`),
  );

  const problems: string[] = [];
  const modeled = new Set<string>();

  for (const table of Object.values(schema)) {
    if (typeof table !== 'object' || table === null) continue;
    let cfg;
    try {
      cfg = getTableConfig(table as any);
    } catch {
      continue;
    }
    modeled.add(cfg.name);

    for (const col of cfg.columns) {
      const key = `${cfg.name}.${col.name}`;
      const live = liveCols.get(key);
      if (!live) {
        problems.push(`missing live column ${key}`);
        continue;
      }
      liveCols.delete(key);

      const expectedType = TYPE_MAP[col.columnType];
      if (!expectedType) problems.push(`unmapped drizzle type ${col.columnType} (${key})`);
      else if (live.data_type !== expectedType) problems.push(`type ${key}: live=${live.data_type} model=${expectedType}`);

      if (!!col.notNull !== (live.is_nullable === 'NO')) {
        problems.push(`nullability ${key}: live=${live.is_nullable === 'NO'} model=${!!col.notNull}`);
      }

      const liveDefault = String(live.column_default ?? '');
      if (col.columnType === 'PgSerial') {
        if (!liveDefault.startsWith('nextval(')) problems.push(`serial ${key} has no sequence default`);
      } else if ((col.default !== undefined) !== (liveDefault !== '')) {
        problems.push(`default ${key}: live=${liveDefault || 'none'} model=${col.default !== undefined ? 'present' : 'none'}`);
      }
    }

    const uniqueNames = cfg.uniqueConstraints.map((c) => c.name).filter(Boolean) as string[];
    const indexNames = cfg.indexes.map((i) => i.config.name).filter(Boolean) as string[];
    for (const name of [...uniqueNames, ...indexNames]) {
      if (!liveIndexes.has(name)) problems.push(`missing live index/constraint ${name} on ${cfg.name}`);
    }

    for (const fk of cfg.foreignKeys) {
      const ref = fk.reference();
      const refTable = getTableConfig(ref.foreignTable).name;
      const key = `${cfg.name}.${ref.columns[0].name}->${refTable}.${ref.foreignColumns[0].name}:${fk.onDelete ?? 'no action'}`;
      if (!liveFks.has(key)) problems.push(`missing live foreign key ${key}`);
      else liveFks.delete(key);
    }
  }

  for (const key of liveCols.keys()) problems.push(`unmodeled live column ${key}`);
  for (const fk of liveFks) problems.push(`unmodeled live foreign key ${fk}`);

  console.log(`checked ${modeled.size} tables`);
  if (problems.length === 0) {
    console.log('PARITY OK: server/db.ts matches the live database');
    return;
  }
  console.log(`PROBLEMS (${problems.length}):`);
  for (const p of problems) console.log(' - ' + p);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error('FAILED', e?.message ?? e);
  process.exitCode = 2;
});
