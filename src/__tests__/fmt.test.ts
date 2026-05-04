import { describe, it, expect } from 'vitest';
import { fmt } from '@/lib/fmt';

describe('fmt', () => {
  it('formats positive BRL amount', () => {
    expect(fmt(1234.56)).toBe('R$ 1.234,56');
  });

  it('formats negative amount with minus sign', () => {
    expect(fmt(-45.9)).toBe('-R$ 45,90');
  });

  it('formats zero', () => {
    expect(fmt(0)).toBe('R$ 0,00');
  });

  it('adds + sign when signed=true and value positive', () => {
    expect(fmt(5000, { signed: true })).toBe('+R$ 5.000,00');
  });

  it('keeps minus when signed=true and value negative', () => {
    expect(fmt(-210.34, { signed: true })).toBe('-R$ 210,34');
  });

  it('returns em dash for NaN', () => {
    expect(fmt(NaN)).toBe('—');
  });
});
