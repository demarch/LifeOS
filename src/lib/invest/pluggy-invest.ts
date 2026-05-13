import { classifyAsset } from './positions';
import type { AssetClass } from './types';

export interface PluggyInvestment {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  subtype: string | null;
  quantity: number;
  amount: number;
  balance: number | null;
  amountWithdrawal?: number | null;
  status: string;
  issuer?: string;
}

export interface MappedPosition {
  pluggyId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentValue: number;
  lastQuote: number | null;
}

export function mapInvestmentToPosition(inv: PluggyInvestment): MappedPosition {
  const assetClass = classifyAsset({
    code: inv.code,
    type: inv.type,
    subtype: inv.subtype,
    name: inv.name,
  });
  const quantity = inv.quantity ?? 0;
  const amount = inv.amount ?? 0;
  const balance = inv.balance ?? inv.amountWithdrawal ?? 0;
  const avgPrice = quantity > 0 ? amount / quantity : 0;

  const isMarket = assetClass === 'stock' || assetClass === 'fii';
  const ticker = isMarket && inv.code ? inv.code : inv.name;

  return {
    pluggyId: inv.id,
    ticker,
    name: inv.name,
    assetClass,
    quantity,
    avgPrice,
    currentValue: balance,
    lastQuote: null,
  };
}
