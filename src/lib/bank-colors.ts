export const BANK_COLORS: Record<string, string> = {
  Nubank:      '#a78bfa',
  Inter:       '#f97373',
  Bradesco:    '#f59e0b',
  Itaú:        '#f97316',
  'Banco do Brasil': '#fbbf24',
  Santander:   '#ef4444',
  Caixa:       '#3b82f6',
  XP:          '#22c55e',
  C6:          '#64748b',
  Neon:        '#06b6d4',
  PicPay:      '#4ade80',
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const _normalized = Object.fromEntries(
  Object.entries(BANK_COLORS).map(([k, v]) => [normalize(k), v])
);

export function bankColor(bank: string): string {
  return _normalized[normalize(bank)] ?? '#a78bfa';
}

/** Map Pluggy's raw account name to a canonical bank name */
export function extractBankName(accountName: string): string {
  const u = accountName.toUpperCase();
  if (u.includes('ITAU') || u.includes('ITAÚ'))           return 'Itaú';
  if (u.includes('NUBANK') || u.startsWith('NU '))         return 'Nubank';
  if (u.includes('INTER'))                                  return 'Inter';
  if (u.includes('BRADESCO'))                               return 'Bradesco';
  if (u.includes('SANTANDER'))                              return 'Santander';
  if (u.includes('CAIXA') || u.includes('CEF'))            return 'Caixa';
  if (u.includes('BANCO DO BRASIL') || u.startsWith('BB ')) return 'Banco do Brasil';
  if (u === 'XP' || u.startsWith('XP '))                   return 'XP';
  if (u.includes('C6'))                                     return 'C6';
  if (u.includes('NEON'))                                   return 'Neon';
  if (u.includes('PICPAY'))                                 return 'PicPay';
  return accountName.split(' ')[0];
}
