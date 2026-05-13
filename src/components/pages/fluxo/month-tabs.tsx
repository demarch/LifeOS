'use client';
import { Icon } from '@/components/atoms/icon';
import type { CashFlowMonth } from '@/db/schema';

interface MonthTabsProps {
  months: CashFlowMonth[];
  currentId: string | null;
  entryCounts: Record<string, number>;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function MonthTabs({ months, currentId, entryCounts, onSelect, onAdd }: MonthTabsProps) {
  return (
    <div className="fluxo-tabs">
      {months.map(m => (
        <button
          key={m.id}
          className={`fluxo-tab${m.id === currentId ? ' active' : ''}`}
          onClick={() => onSelect(m.id)}
        >
          <Icon name="calendar" size={12} />
          {m.name}
          <span className="badge">{entryCounts[m.id] ?? 0}</span>
        </button>
      ))}
      <button className="fluxo-tab" onClick={onAdd} title="Adicionar mês">
        <Icon name="plus" size={12} /> Novo mês
      </button>
    </div>
  );
}
