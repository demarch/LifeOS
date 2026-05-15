'use client';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import type { PortfolioSnapshot } from '@/db/schema';

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface EvolutionLineProps {
  snapshots: PortfolioSnapshot[];
}

export function EvolutionLine({ snapshots }: EvolutionLineProps) {
  if (snapshots.length < 2) {
    return (
      <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', fontSize: 13 }}>
        Aguardando histórico (mín. 2 snapshots)
      </div>
    );
  }
  const ordered = [...snapshots].reverse();
  const data = {
    labels: ordered.map(s => s.snapshotDate),
    datasets: [{
      label: 'Patrimônio',
      data: ordered.map(s => s.totalValue),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.15)',
      fill: true,
      tension: 0.25,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
    },
  };
  return (
    <div style={{ height: 260 }}>
      <Line data={data} options={options} />
    </div>
  );
}
