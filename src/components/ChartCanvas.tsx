import { useEffect, useRef } from 'react';
import {
  Chart, BarController, LineController, DoughnutController, PieController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Tooltip, Legend, Title,
} from 'chart.js';
import type { ChartData } from '../types';

Chart.register(
  BarController, LineController, DoughnutController, PieController,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Tooltip, Legend, Title,
);

interface Props {
  data: ChartData;
  color: string;
  isDark: boolean;
}

export function ChartCanvas({ data, color, isDark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const textColor = isDark ? 'rgba(241, 245, 249, 0.8)' : 'rgba(51, 65, 85, 0.9)';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.2)';

    const config = {
      type: data.chartType,
      data: {
        labels: data.labels,
        datasets: [
          {
            label: data.title || '',
            data: data.values,
            backgroundColor: data.chartType === 'doughnut' || data.chartType === 'pie'
              ? _palette(data.values.length, color)
              : _hexWithAlpha(color, 0.7),
            borderColor: color,
            borderWidth: 2,
            tension: 0.3,
            fill: data.chartType === 'line',
            pointBackgroundColor: color,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: data.chartType === 'doughnut' || data.chartType === 'pie',
            position: 'bottom',
            labels: { color: textColor, font: { size: 11 } },
          },
          tooltip: { enabled: true },
        },
        scales: data.chartType === 'doughnut' || data.chartType === 'pie'
          ? {}
          : {
              x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
              y: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor }, beginAtZero: true },
            },
      },
    };

    chartRef.current = new Chart(ctx, config as never);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, color, isDark]);

  return (
    <div className="w-full h-full min-h-[180px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}

function _hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function _palette(n: number, base: string): string[] {
  const colors = [base, '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(colors[i % colors.length]);
  return out;
}
