"""
FloodScore Flask API
--------------------
API for ZIP-level risk analysis and climate-adjusted property valuation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


# -----------------------------------------------------------------------------
# Configuration and startup data loading
# -----------------------------------------------------------------------------
DEFAULT_PROFILE: Dict[str, Any] = {
    "RISK_SCORE": 50.0,
    "EQL_RISK_SCORE": 50.0,
    "FLD_RISK_SCORE": 50.0,
    "HLP_RISK_SCORE": 50.0,
    "data_estimated": True,
    "note": "Data estimated for this region",
}

RISK_LOOKUP: Dict[str, Dict[str, Any]] = {}
DATA_SOURCE_META: Dict[str, Any] = {
    "csv_loaded": False,
    "csv_path": None,
    "records_loaded": 0,
    "load_warning": None,
}


def _normalize_zip(zip_code: Any) -> str:
    """Normalize ZIP to a 5-digit string when possible."""
    if zip_code is None:
        return ""

    raw = str(zip_code).strip()
    if not raw:
        return ""

    # Keep only digits and then standardize to 5 chars if possible.
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) >= 5:
        return digits[:5]
    return digits


def load_risk_data() -> None:
    """
    Load simplified_risk.csv at startup and build a fast ZIP-indexed dictionary.

    Gracefully handles missing file or malformed content.
    """
    global RISK_LOOKUP, DATA_SOURCE_META

    candidate_paths = [
        Path(__file__).resolve().parent / "simplified_risk.csv",
        Path.cwd() / "simplified_risk.csv",
        Path("/home/ubuntu/Uploads/FloodScore/simplified_risk.csv"),
    ]

    csv_path = next((p for p in candidate_paths if p.exists()), None)

    if not csv_path:
        DATA_SOURCE_META.update(
            {
                "csv_loaded": False,
                "csv_path": None,
                "records_loaded": 0,
                "load_warning": "simplified_risk.csv not found. Using estimated defaults.",
            }
        )
        RISK_LOOKUP = {}
        return

    try:
        df = pd.read_csv(csv_path)
        required_columns = {
            "ZIP",
            "RISK_SCORE",
            "EQL_RISK_SCORE",
            "FLD_RISK_SCORE",
            "HLP_RISK_SCORE",
        }
        missing = required_columns.difference(df.columns)

        if missing:
            DATA_SOURCE_META.update(
                {
                    "csv_loaded": False,
                    "csv_path": str(csv_path),
                    "records_loaded": 0,
                    "load_warning": f"CSV missing required columns: {sorted(missing)}. Using estimated defaults.",
                }
            )
            RISK_LOOKUP = {}
            return

        # Keep only required columns, normalize values, and index by ZIP.
        cleaned_df = df[list(required_columns)].copy()
        cleaned_df["ZIP"] = cleaned_df["ZIP"].apply(_normalize_zip)
        cleaned_df = cleaned_df[cleaned_df["ZIP"].str.len() == 5]

        numeric_cols = ["RISK_SCORE", "EQL_RISK_SCORE", "FLD_RISK_SCORE", "HLP_RISK_SCORE"]
        for col in numeric_cols:
            cleaned_df[col] = pd.to_numeric(cleaned_df[col], errors="coerce").fillna(50.0).clip(0, 100)

        # In case of duplicate ZIPs, keep the most recent row in file order.
        cleaned_df = cleaned_df.drop_duplicates(subset=["ZIP"], keep="last")

        RISK_LOOKUP = cleaned_df.set_index("ZIP").to_dict(orient="index")

        DATA_SOURCE_META.update(
            {
                "csv_loaded": True,
                "csv_path": str(csv_path),
                "records_loaded": len(RISK_LOOKUP),
                "load_warning": None,
            }
        )

    except Exception as exc:  # Defensive catch for startup resilience
        DATA_SOURCE_META.update(
            {
                "csv_loaded": False,
                "csv_path": str(csv_path),
                "records_loaded": 0,
                "load_warning": f"Failed to load CSV: {exc}. Using estimated defaults.",
            }
        )
        RISK_LOOKUP = {}


def _threat_level(hlp_score: float) -> Tuple[str, str]:
    """Map HLP risk score to socio-economic threat level and interpretation."""
    if hlp_score < 30:
        return "Low", "Strong social resilience and lower vulnerability pressure."
    if hlp_score < 60:
        return "Medium", "Moderate social vulnerability; support structures may be uneven."
    if hlp_score <= 80:
        return "High", "High vulnerability; households may struggle to absorb shocks."
    return "Critical", "Critical vulnerability; severe recovery and affordability challenges expected."


def _awareness_gap(combined_hazard_0_100: float, hlp_score: float) -> Dict[str, Any]:
    """
    Build Bank vs. People Awareness Gap analysis.

    Gap widens when both hazard and social vulnerability are high.
    """
    # Baseline weighted gap score.
    gap_score = (combined_hazard_0_100 * 0.6) + (hlp_score * 0.4)

    # Synergy boost for high-high conditions (explicit requirement).
    if combined_hazard_0_100 >= 70 and hlp_score >= 70:
        gap_score += 15

    gap_score = max(0.0, min(100.0, gap_score))

    if gap_score < 35:
        severity = "Low"
        description = "Risk communication is relatively aligned between institutions and residents."
    elif gap_score < 60:
        severity = "Moderate"
        description = "Some mismatch exists; communities may underestimate long-term exposure."
    elif gap_score < 80:
        severity = "High"
        description = "Meaningful awareness gap; lending and insurance signals may diverge from community readiness."
    else:
        severity = "Severe"
        description = "Major awareness gap; high physical risk and vulnerability can lead to abrupt financial stress."

    return {
        "gap_score": round(gap_score, 2),
        "severity": severity,
        "description": description,
        "drivers": {
            "climate_hazard_weight": 0.6,
            "social_vulnerability_weight": 0.4,
            "high_high_synergy_applied": combined_hazard_0_100 >= 70 and hlp_score >= 70,
        },
    }


def get_report(zip_code: str, price: float) -> Dict[str, Any]:
    """
    Core logic: compute complete FloodScore report for a ZIP code and property price.

    Returns a detailed, frontend-ready JSON payload.
    """
    normalized_zip = _normalize_zip(zip_code)
    record = RISK_LOOKUP.get(normalized_zip)

    if record:
        risk_score = float(record["RISK_SCORE"])
        eql_score = float(record["EQL_RISK_SCORE"])
        fld_score = float(record["FLD_RISK_SCORE"])
        hlp_score = float(record["HLP_RISK_SCORE"])
        data_estimated = False
        data_note = "Observed ZIP-level data from simplified_risk.csv"
    else:
        risk_score = DEFAULT_PROFILE["RISK_SCORE"]
        eql_score = DEFAULT_PROFILE["EQL_RISK_SCORE"]
        fld_score = DEFAULT_PROFILE["FLD_RISK_SCORE"]
        hlp_score = DEFAULT_PROFILE["HLP_RISK_SCORE"]
        data_estimated = True
        data_note = DEFAULT_PROFILE["note"]

    # Combined climate hazard uses flood + earthquake scores.
    combined_hazard_0_200 = fld_score + eql_score
    combined_hazard_0_100 = combined_hazard_0_200 / 2.0

    # Climate-Adjusted 2040 Value formula:
    # Penalize 0.5% for every 10 points of (FLD + EQL).
    # penalty_percent = (combined / 10) * 0.5
    penalty_percent = (combined_hazard_0_200 / 10.0) * 0.5
    penalty_rate = penalty_percent / 100.0

    climate_adjusted_2040_value = max(0.0, price * (1.0 - penalty_rate))
    estimated_value_loss = max(0.0, price - climate_adjusted_2040_value)

    current_year = datetime.now(timezone.utc).year
    years_to_2040 = max(1, 2040 - current_year)
    annualized_loss_percent = (1.0 - (climate_adjusted_2040_value / price) ** (1.0 / years_to_2040)) * 100.0

    socio_level, socio_interpretation = _threat_level(hlp_score)
    awareness = _awareness_gap(combined_hazard_0_100, hlp_score)

    # Human-readable interpretation and recommendation blocks.
    if combined_hazard_0_100 >= 75:
        hazard_band = "Very High"
        summary = "Property is exposed to significant climate hazard pressure."
        recommendation = [
            "Request a full climate-risk insurance quote before making offers.",
            "Stress-test affordability with higher annual insurance assumptions.",
            "Prioritize resilience retrofits and emergency preparedness planning.",
        ]
    elif combined_hazard_0_100 >= 55:
        hazard_band = "Elevated"
        summary = "Property carries meaningful climate exposure that should be priced in."
        recommendation = [
            "Negotiate pricing using projected climate-adjusted value.",
            "Review local adaptation infrastructure and flood protection plans.",
            "Set aside contingency reserves for insurance volatility.",
        ]
    else:
        hazard_band = "Moderate"
        summary = "Climate exposure appears manageable under current assumptions."
        recommendation = [
            "Maintain standard due diligence and monitor local risk updates.",
            "Re-check hazard data before refinancing or major renovations.",
            "Keep baseline home resilience and emergency plans current.",
        ]

    response: Dict[str, Any] = {
        "input_summary": {
            "zip_code": normalized_zip,
            "purchase_price": round(price, 2),
            "analysis_horizon": "Current to 2040",
        },
        "risk_scores": {
            "overall_risk_score": round(risk_score, 2),
            "flood_risk_score": round(fld_score, 2),
            "earthquake_risk_score": round(eql_score, 2),
            "social_vulnerability_score": round(hlp_score, 2),
            "combined_climate_risk_score_0_200": round(combined_hazard_0_200, 2),
            "combined_climate_risk_score_0_100": round(combined_hazard_0_100, 2),
        },
        "financial_projections": {
            "climate_adjusted_2040_value": round(climate_adjusted_2040_value, 2),
            "estimated_value_loss_by_2040": round(estimated_value_loss, 2),
            "penalty_percent_applied": round(penalty_percent, 3),
            "annualized_loss_percent": round(max(0.0, annualized_loss_percent), 4),
            "calculation_notes": {
                "formula": "price * (1 - (((FLD_RISK_SCORE + EQL_RISK_SCORE)/10) * 0.5%))",
                "years_to_2040_assumed": years_to_2040,
            },
        },
        "socio_economic_analysis": {
            "threat_level": socio_level,
            "interpretation": socio_interpretation,
            "hlp_risk_score": round(hlp_score, 2),
        },
        "awareness_gap_analysis": {
            "title": "Bank vs. People Awareness Gap",
            "gap_score_0_100": awareness["gap_score"],
            "severity": awareness["severity"],
            "description": awareness["description"],
            "drivers": awareness["drivers"],
        },
        "risk_interpretation": {
            "hazard_band": hazard_band,
            "summary": summary,
            "recommendations": recommendation,
        },
        "metadata": {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "data_estimated": data_estimated,
            "note": data_note,
            "data_source_quality": "estimated_default_profile" if data_estimated else "observed_zip_profile",
            "data_source": {
                "csv_loaded": DATA_SOURCE_META["csv_loaded"],
                "csv_path": DATA_SOURCE_META["csv_path"],
                "records_loaded": DATA_SOURCE_META["records_loaded"],
                "load_warning": DATA_SOURCE_META["load_warning"],
            },
            "api_version": "1.0.0",
        },
    }

    return response


# Load data once at startup.
load_risk_data()


def _coerce_score(value: Any, fallback: float) -> float:
    """Convert score input into a bounded 0-100 float."""
    if value is None:
        return float(fallback)
    try:
        return float(max(0.0, min(100.0, float(value))))
    except (TypeError, ValueError):
        return float(fallback)



def _risk_level_from_scores(flood_score: float, earthquake_score: float) -> str:
    combined = (flood_score + earthquake_score) / 2.0
    if combined >= 80:
        return "Extreme"
    if combined >= 60:
        return "High"
    if combined >= 30:
        return "Medium"
    return "Low"



def _build_legacy_analysis_response(zip_code: str, home_price: float, flood_score: float, earthquake_score: float) -> Dict[str, Any]:
    """
    Build frontend-compatible analysis response.

    This keeps the existing Next.js frontend contract while preserving richer
    analytics under `details`.
    """
    combined_hazard = flood_score + earthquake_score
    annualized_loss_percent = min(15.0, (combined_hazard / 200.0) * 5.0)

    years_to_2040 = max(1, 2040 - datetime.now(timezone.utc).year)
    climate_adjusted_value_2040 = home_price * ((1 - (annualized_loss_percent / 100.0)) ** years_to_2040)
    climate_neutral_value_2040 = home_price
    projected_climate_loss_2040 = max(0.0, climate_neutral_value_2040 - climate_adjusted_value_2040)

    information_asymmetry_gap = home_price - climate_adjusted_value_2040
    risk_level = _risk_level_from_scores(flood_score, earthquake_score)
    insurance_death_spiral = combined_hazard >= 140

    if insurance_death_spiral:
        bank_insight = (
            "Banks may flag this property as high-risk because climate-related insurance "
            "cost pressure can materially impact long-term affordability."
        )
    elif combined_hazard >= 90:
        bank_insight = (
            "Risk is elevated; lenders may require tighter insurance and resilience due diligence "
            "before financing."
        )
    else:
        bank_insight = (
            "Risk profile is currently manageable, but buyers should still monitor climate and "
            "insurance trends over time."
        )

    details = get_report(zip_code, home_price)

    return {
        "climate_adjusted_value_2040": round(climate_adjusted_value_2040, 2),
        "climate_neutral_value_2040": round(climate_neutral_value_2040, 2),
        "projected_climate_loss_2040": round(projected_climate_loss_2040, 2),
        "annualized_loss_percent": round(annualized_loss_percent, 4),
        "insurance_death_spiral": insurance_death_spiral,
        "information_asymmetry_gap": round(information_asymmetry_gap, 2),
        "risk_level": risk_level,
        "bank_insight": bank_insight,
        "details": details,
    }


@app.route("/analyze", methods=["POST"])
def analyze() -> Tuple[Any, int]:
    """Analyze a property with backward-compatible request/response contract."""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Request body must be a JSON object"}), 400

        zip_code = data.get("zip_code")
        price = data.get("home_price", data.get("price"))

        if zip_code is None:
            return jsonify({"error": "Missing required field: zip_code"}), 400
        if price is None:
            return jsonify({"error": "Missing required field: home_price"}), 400

        normalized_zip = _normalize_zip(zip_code)
        if len(normalized_zip) != 5 or not normalized_zip.isdigit():
            return jsonify({"error": "zip_code must be a valid 5-digit string"}), 400

        try:
            home_price = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "home_price must be a valid number"}), 400

        if home_price <= 0:
            return jsonify({"error": "home_price must be greater than 0"}), 400

        zip_record = RISK_LOOKUP.get(normalized_zip, {})
        flood_score = _coerce_score(data.get("flood_score_fema"), zip_record.get("FLD_RISK_SCORE", 50.0))
        earthquake_score = _coerce_score(data.get("earthquake_score_usgs"), zip_record.get("EQL_RISK_SCORE", 50.0))

        response_payload = _build_legacy_analysis_response(
            normalized_zip,
            home_price,
            flood_score,
            earthquake_score,
        )
        return jsonify(response_payload), 200

    except Exception as exc:
        return jsonify({"error": "Internal server error", "details": str(exc)}), 500

@app.route("/risk-scores/<zip_code>", methods=["GET"])
def risk_scores(zip_code: str) -> Tuple[Any, int]:
    """Return ZIP-based risk scores for frontend auto-populate on ZIP blur."""
    normalized_zip = _normalize_zip(zip_code)

    if len(normalized_zip) != 5 or not normalized_zip.isdigit():
        return (
            jsonify(
                {
                    "zip_code": normalized_zip,
                    "found": False,
                    "message": "ZIP code must be 5 digits",
                }
            ),
            200,
        )

    record = RISK_LOOKUP.get(normalized_zip)

    if not record:
        return (
            jsonify(
                {
                    "zip_code": normalized_zip,
                    "found": False,
                    "message": "ZIP not found in risk database",
                }
            ),
            200,
        )

    return (
        jsonify(
            {
                "zip_code": normalized_zip,
                "found": True,
                "location": f"ZIP {normalized_zip}",
                "flood_score_fema": round(float(record.get("FLD_RISK_SCORE", 50.0)), 2),
                "earthquake_score_usgs": round(float(record.get("EQL_RISK_SCORE", 50.0)), 2),
            }
        ),
        200,
    )

@app.route("/health", methods=["GET"])
def health() -> Tuple[Any, int]:
    """Simple health endpoint with data-source status."""
    return (
        jsonify(
            {
                "status": "ok",
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                "data_source": DATA_SOURCE_META,
            }
        ),
        200,
    )


@app.errorhandler(404)
def handle_not_found(_error: Exception) -> Tuple[Any, int]:
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def handle_method_not_allowed(_error: Exception) -> Tuple[Any, int]:
    return jsonify({"error": "Method not allowed"}), 405


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

