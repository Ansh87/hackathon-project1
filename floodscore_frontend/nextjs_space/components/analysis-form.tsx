'use client';

import { useState } from 'react';
import { analyzeProperty, fetchZipRiskScores } from '@/lib/api-client';
import { saveAnalysis } from '@/lib/storage';
import { AnalysisRequest, AnalysisResponse } from '@/types';
import { DollarSign, MapPin, Droplets, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AnalysisFormProps {
  onResult?: (result: AnalysisResponse & AnalysisRequest) => void;
}

export function AnalysisForm({ onResult }: AnalysisFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<AnalysisRequest>({
    home_price: 500000,
    zip_code: '',
    flood_score_fema: 0,
    earthquake_score_usgs: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zipLookupLoading, setZipLookupLoading] = useState(false);
  const [zipLookupMessage, setZipLookupMessage] = useState('');

  const handleInputChange = (field: keyof AnalysisRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
    if (field === 'zip_code') {
      setZipLookupMessage('');
    }
  };

  const handleZipBlur = async () => {
    const normalizedZip = (formData?.zip_code ?? '').trim();

    if (!/^\d{5}$/.test(normalizedZip)) {
      return;
    }

    setZipLookupLoading(true);

    try {
      const lookup = await fetchZipRiskScores(normalizedZip);

      if (lookup.found) {
        setFormData((prev) => ({
          ...prev,
          flood_score_fema: lookup.flood_score_fema ?? prev.flood_score_fema,
          earthquake_score_usgs: lookup.earthquake_score_usgs ?? prev.earthquake_score_usgs,
        }));
        setZipLookupMessage(
          `Auto-populated risk scores for ${lookup.location ?? normalizedZip}.`
        );
      } else {
        setZipLookupMessage('ZIP not found in risk database. Keeping current slider values.');
      }
    } catch (err) {
      console.error('ZIP lookup failed:', err);
      setZipLookupMessage('Could not auto-populate scores right now. You can set sliders manually.');
    } finally {
      setZipLookupLoading(false);
    }
  };
  const validateForm = (): boolean => {
    if (!formData?.home_price || formData.home_price <= 0) {
      setError('Please enter a valid home price');
      return false;
    }
    if (!formData?.zip_code || formData.zip_code.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return false;
    }
    if (formData?.flood_score_fema === null || formData.flood_score_fema === undefined) {
      setError('Please set FEMA flood score');
      return false;
    }
    if (formData?.earthquake_score_usgs === null || formData.earthquake_score_usgs === undefined) {
      setError('Please set USGS earthquake score');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const response = await analyzeProperty(formData);
      const fullAnalysis = { ...formData, ...response };

      saveAnalysis(fullAnalysis);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('currentAnalysis', JSON.stringify(fullAnalysis));
      }

      onResult?.(fullAnalysis);
      router.push('/results');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze property';
      setError(`Error: ${errorMessage}`);
      console.error('Form submission error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8"
    >
      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <DollarSign className="w-4 h-4 text-blue-600" />
          Home Price (USD)
        </label>
        <input
          type="number"
          min="0"
          step="1000"
          value={formData?.home_price ?? ''}
          onChange={(e) => handleInputChange('home_price', Number(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          placeholder="Enter home price"
        />
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          ZIP Code
        </label>
        <input
          type="text"
          maxLength={5}
          value={formData?.zip_code ?? ''}
          onChange={(e) => handleInputChange('zip_code', e.target.value.replace(/\D/g, ''))}
          onBlur={handleZipBlur}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          placeholder="5-digit ZIP code"
        />
        {(zipLookupLoading || zipLookupMessage) && (
          <p className="mt-2 text-xs text-gray-600">
            {zipLookupLoading ? 'Checking ZIP risk database...' : zipLookupMessage}
          </p>
        )}
      </div>

      <div className="mb-6">
        <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
          <span className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-600" />
            FEMA Flood Score
          </span>
          <span className="text-lg font-bold text-blue-600">
            {formData?.flood_score_fema ?? 0}
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={formData?.flood_score_fema ?? 0}
          onChange={(e) => handleInputChange('flood_score_fema', Number(e.target.value))}
          className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 (Low)</span>
          <span>100 (High)</span>
        </div>
      </div>

      <div className="mb-6">
        <label className="flex items-center justify-between text-sm font-semibold text-gray-700 mb-2">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-600" />
            USGS Earthquake Score
          </span>
          <span className="text-lg font-bold text-orange-600">
            {formData?.earthquake_score_usgs ?? 0}
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={formData?.earthquake_score_usgs ?? 0}
          onChange={(e) => handleInputChange('earthquake_score_usgs', Number(e.target.value))}
          className="w-full h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer accent-orange-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 (Low)</span>
          <span>100 (High)</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block animate-spin">⚙️</span>
            Analyzing Property...
          </>
        ) : (
          'Analyze Property'
        )}
      </button>
    </form>
  );
}