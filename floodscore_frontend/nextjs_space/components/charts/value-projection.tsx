'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ValueProjectionProps {
  currentValue?: number;
  projectedValue?: number;
}

export function ValueProjection({
  currentValue = 0,
  projectedValue = 0,
}: ValueProjectionProps) {
  const years = 15;
  const data = Array.from({ length: years + 1 }, (_, i) => {
    const year = 2024 + i;
    const progress = i / years;
    const value =
      (currentValue ?? 0) +
      ((projectedValue ?? 0) - (currentValue ?? 0)) * progress;
    return {
      year,
      actual: year === 2024 ? currentValue : null,
      projected: value,
    };
  });

  const formatCurrency = (value: any) => `$${(value / 1000000).toFixed(1)}M`;

  return (
    <div className="w-full h-80 min-h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 28, right: 16, left: 8, bottom: 34 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12 }}
            label={{
              value: 'Year',
              position: 'insideBottom',
              offset: -4,
            }}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12 }}
            width={56}
            label={{
              value: 'Property Value',
              angle: -90,
              position: 'insideLeft',
              offset: 4,
            }}
          />
          <Tooltip formatter={(value) => formatCurrency(value)} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="line"
            wrapperStyle={{ fontSize: 12, paddingBottom: 12 }}
          />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#2563eb"
            strokeWidth={2}
            name="Climate-Adjusted Value"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
