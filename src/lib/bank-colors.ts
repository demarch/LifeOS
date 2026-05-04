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

export function bankColor(bank: string): string {
  return BANK_COLORS[bank] ?? '#a78bfa';
}
