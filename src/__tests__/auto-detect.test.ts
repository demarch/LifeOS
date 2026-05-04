import { describe, it, expect } from 'vitest';
import { findSubscriptionCandidates, findBillCandidates } from '@/lib/auto-detect';
import type { Transaction } from '@/db/schema';

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'id',
  pluggyId: 'pid',
  accountId: 'acct',
  description: 'Test',
  amount: -50,
  type: 'debit',
  category: '',
  date: '2026-01-15',
  createdAt: 0,
  ...overrides,
});

describe('findSubscriptionCandidates', () => {
  it('detects Netflix by keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Netflix Monthly', amount: -55.9, date: '2026-04-12' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Netflix');
    expect(results[0].category).toBe('Streaming');
    expect(results[0].billingDay).toBe(12);
    expect(results[0].amount).toBeCloseTo(55.9);
  });

  it('detects ChatGPT via openai keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'OPENAI *CHATGPT PLUS', amount: -107.4, date: '2026-04-18' }),
    ]);
    expect(results[0].name).toBe('ChatGPT Plus');
    expect(results[0].category).toBe('IA');
    expect(results[0].billingDay).toBe(18);
  });

  it('ignores credit transactions', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Netflix refund', amount: +55.9 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('returns empty when no keywords match', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Padaria do Zé', amount: -18 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('does not create duplicate candidates for same keyword', () => {
    const results = findSubscriptionCandidates([
      tx({ description: 'Spotify Familia', amount: -21.9, date: '2026-03-25' }),
      tx({ description: 'Spotify Familia', amount: -21.9, date: '2026-04-25' }),
    ]);
    expect(results).toHaveLength(1);
  });
});

describe('findBillCandidates', () => {
  it('detects recurring debit across 2+ months as bill candidate', () => {
    const results = findBillCandidates([
      tx({ description: 'Conta Luz CEMIG', amount: -120, date: '2026-03-05' }),
      tx({ description: 'Conta Luz CEMIG', amount: -115, date: '2026-04-06' }),
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Conta Luz CEMIG');
    expect(results[0].dueDay).toBe(5);
    expect(results[0].needsReview).toBe(1);
  });

  it('ignores transactions in same month only', () => {
    const results = findBillCandidates([
      tx({ description: 'Loja ABC', amount: -50, date: '2026-04-01' }),
      tx({ description: 'Loja ABC', amount: -50, date: '2026-04-15' }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('ignores single occurrences', () => {
    const results = findBillCandidates([
      tx({ description: 'Compra única', amount: -200 }),
    ]);
    expect(results).toHaveLength(0);
  });

  it('averages amount across occurrences', () => {
    const results = findBillCandidates([
      tx({ description: 'Água SABESP', amount: -65, date: '2026-02-10' }),
      tx({ description: 'Água SABESP', amount: -70, date: '2026-03-10' }),
      tx({ description: 'Água SABESP', amount: -68, date: '2026-04-11' }),
    ]);
    expect(results[0].amount).toBeCloseTo(67.67, 1);
  });
});
