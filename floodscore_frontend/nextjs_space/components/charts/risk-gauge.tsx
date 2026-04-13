'use client';

import dynamic from 'next/dynamic';

// @ts-ignore
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-80 bg-gray-50">Loading chart...</div>,
});

interface RiskGaugeProps {
  floodScore?: number;
  earthquakeScore?: number;
}

export function RiskGauge({ floodScore = 0, earthquakeScore = 0 }: RiskGaugeProps) {
  const combinedScore = Math.min(100, Math.max(0, ((floodScore ?? 0) + (earthquakeScore ?? 0)) / 2));

  const data: any = [
    {
      type: 'indicator',
      mode: 'gauge+number',
      value: combinedScore,
      number: { suffix: '%' },
      domain: { x: [0, 1], y: [0, 0.9] },
      title: { text: 'Combined Risk Score' },
      gauge: {
        axis: {
          range: [0, 100],
          tickwidth: 1,
          tickcolor: '#6b7280',
          tickfont: { size: 12 },
        },
        bar: { color: '#2563eb' },
        steps: [
          { range: [0, 25], color: '#dcfce7' },
          { range: [25, 50], color: '#fef08a' },
          { range: [50, 75], color: '#fed7aa' },
          { range: [75, 100], color: '#fee2e2' },
        ],
        threshold: {
          line: { color: '#dc2626', width: 4 },
          thickness: 0.75,
          value: 75,
        },
      },
    },
  ];

  const layout: any = {
    autosize: true,
    height: 300,
    margin: { t: 52, r: 28, l: 28, b: 24 },
    font: { size: 12 },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
  };

  const config: any = {
    responsive: true,
    displaylogo: false,
    displayModeBar: false,
  };

  return (
    <div className="w-full h-80">
      <Plot data={data} layout={layout} config={config} useResizeHandler style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
