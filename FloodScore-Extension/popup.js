(() => {
  const API_URL = "http://localhost:5000/analyze";

  const $ = (id) => document.getElementById(id);

  function toCurrency(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "--";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  }

  function pick(obj, keys, fallback = "--") {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }
    return fallback;
  }

  function toRiskLevel(payload, score) {
    const raw = pick(payload, ["risk_level", "RISK_LEVEL", "riskLevel"], "");
    if (typeof raw === "string" && raw) {
      const normalized = raw.toLowerCase();
      if (["low", "medium", "high", "extreme"].includes(normalized)) {
        return normalized[0].toUpperCase() + normalized.slice(1);
      }
    }

    if (!Number.isFinite(score)) return "Unknown";
    if (score >= 85) return "Extreme";
    if (score >= 65) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  }

  function showError(message) {
    const box = $("errorBox");
    box.textContent = message;
    box.style.display = "block";
  }

  function hideError() {
    const box = $("errorBox");
    box.style.display = "none";
  }

  function setGauge(score, riskLevel) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    $("riskScore").textContent = String(Math.round(safeScore));
    $("riskLevel").textContent = riskLevel;

    const needle = $("needle");
    const angle = -180 + safeScore * 1.8;

    requestAnimationFrame(() => {
      needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    });
  }

  function setSubScores(floodScore, earthquakeScore) {
    $("floodScore").textContent = Number.isFinite(floodScore) ? String(Math.round(floodScore)) : "--";
    $("earthquakeScore").textContent = Number.isFinite(earthquakeScore)
      ? String(Math.round(earthquakeScore))
      : "--";
  }

  function setProjectionBars(lowValue, mediumValue, highValue) {
    const values = [lowValue, mediumValue, highValue].map((v) => Number(v) || 0);
    const max = Math.max(...values, 1);

    const bars = [
      { id: "barLow", valueId: "barLowValue", value: values[0] },
      { id: "barMedium", valueId: "barMediumValue", value: values[1] },
      { id: "barHigh", valueId: "barHighValue", value: values[2] }
    ];

    bars.forEach(({ id, valueId, value }) => {
      const normalized = Math.max(18, Math.round((value / max) * 120));
      const el = $(id);
      el.style.height = `${normalized}px`;
      $(valueId).textContent = toCurrency(value);
    });
  }

  async function getStoredProperty() {
    const result = await chrome.storage.local.get([
      "floodscoreProperty",
      "floodscoreLastResult",
      "floodscoreError"
    ]);
    return {
      property: result.floodscoreProperty || null,
      cachedResult: result.floodscoreLastResult || null,
      extractionError: result.floodscoreError || ""
    };
  }

  async function fetchAnalysis(zip, price) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip_code: zip, home_price: price })
    });

    if (!res.ok) {
      throw new Error(`API request failed (${res.status})`);
    }

    return res.json();
  }

  function buildProjection(listingPrice, adjustedValue, score) {
    const lp = Number(listingPrice) || 0;
    const adj = Number(adjustedValue) || lp;
    const risk = Number(score) || 0;

    const low = adj > 0 ? Math.round(adj * 0.97) : Math.round(lp * 0.95);
    const medium = adj > 0 ? Math.round(adj * (0.88 - risk / 1000)) : Math.round(lp * 0.8);
    const high = adj > 0 ? Math.round(adj * (0.72 - risk / 700)) : Math.round(lp * 0.62);

    return {
      low: Math.max(low, 0),
      medium: Math.max(medium, 0),
      high: Math.max(high, 0)
    };
  }

  function extractScores(data) {
    const details = data?.details?.risk_scores || {};
    const floodScore = Number(
      pick(details, ["flood_risk_score", "FLD_RISK_SCORE"], pick(data, ["flood_score_fema"], NaN))
    );
    const earthquakeScore = Number(
      pick(details, ["earthquake_risk_score", "EQL_RISK_SCORE"], pick(data, ["earthquake_score_usgs"], NaN))
    );

    const overallScore = Number(
      pick(details, ["combined_climate_risk_score_0_100", "overall_risk_score"], pick(data, ["risk_score"], NaN))
    );

    return {
      floodScore: Number.isFinite(floodScore) ? floodScore : NaN,
      earthquakeScore: Number.isFinite(earthquakeScore) ? earthquakeScore : NaN,
      overallScore: Number.isFinite(overallScore) ? overallScore : NaN
    };
  }

  async function init() {
    try {
      const { property, cachedResult, extractionError } = await getStoredProperty();

      const address = property?.address || "No listing detected yet";
      const listingPrice = property?.price;
      const zip = property?.zip;

      $("propertyAddress").textContent = address;
      $("listingPrice").textContent = toCurrency(listingPrice);

      if (!zip || !listingPrice) {
        showError(
          extractionError ||
            "Could not detect ZIP/price from this listing. Open a Zillow sale property detail page and try again."
        );
        return;
      }

      let data = cachedResult;
      try {
        data = await fetchAnalysis(zip, listingPrice);
        chrome.storage.local.set({ floodscoreLastResult: data });
      } catch (err) {
        if (!data) {
          throw err;
        }
      }

      hideError();

      const { floodScore, earthquakeScore, overallScore } = extractScores(data);

      const fallbackOverall = Number.isFinite(floodScore) && Number.isFinite(earthquakeScore)
        ? (floodScore + earthquakeScore) / 2
        : 0;

      const riskScore = Number.isFinite(overallScore) ? overallScore : fallbackOverall;
      const riskLevel = toRiskLevel(data, riskScore);
      const adjustedValue = pick(data, ["climate_adjusted_value_2040", "CLIMATE_ADJUSTED_VALUE_2040", "climateAdjustedValue2040"], null);
      const deathSpiralBool = pick(data, ["insurance_death_spiral", "INSURANCE_DEATH_SPIRAL", "insuranceDeathSpiral"], false);
      const deathSpiral = deathSpiralBool ? "Flagged" : "Not flagged";
      const socioThreat = pick(
        data?.details?.socio_economic_analysis,
        ["threat_level"],
        pick(data, ["socioeconomic_threat", "SOCIOECONOMIC_THREAT", "socioeconomicThreat"], "Unknown")
      );

      setGauge(riskScore, riskLevel);
      setSubScores(floodScore, earthquakeScore);
      $("adjustedValue").innerHTML = `<strong>${toCurrency(adjustedValue)}</strong>`;
      $("deathSpiral").innerHTML = `<strong>${deathSpiral}</strong>`;
      $("socioThreat").innerHTML = `<strong>${socioThreat}</strong>`;

      const projection = buildProjection(listingPrice, adjustedValue, riskScore);
      setProjectionBars(projection.low, projection.medium, projection.high);
    } catch (error) {
      console.error("FloodScore popup error:", error);
      showError("FloodScore API is offline. Make sure your local server is running.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
