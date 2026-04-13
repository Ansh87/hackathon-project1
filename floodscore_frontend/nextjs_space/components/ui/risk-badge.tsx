'use client';

import { getRiskColor, getRiskTextColor } from '@/lib/formatters';
import { AlertTriangle, CheckCircle, Info, TrendingDown } from 'lucide-react';

interface RiskBadgeProps {
  riskLevel?: string;
}

export function RiskBadge({ riskLevel = 'Unknown' }: RiskBadgeProps) {
  const bgColor = getRiskColor(riskLevel);

  const getIcon = (level: string) => {
    const levelLower = level?.toLowerCase() ?? '';
    switch (levelLower) {
      case 'extreme':
        return <AlertTriangle className="w-5 h-5" />;
      case 'high':
        return <TrendingDown className="w-5 h-5" />;
      case 'medium':
        return <Info className="w-5 h-5" />;
      case 'low':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${bgColor} text-white font-semibold text-lg`}>
      {getIcon(riskLevel)}
      <span>{riskLevel}</span>
    </div>
  );
}
