'use client';

import { useState } from 'react';
import { AnalysisForm } from '@/components/analysis-form';
import { AnalysisHistory } from '@/components/analysis-history';
import { AnalysisResponse, AnalysisRequest } from '@/types';

export default function AnalyzePage() {
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisResponse & AnalysisRequest | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Property Risk Analysis</h1>
          <p className="text-xl text-gray-600">
            Enter your property details to get a comprehensive climate risk assessment
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <AnalysisForm onResult={setSelectedAnalysis} />
          </div>

          <div>
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-20">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis History</h2>
              <AnalysisHistory onReanalyze={setSelectedAnalysis} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
