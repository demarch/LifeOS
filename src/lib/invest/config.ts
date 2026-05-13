export interface InvestConfig {
  hgKey: string;
  pluggyClientId: string;
  pluggyClientSecret: string;
  pluggyItemIds: string[];
}

export function loadConfig(): InvestConfig {
  const missing: string[] = [];
  const hgKey = process.env.HG_BRASIL_KEY ?? '';
  const pluggyClientId = process.env.PLUGGY_CLIENT_ID ?? '';
  const pluggyClientSecret = process.env.PLUGGY_CLIENT_SECRET ?? '';
  const itemsRaw = process.env.PLUGGY_ITEM_IDS ?? '';

  if (!hgKey) missing.push('HG_BRASIL_KEY');
  if (!pluggyClientId) missing.push('PLUGGY_CLIENT_ID');
  if (!pluggyClientSecret) missing.push('PLUGGY_CLIENT_SECRET');
  if (!itemsRaw) missing.push('PLUGGY_ITEM_IDS');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  return {
    hgKey,
    pluggyClientId,
    pluggyClientSecret,
    pluggyItemIds: itemsRaw.split(',').map(s => s.trim()).filter(Boolean),
  };
}
