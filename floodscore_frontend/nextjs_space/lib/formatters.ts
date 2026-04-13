export function formatCurrency(value?: number): string {
  if (value === null || value === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value?: number): string {
  if (value === null || value === undefined) return '0%';
  return `${Math.round(value * 100) / 100}%`;
}

export function formatNumber(value?: number): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function getRiskColor(riskLevel?: string): string {
  if (!riskLevel) return 'bg-gray-200';
  const level = riskLevel?.toLowerCase() ?? '';
  switch (level) {
    case 'extreme':
      return 'bg-red-600';
    case 'high':
      return 'bg-orange-600';
    case 'medium':
      return 'bg-yellow-600';
    case 'low':
      return 'bg-green-600';
    default:
      return 'bg-gray-600';
  }
}

export function getRiskColorLight(riskLevel?: string): string {
  if (!riskLevel) return 'bg-gray-100';
  const level = riskLevel?.toLowerCase() ?? '';
  switch (level) {
    case 'extreme':
      return 'bg-red-100';
    case 'high':
      return 'bg-orange-100';
    case 'medium':
      return 'bg-yellow-100';
    case 'low':
      return 'bg-green-100';
    default:
      return 'bg-gray-100';
  }
}

export function getRiskTextColor(riskLevel?: string): string {
  if (!riskLevel) return 'text-gray-700';
  const level = riskLevel?.toLowerCase() ?? '';
  switch (level) {
    case 'extreme':
      return 'text-red-700';
    case 'high':
      return 'text-orange-700';
    case 'medium':
      return 'text-yellow-700';
    case 'low':
      return 'text-green-700';
    default:
      return 'text-gray-700';
  }
}
