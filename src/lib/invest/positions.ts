import type { AssetClass } from './types';

const FIXED_SUBTYPES = new Set(['CDB', 'LCI', 'LCA', 'TESOURO', 'LC']);
const FII_RE = /^[A-Z]{4}11$/;
const STOCK_RE = /^[A-Z]{4}\d{1,2}$/;

export interface ClassifierInput {
  code: string | null;
  type: string | null;
  subtype: string | null;
  name: string;
}

export function classifyAsset(inv: ClassifierInput): AssetClass {
  if (inv.type === 'FIXED_INCOME') return 'fixed_income';
  if (inv.subtype && FIXED_SUBTYPES.has(inv.subtype)) return 'fixed_income';
  if (inv.code && FII_RE.test(inv.code)) return 'fii';
  if (inv.code && STOCK_RE.test(inv.code)) return 'stock';
  return 'fixed_income';
}

export interface PositionValueInput {
  assetClass: AssetClass;
  quantity: number;
  lastQuote: number | null;
  pluggyBalance: number | null;
}

export function computePositionValue(p: PositionValueInput): number {
  if (p.assetClass === 'fixed_income') return p.pluggyBalance ?? 0;
  if (p.lastQuote == null) return 0;
  return p.quantity * p.lastQuote;
}

export interface GainLossInput {
  currentValue: number;
  quantity: number;
  avgPrice: number;
}

export function computeGainLoss(p: GainLossInput): number {
  return p.currentValue - p.quantity * p.avgPrice;
}
