import { AnalysisRequest, AnalysisResponse, ZipRiskLookupResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

export async function analyzeProperty(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  try {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: AnalysisResponse = await response.json();
    return data;
  } catch (error) {
    console.error('API Analysis Error:', error);
    throw error;
  }
}

export async function fetchZipRiskScores(zipCode: string): Promise<ZipRiskLookupResponse> {
  const normalizedZip = (zipCode ?? '').trim();

  if (!/^\d{5}$/.test(normalizedZip)) {
    return {
      zip_code: normalizedZip,
      found: false,
      message: 'ZIP code must be 5 digits',
    };
  }

  try {
    const response = await fetch(`${API_URL}/risk-scores/${normalizedZip}`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data: ZipRiskLookupResponse = await response.json();
    return data;
  } catch (error) {
    console.error('ZIP score lookup error:', error);
    throw error;
  }
}