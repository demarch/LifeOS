import { describe, it, expect } from 'vitest';
import { classifyAsset } from '@/lib/invest/positions';

describe('classifyAsset', () => {
  it('returns "stock" for a 4-letter + 1-2 digit B3 code that is not a FII', () => {
    expect(classifyAsset({ code: 'PETR4', type: 'EQUITY', subtype: null, name: 'Petrobras PN' })).toBe('stock');
    expect(classifyAsset({ code: 'VALE3', type: 'EQUITY', subtype: null, name: 'Vale ON' })).toBe('stock');
  });

  it('returns "fii" for a code ending in 11', () => {
    expect(classifyAsset({ code: 'HGLG11', type: 'EQUITY', subtype: 'FII', name: 'HGLG' })).toBe('fii');
    expect(classifyAsset({ code: 'MXRF11', type: 'EQUITY', subtype: null, name: 'MXRF' })).toBe('fii');
  });

  it('returns "fixed_income" when type is FIXED_INCOME', () => {
    expect(classifyAsset({ code: null, type: 'FIXED_INCOME', subtype: 'CDB', name: 'CDB 100% CDI' })).toBe('fixed_income');
  });

  it('returns "fixed_income" for known fixed-income subtypes regardless of type', () => {
    for (const subtype of ['CDB', 'LCI', 'LCA', 'TESOURO', 'LC']) {
      expect(classifyAsset({ code: null, type: 'OTHER', subtype, name: subtype })).toBe('fixed_income');
    }
  });

  it('falls back to "fixed_income" when the code is malformed', () => {
    expect(classifyAsset({ code: 'XYZ', type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
    expect(classifyAsset({ code: null, type: 'OTHER', subtype: null, name: 'unknown' })).toBe('fixed_income');
  });
});
