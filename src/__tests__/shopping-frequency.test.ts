import { describe, it, expect } from 'vitest';
import { buildFrequencyRanking } from '@/lib/shopping-frequency';

describe('buildFrequencyRanking', () => {
  it('returns empty array for no input', () => {
    expect(buildFrequencyRanking([])).toEqual([]);
  });

  it('counts single item once', () => {
    const rows = [{ name: 'Leite', category: 'Mercado', completedAt: 1000 }];
    const result = buildFrequencyRanking(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Leite', category: 'Mercado', count: 1, lastBoughtAt: 1000 });
  });

  it('merges same item case-insensitively', () => {
    const rows = [
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'leite', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].lastBoughtAt).toBe(2000);
  });

  it('sorts by count descending', () => {
    const rows = [
      { name: 'Pão', category: 'Mercado', completedAt: 1000 },
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'Leite', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
    expect(result[0].count).toBe(2);
    expect(result[1].name).toBe('Pão');
    expect(result[1].count).toBe(1);
  });

  it('breaks ties by lastBoughtAt descending', () => {
    const rows = [
      { name: 'Pão', category: 'Mercado', completedAt: 500 },
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
  });

  it('preserves first-seen name casing', () => {
    const rows = [
      { name: 'Leite', category: 'Mercado', completedAt: 1000 },
      { name: 'LEITE', category: 'Mercado', completedAt: 2000 },
    ];
    const result = buildFrequencyRanking(rows);
    expect(result[0].name).toBe('Leite');
  });
});
