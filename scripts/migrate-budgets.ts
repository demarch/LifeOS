/* eslint-disable no-console */
import { sqlite } from '@/db/client';
import { seedCuratedCategories, bindLegacyCategories } from '@/lib/budget-seed';

function main(): void {
  const ts = Date.now();
  const backupTable = `cash_flow_entries_backup_${ts}`;

  console.log(`[migrate-budgets] backing up cash_flow_entries → ${backupTable}`);
  sqlite.exec(
    `CREATE TABLE ${backupTable} AS SELECT * FROM cash_flow_entries;`,
  );

  console.log('[migrate-budgets] seeding curated categories');
  const seedRes = seedCuratedCategories();
  console.log(`  inserted=${seedRes.inserted} skipped=${seedRes.skipped}`);

  console.log('[migrate-budgets] binding legacy bill/sub categories');
  const bindRes = bindLegacyCategories();
  console.log(`  bound=${bindRes.bound} unmatched=${bindRes.unmatched.length}`);

  if (bindRes.unmatched.length > 0) {
    console.log('[migrate-budgets] unmatched legacy refs (landed in Outros):');
    for (const ref of bindRes.unmatched) console.log(`  - ${ref}`);
  }

  console.log('[migrate-budgets] done.');
}

main();
