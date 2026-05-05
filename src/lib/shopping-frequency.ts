export interface FrequencyEntry {
  name: string;
  category: string;
  count: number;
  lastBoughtAt: number;
}

export function buildFrequencyRanking(
  rows: Array<{ name: string; category: string; completedAt: number }>
): FrequencyEntry[] {
  const map = new Map<string, FrequencyEntry>();
  for (const row of rows) {
    const key = row.name.toLowerCase();
    const entry = map.get(key);
    if (entry) {
      entry.count++;
      if (row.completedAt > entry.lastBoughtAt) entry.lastBoughtAt = row.completedAt;
    } else {
      map.set(key, {
        name: row.name,
        category: row.category,
        count: 1,
        lastBoughtAt: row.completedAt,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.count - a.count || b.lastBoughtAt - a.lastBoughtAt
  );
}
