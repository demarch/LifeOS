'use client';
import { useEffect, useRef } from 'react';
import {
  Chart,
  BarController,
  BarElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, LinearScale, CategoryScale, Tooltip, Legend);

interface ComparisonChartProps {
  labels: string[];
  entradas: number[];
  saidas: number[];
}

export function ComparisonChart({ labels, entradas, saidas }: ComparisonChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.body);
    const good   = styles.getPropertyValue('--good').trim()   || '#5fd39a';
    const danger = styles.getPropertyValue('--danger').trim() || '#f47272';
    const text2  = styles.getPropertyValue('--text-2').trim() || '#8a8aa0';
    const line   = styles.getPropertyValue('--line').trim()   || '#232339';

    chartRef.current?.destroy();
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Entradas', data: entradas, backgroundColor: good, borderRadius: 4 },
          { label: 'Saídas',   data: saidas,   backgroundColor: danger, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: text2 } },
        },
        scales: {
          x: { ticks: { color: text2 }, grid: { color: line } },
          y: { ticks: { color: text2 }, grid: { color: line } },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [labels, entradas, saidas]);

  return <canvas ref={canvasRef} />;
}
