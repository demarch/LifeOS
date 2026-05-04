export function fmt(v: number, opts: { signed?: boolean } = {}): string {
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const [intPart, decPart = '00'] = abs.toFixed(2).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = intFormatted + ',' + decPart;
  const sign = n < 0 ? '-' : (opts.signed && n > 0 ? '+' : '');
  return sign + 'R$ ' + s;
}
