'use client';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
import type { ClassTotals } from '@/lib/invest/types';

Chart.register(ArcElement, Tooltip, Legend);

interface AllocationPieProps {
  totals: ClassTotals;
}

export function AllocationPie({ totals }: AllocationPieProps) {
  const data = {
    labels: ['Ações', 'FIIs', 'Renda Fixa'],
    datasets: [{
      data: [totals.stocks, totals.fiis, totals.fixedIncome],
      backgroundColor: ['#22c55e', '#3b82f6', '#9ca3af'],
      borderColor: 'rgba(0,0,0,0)',
      borderWidth: 1,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#cbd5e1' } } },
    cutout: '60%',
  };
  return (
    <div style={{ height: 260 }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}
