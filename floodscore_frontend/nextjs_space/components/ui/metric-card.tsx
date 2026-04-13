'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  highlight?: boolean;
  children?: ReactNode;
}

export function MetricCard({
  title,
  value,
  icon,
  description,
  highlight = false,
  children,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-lg p-6 shadow-md border transition-all hover:shadow-lg ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
    >
      {icon && <div className="mb-3 text-blue-600">{icon}</div>}
      <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
      <div className="text-2xl font-bold text-gray-900 mb-2">{value}</div>
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
      {children}
    </div>
  );
}
