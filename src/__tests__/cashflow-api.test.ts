import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
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
  (globalThis as any).__testSqlite = sqlite;
  return { db: drizzle(sqlite, { schema }) };
});

const getSqlite = (): DBType => (globalThis as any).__testSqlite;

const clearAll = () => {
  const sq = getSqlite();
  sq.exec('DELETE FROM cash_flow_entries;');
  sq.exec('DELETE FROM cash_flow_months;');
  sq.exec('DELETE FROM subscriptions;');
  sq.exec('DELETE FROM bills;');
  sq.exec('DELETE FROM transactions;');
  sq.exec('DELETE FROM accounts;');
};

const seedSub = (over: Record<string, unknown> = {}) => {
  const row = {
    id: 's1',
    name: 'Netflix',
    amount: 50,
    billing_day: 15,
    category: 'Streaming',
    source: 'manual',
    alert_days: 3,
    is_active: 1,
    created_at: 0,
    ...over,
  };
  getSqlite()
    .prepare(
      `INSERT INTO subscriptions (id,name,amount,billing_day,category,source,alert_days,is_active,created_at)
       VALUES (@id,@name,@amount,@billing_day,@category,@source,@alert_days,@is_active,@created_at)`,
    )
    .run(row);
  return row;
};

const seedBill = (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'b1',
    name: 'Aluguel',
    amount: 1500,
    due_day: 5,
    category: 'Casa',
    source: 'manual',
    is_paid: 0,
    paid_at: null,
    needs_review: 0,
    created_at: 0,
    ...over,
  };
  getSqlite()
    .prepare(
      `INSERT INTO bills (id,name,amount,due_day,category,source,is_paid,paid_at,needs_review,created_at)
       VALUES (@id,@name,@amount,@due_day,@category,@source,@is_paid,@paid_at,@needs_review,@created_at)`,
    )
    .run(row);
  return row;
};

const seedMonth = (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'm1',
    key: '2026-05',
    name: 'maio 2026',
    opening_balance: 0,
    inherit_opening: 0,
    created_at: 0,
    updated_at: 0,
    ...over,
  };
  getSqlite()
    .prepare(
      `INSERT INTO cash_flow_months (id,key,name,opening_balance,inherit_opening,created_at,updated_at)
       VALUES (@id,@key,@name,@opening_balance,@inherit_opening,@created_at,@updated_at)`,
    )
    .run(row);
  return row;
};

const seedEntry = (over: Record<string, unknown> = {}) => {
  const row = {
    id: 'e1',
    month_id: 'm1',
    day: 1,
    date: '2026-05-01',
    description: '',
    note: null,
    entrada: 0,
    saida: 0,
    source: 'manual',
    source_ref_id: null,
    created_at: 0,
    ...over,
  };
  getSqlite()
    .prepare(
      `INSERT INTO cash_flow_entries
       (id,month_id,day,date,description,note,entrada,saida,source,source_ref_id,created_at)
       VALUES
       (@id,@month_id,@day,@date,@description,@note,@entrada,@saida,@source,@source_ref_id,@created_at)`,
    )
    .run(row);
  return row;
};

const countEntries = (): number =>
  (getSqlite().prepare('SELECT COUNT(*) AS c FROM cash_flow_entries').get() as { c: number }).c;

beforeAll(async () => {
  // Eagerly trigger the @/db/client mock factory so __testSqlite is initialised
  // before any test runs (route handlers import it lazily).
  await import('@/db/client');
});

beforeEach(() => {
  clearAll();
});

