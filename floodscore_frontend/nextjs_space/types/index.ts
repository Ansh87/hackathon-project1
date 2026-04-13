// API Request/Response Types
export interface AnalysisRequest {
  home_price: number;
  zip_code: string;
  flood_score_fema: number;
  earthquake_score_usgs: number;
}

export interface AnalysisResponse {
  climate_adjusted_value_2040: number;
  climate_neutral_value_2040?: number;
  projected_climate_loss_2040?: number;
  annualized_loss_percent: number;
  insurance_death_spiral: boolean;
  information_asymmetry_gap: number;
  risk_level: string;
  bank_insight: string;
}

export interface ZipRiskLookupResponse {
  zip_code: string;
  found: boolean;
  location?: string;
  flood_score_fema?: number;
  earthquake_score_usgs?: number;
  message?: string;
}
export interface RiskAnalysis extends AnalysisRequest, AnalysisResponse {
  id?: string;
  timestamp?: number;
}

export type RiskLevel = 'Extreme' | 'High' | 'Medium' | 'Low';