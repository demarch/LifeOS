export function daysUntilDue(dueDay: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let due = new Date(year, month, dueDay);
  if (due.getTime() <= now.getTime()) {
    due = new Date(year, month + 1, dueDay);
  }

  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function billTone(dueDay: number, isPaid: boolean): 'ok' | 'urgent' | 'soon' | 'future' {
  if (isPaid) return 'ok';
  const d = daysUntilDue(dueDay);
  if (d <= 3) return 'urgent';
  if (d <= 7) return 'soon';
  return 'future';
}

export function dayLabel(date: string): string {
  const dt = new Date(date + 'T12:00:00');
  return dt
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '');
}

export function monthYear(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
