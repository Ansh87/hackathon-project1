'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface RiskPieProps {
  floodScore?: number;
  earthquakeScore?: number;
}

const COLORS = ['#60B5FF', '#FF9149'];

export function RiskPie({ floodScore = 0, earthquakeScore = 0 }: RiskPieProps) {
  const data = [
    {
      name: 'Flood risk',
      value: floodScore ?? 0,
    },
    {
      name: 'Earthquake risk',
      value: earthquakeScore ?? 0,
    },
  ];

  return (
    <div className="w-full h-80 min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 96, left: 96, bottom: 20 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
            label={({ name, percent, x, y, textAnchor }) => (
              <text
                x={x}
                y={y}
                fill="#374151"
                textAnchor={textAnchor}
                dominantBaseline="central"
                fontSize={12}
              >
                {`${name}: ${(percent * 100).toFixed(0)}%`}
              </text>
            )}
            outerRadius="62%"
            fill="#8884d8"
            dataKey="value"
          >
            {data?.map?.((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `${value}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