const req = (body?: unknown): Request =>
  new Request('http://test', {
    method: 'POST',
    body: body == null ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('GET /api/cashflow/months', () => {
  it('returns all months ordered by key desc', async () => {
    seedMonth({ id: 'a', key: '2026-04' });
    seedMonth({ id: 'b', key: '2026-05' });
    const { GET } = await import('@/app/api/cashflow/months/route');
    const res = await GET(new Request('http://test'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.map((m: { key: string }) => m.key)).toEqual(['2026-05', '2026-04']);
  });

  it('returns empty array when no months', async () => {
    const { GET } = await import('@/app/api/cashflow/months/route');
    const json = await (await GET(new Request('http://test'))).json();
    expect(json).toEqual([]);
  });
});

describe('POST /api/cashflow/months', () => {
  it('creates a month with explicit openingBalance', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(req({ key: '2026-05', openingBalance: 1000, inheritOpening: 0 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ key: '2026-05', openingBalance: 1000 });
    expect(body.id).toBeTruthy();
  });

  it('rejects missing key with 400', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('rejects duplicate key with 409', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    await POST(req({ key: '2026-05' }));
    const dup = await POST(req({ key: '2026-05' }));
    expect(dup.status).toBe(409);
  });

  it('defaults openingBalance to 0 when inheritOpening=0 and no value given', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(req({ key: '2026-05', inheritOpening: 0 }));
    const body = await res.json();
    expect(body.openingBalance).toBe(0);
  });

  it('inherits openingBalance from previous month closing when inheritOpening=1', async () => {
    seedMonth({ id: 'prev', key: '2026-04', opening_balance: 100 });
    seedEntry({ id: 'pe1', month_id: 'prev', day: 10, date: '2026-04-10', entrada: 50 });
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(req({ key: '2026-05', inheritOpening: 1 }));
    const body = await res.json();
    expect(body.openingBalance).toBe(150);
  });

  it('falls back to 0 when inheritOpening=1 but no previous month exists', async () => {
    const { POST } = await import('@/app/api/cashflow/months/route');
    const res = await POST(req({ key: '2026-05', inheritOpening: 1 }));
    const body = await res.json();
    expect(body.openingBalance).toBe(0);
  });
});

describe('PATCH /api/cashflow/months/[id]', () => {
  it('updates name and openingBalance', async () => {
    seedMonth();
    const { PATCH } = await import('@/app/api/cashflow/months/[id]/route');
    const res = await PATCH(
      new Request('http://test', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'novo nome', openingBalance: 999 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'm1' } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ name: 'novo nome', openingBalance: 999 });
  });

  it('returns 404 when id unknown', async () => {
    const { PATCH } = await import('@/app/api/cashflow/months/[id]/route');
    const res = await PATCH(
      new Request('http://test', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'x' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'ghost' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cashflow/months/[id]', () => {
  it('removes month and cascades entries', async () => {
    seedMonth();
    seedEntry();
    const { DELETE } = await import('@/app/api/cashflow/months/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: { id: 'm1' },
    });
    expect(res.status).toBe(200);
    expect(countEntries()).toBe(0);
  });

  it('returns 404 when id unknown', async () => {
    const { DELETE } = await import('@/app/api/cashflow/months/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: { id: 'ghost' },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/cashflow/months/[id]/seed', () => {
  it('creates a saida entry per active subscription on billingDay', async () => {
    seedMonth();
    seedSub();
    const { POST } = await import('@/app/api/cashflow/months/[id]/seed/route');
    const res = await POST(req({}), { params: { id: 'm1' } });
    expect(res.status).toBe(200);
    expect(countEntries()).toBe(1);
    const row = getSqlite().prepare('SELECT * FROM cash_flow_entries').get() as Record<string, unknown>;
    expect(row).toMatchObject({
      day: 15,
      date: '2026-05-15',
      saida: 50,
      source: 'subscription',
      source_ref_id: 's1',
    });
  });

  it('creates a saida entry per unpaid bill on dueDay', async () => {
    seedMonth();
    seedBill();
    const { POST } = await import('@/app/api/cashflow/months/[id]/seed/route');
    await POST(req({}), { params: { id: 'm1' } });
    const row = getSqlite().prepare('SELECT * FROM cash_flow_entries').get() as Record<string, unknown>;
    expect(row).toMatchObject({ day: 5, saida: 1500, source: 'bill', source_ref_id: 'b1' });
  });

  it('skips inactive subscriptions and paid bills, keeps active ones', async () => {
    seedMonth();
    seedSub({ id: 'sActive', is_active: 1, billing_day: 10 });
    seedSub({ id: 'sInactive', is_active: 0, billing_day: 20 });
    seedBill({ id: 'bUnpaid', is_paid: 0, due_day: 5 });
    seedBill({ id: 'bPaid', is_paid: 1, due_day: 25 });
    const { POST } = await import('@/app/api/cashflow/months/[id]/seed/route');
    await POST(req({}), { params: { id: 'm1' } });
    expect(countEntries()).toBe(2);
    const refs = (getSqlite()
      .prepare('SELECT source_ref_id FROM cash_flow_entries ORDER BY source_ref_id')
      .all() as { source_ref_id: string }[]).map(r => r.source_ref_id);
    expect(refs).toEqual(['bUnpaid', 'sActive']);
  });

  it('is idempotent — second call does not duplicate rows', async () => {
    seedMonth();
    seedSub();
    seedBill();
    const { POST } = await import('@/app/api/cashflow/months/[id]/seed/route');
    await POST(req({}), { params: { id: 'm1' } });
    await POST(req({}), { params: { id: 'm1' } });
    expect(countEntries()).toBe(2);
  });

  it('returns 404 when month id unknown', async () => {
    const { POST } = await import('@/app/api/cashflow/months/[id]/seed/route');
    const res = await POST(req({}), { params: { id: 'ghost' } });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/cashflow/months/[id]/entries', () => {
  it('creates a manual entry and computes date from month key + day', async () => {
    seedMonth();
    const { POST } = await import('@/app/api/cashflow/months/[id]/entries/route');
    const res = await POST(req({ day: 7, entrada: 200, description: 'Salario' }), {
      params: { id: 'm1' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      day: 7,
      date: '2026-05-07',
      entrada: 200,
      description: 'Salario',
      source: 'manual',
    });
  });

  it('defaults entrada and saida to 0', async () => {
    seedMonth();
    const { POST } = await import('@/app/api/cashflow/months/[id]/entries/route');
    const res = await POST(req({ day: 1 }), { params: { id: 'm1' } });
    const body = await res.json();
    expect(body.entrada).toBe(0);
    expect(body.saida).toBe(0);
  });

  it('returns 404 when month id unknown', async () => {
    const { POST } = await import('@/app/api/cashflow/months/[id]/entries/route');
    const res = await POST(req({ day: 1 }), { params: { id: 'ghost' } });
    expect(res.status).toBe(404);
  });

  it('rejects missing day with 400', async () => {
    seedMonth();
    const { POST } = await import('@/app/api/cashflow/months/[id]/entries/route');
    const res = await POST(req({}), { params: { id: 'm1' } });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/cashflow/entries/[id]', () => {
  it('updates entrada partially', async () => {
    seedMonth();
    seedEntry({ id: 'e1', entrada: 0, saida: 0 });
    const { PATCH } = await import('@/app/api/cashflow/entries/[id]/route');
    const res = await PATCH(
      new Request('http://test', {
        method: 'PATCH',
        body: JSON.stringify({ entrada: 123 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'e1' } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entrada).toBe(123);
    expect(body.saida).toBe(0);
  });

  it('updates day and recomputes date', async () => {
    seedMonth();
    seedEntry({ id: 'e1', day: 1, date: '2026-05-01' });
    const { PATCH } = await import('@/app/api/cashflow/entries/[id]/route');
    const res = await PATCH(
      new Request('http://test', {
        method: 'PATCH',
        body: JSON.stringify({ day: 20 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'e1' } },
    );
    const body = await res.json();
    expect(body.day).toBe(20);
    expect(body.date).toBe('2026-05-20');
  });

  it('returns 404 when entry id unknown', async () => {
    const { PATCH } = await import('@/app/api/cashflow/entries/[id]/route');
    const res = await PATCH(
      new Request('http://test', {
        method: 'PATCH',
        body: JSON.stringify({ entrada: 1 }),
        headers: { 'Content-Type': 'application/json' },
      }),
      { params: { id: 'ghost' } },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cashflow/entries/[id]', () => {
  it('removes an entry', async () => {
    seedMonth();
    seedEntry();
    const { DELETE } = await import('@/app/api/cashflow/entries/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: { id: 'e1' },
    });
    expect(res.status).toBe(200);
    expect(countEntries()).toBe(0);
  });

  it('returns 404 when entry id unknown', async () => {
    const { DELETE } = await import('@/app/api/cashflow/entries/[id]/route');
    const res = await DELETE(new Request('http://test', { method: 'DELETE' }), {
      params: { id: 'ghost' },
    });
    expect(res.status).toBe(404);
  });
});
