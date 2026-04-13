'use client';

import { RiskAnalysis } from '@/types';

const STORAGE_KEY = 'floodscore_analyses';
const MAX_ANALYSES = 50;

function persistAnalyses(analyses: RiskAnalysis[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses.slice(0, MAX_ANALYSES)));
}

export function saveAnalysis(analysis: RiskAnalysis): void {
  try {
    if (typeof window === 'undefined') return;
    const analyses = getAnalyses() ?? [];
    const newAnalysis = {
      ...analysis,
      id: analysis.id ?? `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    persistAnalyses([newAnalysis, ...analyses]);
  } catch (error) {
    console.error('Storage Error:', error);
  }
}

export function updateAnalysis(updatedAnalysis: RiskAnalysis): void {
  try {
    if (typeof window === 'undefined') return;
    const analyses = getAnalyses() ?? [];

    if (!updatedAnalysis.id) {
      saveAnalysis(updatedAnalysis);
      return;
    }

    const updated = analyses.map((analysis) =>
      analysis?.id === updatedAnalysis.id ? { ...updatedAnalysis, timestamp: Date.now() } : analysis
    );

    persistAnalyses(updated);
  } catch (error) {
    console.error('Storage Error:', error);
  }
}

export function getAnalyses(): RiskAnalysis[] {
  try {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Storage Error:', error);
    return [];
  }
}

export function deleteAnalysis(id?: string): void {
  try {
    if (typeof window === 'undefined' || !id) return;
    const analyses = getAnalyses() ?? [];
    const filtered = analyses.filter((a) => a?.id !== id);
    persistAnalyses(filtered);
  } catch (error) {
    console.error('Storage Error:', error);
  }
}
