import { PluggyClient } from 'pluggy-sdk';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { positions } from '@/db/schema';
import { classifyAsset } from './positions';
import type { AssetClass } from './types';
import { PluggyItemError } from './types';

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

export interface SyncPositionsResult {
  synced: number;
  errors: string[];
}

interface ClientShim {
  fetchInvestments: (itemId: string) => Promise<{ results: PluggyInvestment[] }>;
}

export async function syncPositions(
  itemIds: string[],
  clientFactory?: () => ClientShim
): Promise<SyncPositionsResult> {
  const client = clientFactory
    ? clientFactory()
    : (new PluggyClient({
        clientId: process.env.PLUGGY_CLIENT_ID!,
        clientSecret: process.env.PLUGGY_CLIENT_SECRET!,
      }) as unknown as ClientShim);

  const now = Math.floor(Date.now() / 1000);
  let synced = 0;
  const errors: string[] = [];

  for (const itemId of itemIds) {
    try {
      const { results } = await client.fetchInvestments(itemId);
      for (const inv of results) {
        if (inv.status !== 'ACTIVE') continue;
        const mapped = mapInvestmentToPosition(inv);
        const existing = db.select().from(positions).where(eq(positions.pluggyId, mapped.pluggyId)).get();
        if (existing) {
          db.update(positions).set({
            ticker:       mapped.ticker,
            name:         mapped.name,
            assetClass:   mapped.assetClass,
            quantity:     mapped.quantity,
            avgPrice:     mapped.avgPrice,
            currentValue: mapped.currentValue,
            updatedAt:    now,
          }).where(eq(positions.pluggyId, mapped.pluggyId)).run();
        } else {
          db.insert(positions).values({
            id:           randomUUID(),
            pluggyId:     mapped.pluggyId,
            accountId:    null,
            ticker:       mapped.ticker,
            name:         mapped.name,
            assetClass:   mapped.assetClass,
            quantity:     mapped.quantity,
            avgPrice:     mapped.avgPrice,
            currentValue: mapped.currentValue,
            lastQuote:    null,
            lastQuoteAt:  null,
            updatedAt:    now,
          }).run();
        }
        synced++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(new PluggyItemError(itemId, msg).message);
    }
  }

  return { synced, errors };
}
