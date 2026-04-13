'use client';

import { useState, useEffect } from 'react';
import { RiskAnalysis } from '@/types';
import { getAnalyses, deleteAnalysis, updateAnalysis } from '@/lib/storage';
import { analyzeProperty } from '@/lib/api-client';
import { formatCurrency, formatPercentage, getRiskColor } from '@/lib/formatters';
import { Trash2, RotateCcw, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnalysisHistoryProps {
  onReanalyze?: (analysis: RiskAnalysis) => void;
}

export function AnalysisHistory({ onReanalyze }: AnalysisHistoryProps) {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<RiskAnalysis[]>([]);
  const [mounted, setMounted] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = getAnalyses();
    setAnalyses(stored ?? []);
  }, []);

  const handleDelete = (id?: string) => {
    if (!id) return;
    deleteAnalysis(id);
    setAnalyses((prev) => prev?.filter((a) => a?.id !== id) ?? []);
  };

  const handleReanalyze = async (analysis: RiskAnalysis) => {
    try {
      setRefreshingId(analysis.id ?? null);

      const refreshedResponse = await analyzeProperty({
        home_price: analysis.home_price,
        zip_code: analysis.zip_code,
        flood_score_fema: analysis.flood_score_fema,
        earthquake_score_usgs: analysis.earthquake_score_usgs,
      });

      const refreshedAnalysis: RiskAnalysis = {
        ...analysis,
        ...refreshedResponse,
        timestamp: Date.now(),
      };

      updateAnalysis(refreshedAnalysis);
      setAnalyses((prev) =>
        prev.map((item) => (item?.id === refreshedAnalysis.id ? refreshedAnalysis : item))
      );

      onReanalyze?.(refreshedAnalysis);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('currentAnalysis', JSON.stringify(refreshedAnalysis));
      }

      router.push('/results');
    } catch (error) {
      console.error('Failed to refresh analysis from API:', error);
    } finally {
      setRefreshingId(null);
    }
  };

  if (!mounted) {
    return <div className="text-center text-gray-500">Loading history...</div>;
  }

  if (!analyses || analyses.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No analysis history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analyses?.map?.((analysis) => {
        const timestamp = analysis?.timestamp
          ? new Date(analysis.timestamp).toLocaleDateString()
          : 'Unknown date';
        const bgColor = getRiskColor(analysis?.risk_level);
        const isRefreshing = refreshingId !== null && refreshingId === analysis?.id;

        return (
          <div
            key={analysis?.id}
            className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {analysis?.zip_code ? `ZIP: ${analysis.zip_code}` : 'ZIP: Unknown'}
                </h3>
                <p className="text-sm text-gray-500">{timestamp}</p>
              </div>
              <div className={`px-3 py-1 rounded text-white text-sm font-semibold ${bgColor}`}>
                {analysis?.risk_level ?? 'Unknown'}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Home Price</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(analysis?.home_price)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Annual Loss</p>
                <p className="font-semibold text-gray-900">
                  {formatPercentage(analysis?.annualized_loss_percent)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Value 2040</p>
                <p className="font-semibold text-gray-900">
                  {formatCurrency(analysis?.climate_adjusted_value_2040)}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleReanalyze(analysis)}
                disabled={isRefreshing}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded transition-all disabled:opacity-60"
              >
                <RotateCcw className="w-4 h-4" />
                {isRefreshing ? 'Refreshing...' : 'Refresh & View'}
              </button>
              <button
                onClick={() => handleDelete(analysis?.id)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
