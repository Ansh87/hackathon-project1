'use client';

import { useState, useEffect } from 'react';
import { RiskAnalysis } from '@/types';
import { RiskBadge } from '@/components/ui/risk-badge';
import { MetricCard } from '@/components/ui/metric-card';
import { RiskGauge } from '@/components/charts/risk-gauge';
import { RiskPie } from '@/components/charts/risk-pie';
import { ValueProjection } from '@/components/charts/value-projection';
import { formatCurrency, formatPercentage, getRiskColorLight } from '@/lib/formatters';
import { DollarSign, TrendingDown, AlertTriangle, Info, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ResultsPage() {
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = sessionStorage.getItem('currentAnalysis');
    if (stored) {
      try {
        const data: RiskAnalysis = JSON.parse(stored);
        setAnalysis(data);
      } catch (e) {
        console.error('Failed to parse stored analysis:', e);
      }
    }
  }, []);

  if (!mounted || !analysis) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No analysis data available</p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Analysis
          </Link>
        </div>
      </div>
    );
  }

  const projectedDelta = (analysis?.climate_adjusted_value_2040 ?? 0) - (analysis?.home_price ?? 0);
  const climateLoss2040 = analysis?.projected_climate_loss_2040 ?? Math.max(
    0,
    (analysis?.climate_neutral_value_2040 ?? 0) - (analysis?.climate_adjusted_value_2040 ?? 0)
  );
  const infoAsymmetryGap = analysis?.information_asymmetry_gap ?? 0;
  const infoAsymmetryAbs = Math.abs(infoAsymmetryGap);
  const infoAsymmetryDescription =
    infoAsymmetryGap > 0
      ? 'Potential overpricing vs climate-adjusted 2040 value'
      : infoAsymmetryGap < 0
      ? 'Potential underpricing vs climate-adjusted 2040 value'
      : 'No pricing gap detected';

  const bgColor = getRiskColorLight(analysis?.risk_level);
  const borderColor = analysis?.risk_level === 'Extreme' ? 'border-red-600' : analysis?.risk_level === 'High' ? 'border-orange-600' : analysis?.risk_level === 'Medium' ? 'border-yellow-600' : 'border-green-600';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Analysis
        </Link>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Risk Analysis Results
          </h1>
          <p className="text-gray-600">
            ZIP Code: {analysis?.zip_code ?? 'N/A'} • Home Price: {formatCurrency(analysis?.home_price)}
          </p>
        </div>

        <div className={`${bgColor} border-l-4 ${borderColor} rounded-lg p-6 mb-8`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Overall Risk Level
              </h2>
              <p className="text-gray-600">
                Based on FEMA flood and USGS earthquake data for this location
              </p>
            </div>
            <RiskBadge riskLevel={analysis?.risk_level} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Climate-Adjusted Value (2040)"
            value={formatCurrency(analysis?.climate_adjusted_value_2040)}
            icon={<DollarSign className="w-5 h-5" />}
            description={`Loss vs no-risk baseline: ${formatCurrency(climateLoss2040)} • ${projectedDelta >= 0 ? 'Projected gain' : 'Projected decline'} vs today: ${formatCurrency(Math.abs(projectedDelta))}`}
          />
          <MetricCard
            title="Annualized Loss %"
            value={formatPercentage(analysis?.annualized_loss_percent)}
            icon={<TrendingDown className="w-5 h-5" />}
            description="Per year on average"
          />
          <MetricCard
            title="Information Asymmetry"
            value={formatCurrency(infoAsymmetryAbs)}
            icon={<Info className="w-5 h-5" />}
            description={infoAsymmetryDescription}
            highlight
          />
          <MetricCard
            title="Insurance Death Spiral"
            value={analysis?.insurance_death_spiral ? 'ALERT' : 'Safe'}
            icon={<AlertTriangle className="w-5 h-5" />}
            description={analysis?.insurance_death_spiral ? 'High Risk' : 'Low Risk'}
          />
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-600 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Bank Insight</h3>
          <p className="text-gray-700 text-lg">{analysis?.bank_insight}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Risk Breakdown</h3>
            <RiskPie
              floodScore={analysis?.flood_score_fema}
              earthquakeScore={analysis?.earthquake_score_usgs}
            />
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Combined Risk Score
            </h3>
            <RiskGauge
              floodScore={analysis?.flood_score_fema}
              earthquakeScore={analysis?.earthquake_score_usgs}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            15-Year Value Projection
          </h3>
          <ValueProjection
            currentValue={analysis?.home_price}
            projectedValue={analysis?.climate_adjusted_value_2040}
          />
        </div>

        <div className="text-center">
          <Link
            href="/analyze"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition-all duration-200"
          >
            Analyze Another Property
          </Link>
        </div>
      </div>
    </div>
  );
}
