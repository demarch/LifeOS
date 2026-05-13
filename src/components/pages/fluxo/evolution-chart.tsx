'use client';
import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend, Filler);

interface EvolutionChartProps {
  labels: string[];
  data: number[];
}

export function EvolutionChart({ labels, data }: EvolutionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.body);
    const accent = styles.getPropertyValue('--accent').trim() || '#a78bfa';
    const text2  = styles.getPropertyValue('--text-2').trim() || '#8a8aa0';
    const line   = styles.getPropertyValue('--line').trim()   || '#232339';

    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Saldo acumulado',
          data,
          borderColor: accent,
          backgroundColor: `${accent}22`,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: text2 } },
          tooltip: { intersect: false, mode: 'index' },
        },
        scales: {
          x: { ticks: { color: text2 }, grid: { color: line } },
          y: { ticks: { color: text2 }, grid: { color: line } },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [labels, data]);

  return <canvas ref={canvasRef} />;
}
