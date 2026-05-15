import type { Transaction } from '@/db/schema';

export interface SubscriptionCandidate {
  name: string;
  category: string;
  amount: number;
  billingDay: number;
}

export interface BillCandidate {
  name: string;
  amount: number;
  dueDay: number;
  needsReview: 1;
}

export const KEYWORDS: Record<string, { name: string; category: string }> = {
  netflix:           { name: 'Netflix',          category: 'Streaming' },
  spotify:           { name: 'Spotify',          category: 'Streaming' },
  'disney+':         { name: 'Disney+',          category: 'Streaming' },
  'disney plus':     { name: 'Disney+',          category: 'Streaming' },
  chatgpt:           { name: 'ChatGPT Plus',     category: 'IA' },
  openai:            { name: 'ChatGPT Plus',     category: 'IA' },
  cursor:            { name: 'Cursor Pro',       category: 'IA' },
  anthropic:         { name: 'Claude',           category: 'IA' },
  'claude.ai':       { name: 'Claude',           category: 'IA' },
  'claude subscr':   { name: 'Claude',           category: 'IA' },
  icloud:            { name: 'iCloud',           category: 'Outros' },
  'apple storage':   { name: 'iCloud',           category: 'Outros' },
  'apple.com/bill':  { name: 'iCloud',           category: 'Outros' },
  notion:            { name: 'Notion',           category: 'Outros' },
  github:            { name: 'GitHub',           category: 'Outros' },
  'amazon prime':    { name: 'Amazon Prime',     category: 'Streaming' },
  'youtube premium': { name: 'YouTube Premium',  category: 'Streaming' },
  'microsoft 365':   { name: 'Microsoft 365',    category: 'Outros' },
  'microsoft office':{ name: 'Microsoft 365',    category: 'Outros' },
  linkedin:          { name: 'LinkedIn Premium', category: 'Outros' },
};

export function findSubscriptionCandidates(txs: Transaction[]): SubscriptionCandidate[] {
  const debits = txs.filter(t => t.amount < 0);
  const seen = new Set<string>();
  const candidates: SubscriptionCandidate[] = [];

  for (const tx of debits) {
    const lower = tx.description.toLowerCase();
    for (const [keyword, meta] of Object.entries(KEYWORDS)) {
      if (lower.includes(keyword) && !seen.has(meta.name)) {
        seen.add(meta.name);
        candidates.push({
          name: meta.name,
          category: meta.category,
          amount: Math.abs(tx.amount),
          billingDay: new Date(tx.date + 'T12:00:00').getDate(),
        });
        break;
      }
    }
  }

  return candidates;
}

const KEYWORD_SET = Object.keys(KEYWORDS);

function matchesSubscriptionKeyword(description: string): boolean {
  const lower = description.toLowerCase();
  return KEYWORD_SET.some(k => lower.includes(k));
}

export function findBillCandidates(txs: Transaction[]): BillCandidate[] {
  // Skip subscription-keyword descriptions — handled by findSubscriptionCandidates
  const debits = txs.filter(t => t.amount < 0 && !matchesSubscriptionKeyword(t.description));
  const groups = new Map<string, Transaction[]>();

  for (const tx of debits) {
    const key = tx.description.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const candidates: BillCandidate[] = [];

  for (const [, group] of Array.from(groups)) {
    if (group.length < 2) continue;

    const months = new Set(group.map((t: Transaction) => t.date.slice(0, 7)));
    if (months.size < 2) continue;

    const days = group.map((t: Transaction) => new Date(t.date + 'T12:00:00').getDate());
    const freq = new Map<number, number>();
    for (const d of days) freq.set(d, (freq.get(d) ?? 0) + 1);
    const dueDay = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];

    const avgAmount =
      Math.round((group.reduce((s: number, t: Transaction) => s + Math.abs(t.amount), 0) / group.length) * 100) / 100;

    candidates.push({
      name: group[0].description,
      amount: avgAmount,
      dueDay,
      needsReview: 1,
    });
  }

  return candidates;
}
