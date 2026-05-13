import { Icon } from '@/components/atoms/icon';
import { fmt } from '@/lib/fmt';

interface GlobalKpisProps {
  entradas: number;
  saidas: number;
  saldo: number;
  mediaMensal: number;
  monthCount: number;
}

export function GlobalKpis({ entradas, saidas, saldo, mediaMensal, monthCount }: GlobalKpisProps) {
  return (
    <div className="kpi-grid">
      <div className="kpi good">
        <div className="label">
          Entradas total
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--good) 18%, transparent)', color: 'var(--good)' }}>
            <Icon name="arrowUp" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(entradas)}</div>
        <div className="delta">somando {monthCount} mês(es) planejado(s)</div>
      </div>

      <div className="kpi danger">
        <div className="label">
          Saídas total
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--danger) 18%, transparent)', color: 'var(--danger)' }}>
            <Icon name="arrowDown" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(saidas)}</div>
        <div className="delta">{monthCount > 0 ? 'plano agregado' : 'sem dados'}</div>
      </div>

      <div className={`kpi ${saldo >= 0 ? 'accent' : 'danger'}`}>
        <div className="label">
          Saldo geral
          <span className="ic-wrap" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="wallet" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(saldo)}</div>
        <div className="delta">entradas − saídas</div>
      </div>

      <div className="kpi warn">
        <div className="label">
          Média mensal
          <span className="ic-wrap" style={{ background: 'color-mix(in oklch, var(--warn) 18%, transparent)', color: 'var(--warn)' }}>
            <Icon name="trending" size={14} />
          </span>
        </div>
        <div className="num mask">{fmt(mediaMensal)}</div>
        <div className="delta">performance média</div>
      </div>
    </div>
  );
}
