import type { Bill } from '@/db/schema';

interface CalendarStripProps {
  bills: Bill[];
}

export function CalendarStrip({ bills }: CalendarStripProps) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const DOW = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

  return (
    <div className="calendar-strip">
      {days.map((d, i) => {
        const hasBill = bills.some(b => !b.isPaid && b.dueDay === d.getDate());
        return (
          <div key={i} className={`cell${i === 0 ? ' today' : ''}`}>
            <span className="dow">{DOW[d.getDay()]}</span>
            <span className="dn">{d.getDate()}</span>
            {hasBill && <span className="pip" />}
          </div>
        );
      })}
    </div>
  );
}
