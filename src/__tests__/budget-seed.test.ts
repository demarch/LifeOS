import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Database as DBType } from 'better-sqlite3';

vi.mock('@/db/client', async () => {
  const Database = (await import('better-sqlite3')).default;
  const fs       = await import('fs');
  const path     = await import('path');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const schema   = await import('@/db/schema');

  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'src/__tests__/fixtures/schema.sql'),
    'utf8',
  );
  sqlite.exec(sql);
  (globalThis as unknown as { __testSqlite: DBType }).__testSqlite = sqlite;
  return { sqlite, db: drizzle(sqlite, { schema }) };
});

const getSqlite = (): DBType => (globalThis as unknown as { __testSqlite: DBType }).__testSqlite;

const clearAll = () => {
  const sq = getSqlite();
  sq.exec('DELETE FROM cash_flow_entries;');
  sq.exec('DELETE FROM cash_flow_months;');
  sq.exec('DELETE FROM budget_limits;');
  sq.exec('DELETE FROM budget_categories;');
  sq.exec('DELETE FROM subscriptions;');
  sq.exec('DELETE FROM bills;');
  sq.exec('DELETE FROM transactions;');
  sq.exec('DELETE FROM accounts;');
};

beforeAll(async () => { await import('@/db/client'); });
beforeEach(() => { clearAll(); });

describe('resolveCategoryId', () => {
  it('Pass 1 — direct curated name hits', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('Assinaturas', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('MORADIA', cats)).toBe('cat_moradia');
    expect(resolveCategoryId('saude', cats)).toBe('cat_saude');
  });

  it('Pass 2 — KEYWORD bridge: Streaming → Assinaturas', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('Streaming', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('IA', cats)).toBe('cat_assinaturas');
  });

  it('Pass 2 — KEYWORDS substring match on description-like input', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('NETFLIX.COM 12/12', cats)).toBe('cat_assinaturas');
    expect(resolveCategoryId('SPOTIFY BRASIL', cats)).toBe('cat_assinaturas');
  });

  it('falls back to Outros on unknown input', async () => {
    const { seedCuratedCategories, resolveCategoryId } = await import('@/lib/budget-seed');
    const { db } = await import('@/db/client');
    const { budgetCategories } = await import('@/db/schema');
    seedCuratedCategories();
    const cats = await db.select().from(budgetCategories);
    expect(resolveCategoryId('PADARIA PAO QUENTE', cats)).toBe('cat_outros');
    expect(resolveCategoryId('', cats)).toBe('cat_outros');
  });
});

describe('bindLegacyCategories', () => {
  const insertMonth = () => getSqlite()
    .prepare(`INSERT INTO cash_flow_months (id,key,name,opening_balance,inherit_opening,created_at,updated_at)
              VALUES ('m1','2026-05','maio',0,0,0,0)`)
    .run();

  const insertSub = (id: string, name: string, category: string) => getSqlite()
    .prepare(`INSERT INTO subscriptions (id,name,amount,billing_day,category,source,alert_days,is_active,created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, name, 50, 15, category, 'manual', 3, 1, 0);

  const insertBill = (id: string, name: string, category: string) => getSqlite()
    .prepare(`INSERT INTO bills (id,name,amount,due_day,category,source,is_paid,paid_at,needs_review,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, name, 1500, 5, category, 'manual', 0, null, 0, 0);

  const insertEntry = (id: string, source: string, sourceRefId: string | null) => getSqlite()
    .prepare(`INSERT INTO cash_flow_entries
              (id,month_id,day,date,description,note,entrada,saida,source,source_ref_id,category_id,created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, 'm1', 1, '2026-05-01', '', null, 0, 50, source, sourceRefId, null, 0);

  const getEntryCat = (id: string) =>
    (getSqlite().prepare('SELECT category_id FROM cash_flow_entries WHERE id = ?').get(id) as { category_id: string | null }).category_id;

  it('binds subscription-linked entries via sourceRefId → sub.name → resolver', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertSub('s_netflix', 'Netflix', 'Streaming');
    insertEntry('e1', 'subscription', 's_netflix');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e1')).toBe('cat_assinaturas');
  });

  it('falls back to bill.category when name does not resolve', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertBill('b_alug', 'Aluguel apartamento', 'Moradia');
    insertEntry('e2', 'bill', 'b_alug');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e2')).toBe('cat_moradia');
  });

  it('lands unmatched in Outros and logs them', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertBill('b_x', 'Coisa Qualquer Z', 'Outros');
    insertEntry('e3', 'bill', 'b_x');

    const res = bindLegacyCategories();
    expect(res.bound).toBe(1);
    expect(getEntryCat('e3')).toBe('cat_outros');
    expect(res.unmatched).toContain('bill:b_x');
  });

  it('leaves manual entries (no sourceRefId) untouched', async () => {
    const { seedCuratedCategories, bindLegacyCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    insertMonth();
    insertEntry('e4', 'manual', null);

    const res = bindLegacyCategories();
    expect(res.bound).toBe(0);
    expect(getEntryCat('e4')).toBeNull();
  });
});

describe('seedCuratedCategories', () => {
  it('inserts the full curated taxonomy on an empty DB', async () => {
    const { seedCuratedCategories, CURATED_SEED } = await import('@/lib/budget-seed');
    const res = seedCuratedCategories({ now: () => 1234 });
    expect(res.inserted).toBe(CURATED_SEED.length);
    expect(res.skipped).toBe(0);
    const row = getSqlite()
      .prepare(`SELECT id, name, kind, color, icon, carryover, sort_order, is_archived, created_at
                FROM budget_categories WHERE id = 'cat_moradia'`)
      .get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 'cat_moradia',
      name: 'Moradia',
      kind: 'expense',
      icon: '🏠',
      carryover: 0,
      is_archived: 0,
      created_at: 1234,
    });
  });

  it('is idempotent — second call inserts nothing', async () => {
    const { seedCuratedCategories } = await import('@/lib/budget-seed');
    const first = seedCuratedCategories();
    const second = seedCuratedCategories();
    expect(second.inserted).toBe(0);
    expect(second.skipped).toBe(first.inserted);
    const count = (getSqlite()
      .prepare('SELECT COUNT(*) AS c FROM budget_categories')
      .get() as { c: number }).c;
    expect(count).toBe(first.inserted);
  });

  it('rejects case-variant duplicates via COLLATE NOCASE unique index', async () => {
    const { seedCuratedCategories } = await import('@/lib/budget-seed');
    seedCuratedCategories();
    expect(() =>
      getSqlite()
        .prepare(
          `INSERT INTO budget_categories (id,name,kind,color,icon,carryover,sort_order,is_archived,created_at)
           VALUES ('x','MORADIA','expense','#000','x',0,0,0,0)`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });
});
