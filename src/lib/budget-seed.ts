import { sqlite } from '@/db/client';
import type { BudgetCategory } from '@/db/schema';

/**
 * Curated taxonomy. IDs are stable, human-readable slugs so seed is idempotent
 * by primary key and not just by name.
 */
export interface CuratedCategory {
  id:        string;
  name:      string;
  kind:      'expense' | 'income';
  color:     string;
  icon:      string;
  carryover: 0 | 1;
  sortOrder: number;
}

export const CURATED_SEED: CuratedCategory[] = [
  { id: 'cat_moradia',       name: 'Moradia',       kind: 'expense', color: '#a78bfa', icon: '🏠', carryover: 0, sortOrder: 10 },
  { id: 'cat_mercado',       name: 'Mercado',       kind: 'expense', color: '#34d399', icon: '🛒', carryover: 0, sortOrder: 20 },
  { id: 'cat_transporte',    name: 'Transporte',    kind: 'expense', color: '#fbbf24', icon: '🚗', carryover: 0, sortOrder: 30 },
  { id: 'cat_lazer',         name: 'Lazer',         kind: 'expense', color: '#f87171', icon: '🎬', carryover: 0, sortOrder: 40 },
  { id: 'cat_saude',         name: 'Saúde',         kind: 'expense', color: '#60a5fa', icon: '⚕️', carryover: 0, sortOrder: 50 },
  { id: 'cat_educacao',      name: 'Educação',      kind: 'expense', color: '#f472b6', icon: '📚', carryover: 0, sortOrder: 60 },
  { id: 'cat_assinaturas',   name: 'Assinaturas',   kind: 'expense', color: '#818cf8', icon: '📺', carryover: 0, sortOrder: 70 },
  { id: 'cat_trabalho',      name: 'Trabalho',      kind: 'expense', color: '#14b8a6', icon: '💼', carryover: 0, sortOrder: 80 },
  { id: 'cat_investimentos', name: 'Investimentos', kind: 'expense', color: '#22d3ee', icon: '📈', carryover: 0, sortOrder: 90 },
  { id: 'cat_outros',        name: 'Outros',        kind: 'expense', color: '#9ca3af', icon: '⚪', carryover: 0, sortOrder: 100 },
  { id: 'cat_salario',       name: 'Salário',       kind: 'income',  color: '#34d399', icon: '💰', carryover: 0, sortOrder: 10 },
  { id: 'cat_outros_rec',    name: 'Outros (rec.)', kind: 'income',  color: '#9ca3af', icon: '⚪', carryover: 0, sortOrder: 100 },
];

/**
 * Bridges `auto-detect.ts` KEYWORDS output (category field) to the curated taxonomy.
 * Without this, Netflix → Streaming → Outros (wrong). With it, Netflix → Streaming → Assinaturas.
 */
export const KEYWORD_CATEGORY_MAP: Record<string, string> = {
  Streaming: 'Assinaturas',
  IA:        'Assinaturas',
  Outros:    'Outros',
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export type BindResult = { bound: number; unmatched: string[] };
export type SeedDeps = { now?: () => number };

export function seedCuratedCategories(deps?: SeedDeps): { inserted: number; skipped: number } {
  const now = deps?.now?.() ?? Date.now();
  let inserted = 0;
  let skipped  = 0;
  const stmt = sqlite.prepare(
    `INSERT INTO budget_categories
       (id, name, kind, color, icon, carryover, sort_order, is_archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO NOTHING`,
  );
  for (const c of CURATED_SEED) {
    const r = stmt.run(c.id, c.name, c.kind, c.color, c.icon, c.carryover, c.sortOrder, now);
    if (r.changes === 1) inserted++;
    else                 skipped++;
  }
  return { inserted, skipped };
}

export function resolveCategoryId(_raw: string, _categories: BudgetCategory[]): string | null {
  throw new Error('not implemented yet — Task 5');
}

export function bindLegacyCategories(): BindResult {
  throw new Error('not implemented yet — Task 6');
}
