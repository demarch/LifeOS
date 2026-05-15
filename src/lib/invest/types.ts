export type AssetClass = 'stock' | 'fii' | 'fixed_income';

export interface HgQuote {
  ticker: string;
  price: number;
  changePercent: number | null;
}

export interface ClassTotals {
  total: number;
  stocks: number;
  fiis: number;
  fixedIncome: number;
}

export class HgAuthError extends Error {
  constructor(msg = 'HG Brasil rejected the API key') {
    super(msg);
    this.name = 'HgAuthError';
  }
}

export class HgRateLimitError extends Error {
  constructor(msg = 'HG Brasil daily rate limit reached') {
    super(msg);
    this.name = 'HgRateLimitError';
  }
}

export class PluggyItemError extends Error {
  constructor(public itemId: string, msg: string) {
    super(`Pluggy item ${itemId}: ${msg}`);
    this.name = 'PluggyItemError';
  }
}
