(() => {
  const BADGE_ID = "floodscore-badge";
  const STYLE_ID = "floodscore-badge-style";
  const API_URL = "http://localhost:5000/analyze";
  const DEBUG_PREFIX = "[FloodScore]";

  const RISK_STYLES = {
    Low: { dot: "🟢", color: "#22c55e", glow: false },
    Medium: { dot: "🟡", color: "#eab308", glow: false },
    High: { dot: "🔴", color: "#ef4444", glow: true },
    Extreme: { dot: "⚫", color: "#111827", glow: true },
    Unknown: { dot: "⚪", color: "#9ca3af", glow: false }
  };

  let lastAnalyzedKey = null;
  let runToken = 0;

  function log(...args) {
    console.log(DEBUG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(DEBUG_PREFIX, ...args);
  }

  function textFromSelectors(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text) {
        log("textFromSelectors hit", { selector, text: text.slice(0, 120) });
        return text;
      }
    }
    return "";
  }

  function attrFromSelectors(selectors, attrName) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      const val = el?.getAttribute?.(attrName)?.trim();
      if (val) {
        log("attrFromSelectors hit", { selector, attrName, value: val.slice(0, 120) });
        return val;
      }
    }
    return "";
  }

  function toCurrency(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "--";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(n);
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function toPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "--";
    return `${n.toFixed(1)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parsePriceText(raw) {
    if (raw == null) return null;
    const text = String(raw).trim();
    if (!text) return null;

    if (/\b(per month|\/mo|monthly|rent|zestimate|estimate|sold|price history|foreclosure|auction)\b/i.test(text)) {
      return null;
    }

    const dollars = text.match(/\$/g);
    if (dollars && dollars.length > 1) return null;

    const cleaned = text.replace(/,/g, "");
    const match = cleaned.match(/\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
    if (!match) return null;

    const base = Number(match[1]);
    if (!Number.isFinite(base) || base <= 0) return null;

    const unit = (match[2] || "").toLowerCase();
    let value = base;
    if (unit === "k") value = base * 1_000;
    if (unit === "m") value = base * 1_000_000;

    return Math.round(value);
  }

  function extractAddress() {
    const address = textFromSelectors([
      '[data-testid="bdp-building-name"]',
      '[data-testid="address-container"]',
      '[data-testid="bdp-property-address"]',
      "h1",
      '[data-rf-test-id="abp-streetLine"]',
      ".street-address",
      ".ds-address-container"
    ]);

    if (address) return address;

    const metaDescription = attrFromSelectors(
      ['meta[property="og:description"]', 'meta[name="description"]'],
      "content"
    );
    return metaDescription || "Address not found";
  }

  function isReasonableListingPrice(value) {
    return Number.isFinite(value) && value >= 10_000 && value <= 100_000_000;
  }

  function validatePriceCandidate(value, source, raw = "") {
    if (!isReasonableListingPrice(value)) {
      warn("rejecting unreasonable price candidate", { source, raw, value });
      return null;
    }
    return value;
  }

  function logPriceExtracted(value, source) {
    console.log(`${DEBUG_PREFIX} Price extracted: ${toCurrency(value)} from ${source}`);
  }

  function valueAtPath(obj, path) {
    let current = obj;
    for (const key of path) {
      if (!current || typeof current !== "object") return undefined;
      current = current[key];
    }
    return current;
  }

  function priceFromStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const paths = [["offers", "price"], ["mainEntity", "offers", "price"], ["price"], ["offers", "lowPrice"]];

    for (const script of scripts) {
      const raw = script.textContent?.trim();
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.["@graph"])
            ? parsed["@graph"]
            : [parsed];

        for (const node of nodes) {
          for (const path of paths) {
            const candidate = valueAtPath(node, path);
            const parsedValue = parsePriceText(candidate);
            const validated = validatePriceCandidate(parsedValue, "json-ld", String(candidate ?? ""));
            if (validated) {
              logPriceExtracted(validated, "json-ld");
              return validated;
            }
          }
        }
      } catch (err) {
        warn("priceFromStructuredData invalid JSON-LD block", err);
      }
    }

    return null;
  }

  function zipFromStructuredData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      const raw = script.textContent?.trim();
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed) ? parsed : [parsed];

        for (const node of nodes) {
          const possible = [
            node?.address?.postalCode,
            node?.offers?.availableAtOrFrom?.address?.postalCode,
            node?.mainEntity?.address?.postalCode
          ];

          for (const candidate of possible) {
            const match = String(candidate || "").match(/\b\d{5}(?:-\d{4})?\b/);
            if (match) {
              log("zipFromStructuredData hit", { candidate, zip: match[0].slice(0, 5) });
              return match[0].slice(0, 5);
            }
          }
        }
      } catch (err) {
        warn("zipFromStructuredData invalid JSON-LD block", err);
      }
    }

    return "";
  }

  function findDeepValueByKeys(root, keysLowerCase, maxDepth = 8) {
    const stack = [{ value: root, depth: 0 }];

    while (stack.length) {
      const { value, depth } = stack.pop();
      if (!value || depth > maxDepth) continue;

      if (Array.isArray(value)) {
        for (const item of value) stack.push({ value: item, depth: depth + 1 });
        continue;
      }

      if (typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          if (keysLowerCase.includes(String(k).toLowerCase())) {
            return v;
          }
          if (v && typeof v === "object") {
            stack.push({ value: v, depth: depth + 1 });
          }
        }
      }
    }

    return undefined;
  }

  function parseScriptJsonById(scriptId) {
    const script = document.getElementById(scriptId);
    const text = script?.textContent?.trim();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (err) {
      warn(`failed parsing script#${scriptId}`, err);
      return null;
    }
  }

  function zipFromScriptJsonIds() {
    const roots = [parseScriptJsonById("__NEXT_DATA__"), parseScriptJsonById("hdpApolloPreloadedData")].filter(Boolean);

    for (const root of roots) {
      const candidate = findDeepValueByKeys(root, ["zipcode", "postalcode", "zipcode"]);
      const match = String(candidate ?? "").match(/\b\d{5}(?:-\d{4})?\b/);
      if (match) {
        const zip = match[0].slice(0, 5);
        log("zipFromScriptJsonIds hit", { zip, candidate });
        return zip;
      }
    }

    return "";
  }

  function zipFromScriptBodies() {
    const scripts = Array.from(document.querySelectorAll("script"));
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || text.length < 20) continue;

      const match = text.match(/(?:"zipcode"|"postalCode"|"zipCode")\s*[:=]\s*"?(\d{5})(?:-\d{4})?"?/i);
      if (match) {
        log("zipFromScriptBodies hit", { zip: match[1] });
        return match[1];
      }
    }
    return "";
  }

  function getUrlZpid() {
    const match = location.pathname.match(/\/(\d+)_zpid\/?/i);
    return match?.[1] || "";
  }

  function findObjectByZpid(root, zpid, maxDepth = 12) {
    if (!root || !zpid) return null;
    const stack = [{ value: root, depth: 0 }];

    while (stack.length) {
      const { value, depth } = stack.pop();
      if (!value || depth > maxDepth) continue;

      if (Array.isArray(value)) {
        for (const item of value) stack.push({ value: item, depth: depth + 1 });
        continue;
      }

      if (typeof value === "object") {
        const candidateZpid = value.zpid ?? value.ZPID ?? value.propertyId;
        if (String(candidateZpid) === String(zpid)) {
          return value;
        }
        for (const nested of Object.values(value)) {
          if (nested && typeof nested === "object") {
            stack.push({ value: nested, depth: depth + 1 });
          }
        }
      }
    }

    return null;
  }

  function extractPriceFromObject(rootObj, sourceLabel) {
    if (!rootObj || typeof rootObj !== "object") return null;

    const paths = [
      ["hdpData", "homeInfo", "priceForHDP"],
      ["hdpData", "homeInfo", "price"],
      ["homeInfo", "priceForHDP"],
      ["homeInfo", "price"],
      ["priceForHDP"],
      ["unformattedPrice"],
      ["listPrice"],
      ["price"]
    ];

    for (const path of paths) {
      const candidate = valueAtPath(rootObj, path);
      const parsed = parsePriceText(candidate);
      const validated = validatePriceCandidate(parsed, sourceLabel, String(candidate ?? ""));
      if (validated) return validated;
    }

    return null;
  }

  function priceFromScriptJsonIds() {
    const roots = [parseScriptJsonById("__NEXT_DATA__"), parseScriptJsonById("hdpApolloPreloadedData")].filter(Boolean);
    const urlZpid = getUrlZpid();

    for (const root of roots) {
      if (urlZpid) {
        const matchedProperty = findObjectByZpid(root, urlZpid);
        const fromMatchedProperty = extractPriceFromObject(matchedProperty, `script-json-zpid:${urlZpid}`);
        if (fromMatchedProperty) {
          logPriceExtracted(fromMatchedProperty, `script-json-zpid:${urlZpid}`);
          return fromMatchedProperty;
        }
      }

      const directProperty = valueAtPath(root, ["props", "pageProps", "property"]);
      const fromDirectProperty = extractPriceFromObject(directProperty, "script-json-property-root");
      if (fromDirectProperty) {
        logPriceExtracted(fromDirectProperty, "script-json-property-root");
        return fromDirectProperty;
      }
    }

    return null;
  }

  function priceFromMainListingDom() {
    const main = document.querySelector("main") || document;
    const selectors = [
      '[data-testid="price"]',
      '[data-testid="price-wrapper"] [data-testid="price"]',
      '[data-testid="bdp-price"]',
      '[data-rf-test-id="abp-price"]'
    ];

    for (const selector of selectors) {
      const el = main.querySelector(selector);
      if (!el) continue;

      if (el.closest('[data-testid*="card" i], [class*="Card" i], [class*="Nearby" i], aside')) {
        continue;
      }

      const raw = el.textContent?.trim() || "";
      const parsed = parsePriceText(raw);
      const validated = validatePriceCandidate(parsed, `dom:${selector}`, raw);
      if (validated) {
        logPriceExtracted(validated, `dom:${selector}`);
        return validated;
      }
    }

    return null;
  }

  function extractPrice() {
    const structured = priceFromStructuredData();
    if (structured) return structured;

    const scriptJsonPrice = priceFromScriptJsonIds();
    if (scriptJsonPrice) return scriptJsonPrice;

    const metaPrice = attrFromSelectors(['meta[property="product:price:amount"]'], "content");
    const metaValue = validatePriceCandidate(parsePriceText(metaPrice), "meta:product:price:amount", metaPrice);
    if (metaValue) {
      logPriceExtracted(metaValue, "meta:product:price:amount");
      return metaValue;
    }

    const domPrice = priceFromMainListingDom();
    if (domPrice) return domPrice;

    warn("Price extraction failed: no reliable listing price found");
    return null;
  }

  function zipFromPageText() {
    const candidates = [
      textFromSelectors([
        '[data-testid="address-container"]',
        '[data-testid="bdp-property-address"]',
        '[data-rf-test-id="abp-cityStateZip"]',
        ".citystatezip",
        ".dp-subtitle",
        '[aria-label*="breadcrumb"]'
      ]),
      attrFromSelectors(['meta[property="og:title"]', 'meta[property="og:description"]'], "content"),
      document.body?.innerText?.slice(0, 15000) || ""
    ];

    for (const text of candidates) {
      const match = text.match(/\b\d{5}(?:-\d{4})?\b/);
      if (match) {
        log("zipFromPageText hit", { zip: match[0].slice(0, 5) });
        return match[0].slice(0, 5);
      }
    }

    return "";
  }

  function zipFromUrl() {
    const parts = location.pathname.match(/-(\d{5})(?:_zpid)?\/?$/i);
    if (parts?.[1]) {
      log("zipFromUrl hit", { zip: parts[1] });
      return parts[1];
    }
    return "";
  }

  function extractZip(address) {
    const fromAddress = String(address || "").match(/\b\d{5}(?:-\d{4})?\b/);
    if (fromAddress) {
      const zip = fromAddress[0].slice(0, 5);
      log("extractZip from address", { zip, address });
      return zip;
    }

    const fromStructured = zipFromStructuredData();
    if (fromStructured) return fromStructured;

    const fromScriptJson = zipFromScriptJsonIds();
    if (fromScriptJson) return fromScriptJson;

    const fromScript = zipFromScriptBodies();
    if (fromScript) return fromScript;

    const fromPageText = zipFromPageText();
    if (fromPageText) return fromPageText;

    return zipFromUrl();
  }

  function inferRiskLevel(payload) {
    const level = payload?.risk_level || payload?.RISK_LEVEL || payload?.riskLevel;
    if (typeof level === "string") {
      const normalized = level.trim().toLowerCase();
      if (normalized === "low") return "Low";
      if (normalized === "medium") return "Medium";
      if (normalized === "high") return "High";
      if (normalized === "extreme") return "Extreme";
    }

    const detailsScore = Number(payload?.details?.risk_scores?.overall_risk_score);
    const score = Number(payload?.risk_score ?? payload?.RISK_SCORE ?? payload?.riskScore ?? detailsScore);
    if (!Number.isFinite(score)) return "Unknown";
    if (score >= 85) return "Extreme";
    if (score >= 65) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  }

  function extractScores(payload) {
    const details = payload?.details?.risk_scores || {};
    const flood = Number(details.flood_risk_score ?? details.FLD_RISK_SCORE ?? payload?.flood_risk_score ?? payload?.floodScore);
    const earthquake = Number(
      details.earthquake_risk_score ?? details.EQL_RISK_SCORE ?? payload?.earthquake_risk_score ?? payload?.earthquakeScore
    );

    const overall = Number(
      details.combined_climate_risk_score_0_100 ??
        details.overall_risk_score ??
        payload?.risk_score ??
        payload?.RISK_SCORE ??
        payload?.riskScore
    );

    const fallbackOverall = Number.isFinite(flood) && Number.isFinite(earthquake) ? (flood + earthquake) / 2 : NaN;

    return {
      flood: Number.isFinite(flood) ? Math.round(flood) : null,
      earthquake: Number.isFinite(earthquake) ? Math.round(earthquake) : null,
      overall: Number.isFinite(overall) ? Math.round(overall) : Number.isFinite(fallbackOverall) ? Math.round(fallbackOverall) : null
    };
  }

  function scoreTone(score) {
    const safe = Number(score);
    if (!Number.isFinite(safe)) return "unknown";
    if (safe >= 85) return "extreme";
    if (safe >= 65) return "high";
    if (safe >= 40) return "medium";
    return "low";
  }

  function metricToneText(score) {
    const tone = scoreTone(score);
    if (tone === "extreme") return "Extreme";
    if (tone === "high") return "High";
    if (tone === "medium") return "Medium";
    if (tone === "low") return "Low";
    return "Unknown";
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

  function getAnalysisSummary(propertyData, payload, level) {
    const scores = extractScores(payload);

    const adjustedValue =
      toNumber(payload?.climate_adjusted_value_2040) ??
      toNumber(payload?.CLIMATE_ADJUSTED_VALUE_2040) ??
      toNumber(payload?.climateAdjustedValue2040);

    const neutralValue =
      toNumber(payload?.climate_neutral_value_2040) ??
      toNumber(payload?.CLIMATE_NEUTRAL_VALUE_2040) ??
      toNumber(payload?.climateNeutralValue2040);

    const explicitLoss =
      toNumber(payload?.projected_climate_loss_2040) ??
      toNumber(payload?.PROJECTED_CLIMATE_LOSS_2040) ??
      toNumber(payload?.projectedClimateLoss2040);

    const listingPrice = toNumber(propertyData?.price);

    const computedLoss =
      explicitLoss ??
      (Number.isFinite(neutralValue) && Number.isFinite(adjustedValue)
        ? Math.max(0, Math.round(neutralValue - adjustedValue))
        : Number.isFinite(listingPrice) && Number.isFinite(adjustedValue)
          ? Math.max(0, Math.round(listingPrice - adjustedValue))
          : null);

    const priceGap =
      Number.isFinite(listingPrice) && Number.isFinite(adjustedValue)
        ? Math.round(listingPrice - adjustedValue)
        : null;

    const gapPercent = Number.isFinite(priceGap) && Number.isFinite(listingPrice) && listingPrice > 0
      ? (priceGap / listingPrice) * 100
      : null;

    const deathSpiralRaw =
      payload?.insurance_death_spiral ?? payload?.INSURANCE_DEATH_SPIRAL ?? payload?.insuranceDeathSpiral;

    const deathSpiral = deathSpiralRaw === true ? "Flagged" : deathSpiralRaw === false ? "Not flagged" : "Unknown";

    const socioThreat =
      payload?.details?.socio_economic_analysis?.threat_level ??
      payload?.socioeconomic_threat ??
      payload?.SOCIOECONOMIC_THREAT ??
      payload?.socioeconomicThreat ??
      "Unknown";

    return {
      address: propertyData?.address || "Address not detected",
      zip: propertyData?.zip || "N/A",
      listingPrice,
      level,
      scores,
      adjustedValue,
      neutralValue,
      projectedLoss: computedLoss,
      deathSpiral,
      socioThreat,
      priceGap,
      gapPercent,
      projection: buildProjection(listingPrice, adjustedValue, scores.overall)
    };
  }

  function buildExpandedReportHtml(summary) {
    const address = escapeHtml(summary.address);
    const zip = escapeHtml(summary.zip);

    const overallScore = summary.scores.overall ?? "--";
    const floodScore = summary.scores.flood ?? "--";
    const earthquakeScore = summary.scores.earthquake ?? "--";

    const floodBar = Number.isFinite(summary.scores.flood) ? Math.max(6, Math.min(100, summary.scores.flood)) : 0;
    const quakeBar = Number.isFinite(summary.scores.earthquake) ? Math.max(6, Math.min(100, summary.scores.earthquake)) : 0;

    const gapLabel = Number.isFinite(summary.priceGap)
      ? summary.priceGap > 0
        ? `Listed ${toCurrency(summary.priceGap)} above climate-adjusted value`
        : `Listed ${toCurrency(Math.abs(summary.priceGap))} below climate-adjusted value`
      : "Price gap unavailable";

    return `
      <div class="floodscore-report-head">
        <div>
          <div class="floodscore-section-kicker">Inline Full Report</div>
          <div class="floodscore-report-address">${address}</div>
          <div class="floodscore-report-meta">ZIP ${zip} · Current Price ${toCurrency(summary.listingPrice)}</div>
        </div>
        <button type="button" class="floodscore-collapse-btn" id="floodscore-collapse-btn" aria-label="Collapse FloodScore report">Collapse</button>
      </div>

      <div class="floodscore-score-row">
        <div class="floodscore-score-card floodscore-score-${scoreTone(summary.scores.overall)}">
          <div class="floodscore-score-label">FloodScore</div>
          <div class="floodscore-score-value">${overallScore}</div>
          <div class="floodscore-score-level">${escapeHtml(summary.level)}</div>
        </div>
        <div class="floodscore-score-card floodscore-score-${scoreTone(summary.scores.flood)}">
          <div class="floodscore-score-label">Flood</div>
          <div class="floodscore-score-value">${floodScore}</div>
          <div class="floodscore-score-level">${metricToneText(summary.scores.flood)}</div>
        </div>
        <div class="floodscore-score-card floodscore-score-${scoreTone(summary.scores.earthquake)}">
          <div class="floodscore-score-label">Earthquake</div>
          <div class="floodscore-score-value">${earthquakeScore}</div>
          <div class="floodscore-score-level">${metricToneText(summary.scores.earthquake)}</div>
        </div>
      </div>

      <div class="floodscore-grid two-col">
        <div class="floodscore-subpanel">
          <div class="floodscore-subtitle">Risk Breakdown</div>
          <div class="floodscore-risk-line">
            <span>Flood risk</span>
            <strong>${floodScore}</strong>
          </div>
          <div class="floodscore-meter"><span style="width:${floodBar}%;"></span></div>
          <div class="floodscore-risk-line">
            <span>Earthquake risk</span>
            <strong>${earthquakeScore}</strong>
          </div>
          <div class="floodscore-meter"><span style="width:${quakeBar}%;"></span></div>
        </div>

        <div class="floodscore-subpanel">
          <div class="floodscore-subtitle">Bank vs. You</div>
          <div class="floodscore-kv"><span>2040 climate-adjusted</span><strong>${toCurrency(summary.adjustedValue)}</strong></div>
          <div class="floodscore-kv"><span>Listing price today</span><strong>${toCurrency(summary.listingPrice)}</strong></div>
          <div class="floodscore-kv"><span>Gap</span><strong>${toCurrency(summary.priceGap)}</strong></div>
          <div class="floodscore-caption">${escapeHtml(gapLabel)}${Number.isFinite(summary.gapPercent) ? ` (${toPercent(summary.gapPercent)})` : ""}</div>
        </div>
      </div>

      <div class="floodscore-grid two-col">
        <div class="floodscore-subpanel">
          <div class="floodscore-subtitle">2040 Value Outlook</div>
          <div class="floodscore-kv"><span>Climate-neutral 2040</span><strong>${toCurrency(summary.neutralValue)}</strong></div>
          <div class="floodscore-kv"><span>Climate-adjusted 2040</span><strong>${toCurrency(summary.adjustedValue)}</strong></div>
          <div class="floodscore-kv"><span>Projected climate loss</span><strong>${toCurrency(summary.projectedLoss)}</strong></div>
        </div>

        <div class="floodscore-subpanel">
          <div class="floodscore-subtitle">Underwriting Signals</div>
          <div class="floodscore-kv"><span>Insurance death spiral</span><strong>${escapeHtml(summary.deathSpiral)}</strong></div>
          <div class="floodscore-kv"><span>Socio-economic threat</span><strong>${escapeHtml(String(summary.socioThreat))}</strong></div>
        </div>
      </div>

      <div class="floodscore-subpanel">
        <div class="floodscore-subtitle">Scenario Projection (Derived)</div>
        <div class="floodscore-bars">
          <div class="floodscore-bar-wrap">
            <div class="floodscore-bar low" style="height:${Math.max(20, Math.round((summary.projection.low / Math.max(summary.projection.low, summary.projection.medium, summary.projection.high, 1)) * 84))}px"></div>
            <div class="floodscore-bar-label">Low</div>
            <div class="floodscore-bar-value">${toCurrency(summary.projection.low)}</div>
          </div>
          <div class="floodscore-bar-wrap">
            <div class="floodscore-bar medium" style="height:${Math.max(20, Math.round((summary.projection.medium / Math.max(summary.projection.low, summary.projection.medium, summary.projection.high, 1)) * 84))}px"></div>
            <div class="floodscore-bar-label">Medium</div>
            <div class="floodscore-bar-value">${toCurrency(summary.projection.medium)}</div>
          </div>
          <div class="floodscore-bar-wrap">
            <div class="floodscore-bar high" style="height:${Math.max(20, Math.round((summary.projection.high / Math.max(summary.projection.low, summary.projection.medium, summary.projection.high, 1)) * 84))}px"></div>
            <div class="floodscore-bar-label">High</div>
            <div class="floodscore-bar-value">${toCurrency(summary.projection.high)}</div>
          </div>
        </div>
      </div>
    `;
  }

  function removeExistingArtifacts() {
    const existing = document.getElementById(BADGE_ID);
    if (existing) existing.remove();

    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) existingStyle.remove();
  }

  function addStyleTag() {
    const styleTag = document.createElement("style");
    styleTag.id = STYLE_ID;
    styleTag.textContent = `
      @keyframes floodscorePulse {
        0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.36), 0 10px 30px rgba(0, 0, 0, 0.45); }
        70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0), 0 10px 30px rgba(0, 0, 0, 0.45); }
        100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0), 0 10px 30px rgba(0, 0, 0, 0.45); }
      }

      .floodscore-card {
        width: min(364px, calc(100vw - 24px));
        max-height: min(80vh, 760px);
        overflow: hidden auto;
        scrollbar-width: thin;
      }

      .floodscore-main-btn {
        margin-top: 12px;
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 1px solid rgba(96, 165, 250, 0.55);
        border-radius: 9px;
        background: rgba(59, 130, 246, 0.18);
        color: #bfdbfe;
        padding: 9px 10px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .floodscore-main-btn:hover {
        background: rgba(59, 130, 246, 0.34);
        border-color: rgba(147, 197, 253, 0.95);
        color: #eff6ff;
        transform: translateY(-1px);
      }

      .floodscore-main-btn:focus-visible,
      .floodscore-collapse-btn:focus-visible {
        outline: 2px solid rgba(147, 197, 253, 0.95);
        outline-offset: 2px;
      }

      .floodscore-main-btn[disabled] {
        cursor: not-allowed;
        opacity: 0.52;
        transform: none;
      }

      .floodscore-detail-wrap {
        margin-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 10px;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transition: max-height 0.35s ease, opacity 0.25s ease;
      }

      .floodscore-card.is-expanded .floodscore-detail-wrap {
        max-height: 980px;
        opacity: 1;
      }

      .floodscore-report-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
      }

      .floodscore-section-kicker {
        font-size: 10px;
        letter-spacing: 0.3px;
        text-transform: uppercase;
        color: #93c5fd;
      }

      .floodscore-report-address {
        margin-top: 3px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
        color: #f8fafc;
      }

      .floodscore-report-meta {
        margin-top: 4px;
        font-size: 11px;
        color: #9fb0cf;
      }

      .floodscore-collapse-btn {
        border: 1px solid rgba(148, 163, 184, 0.45);
        background: rgba(15, 23, 42, 0.65);
        color: #e2e8f0;
        border-radius: 8px;
        padding: 6px 10px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }

      .floodscore-score-row {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .floodscore-score-card {
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.03);
        padding: 8px;
      }

      .floodscore-score-label {
        font-size: 10px;
        color: #cbd5e1;
        text-transform: uppercase;
      }

      .floodscore-score-value {
        margin-top: 4px;
        font-size: 18px;
        font-weight: 800;
        line-height: 1;
      }

      .floodscore-score-level {
        margin-top: 4px;
        font-size: 11px;
        color: #9fb0cf;
      }

      .floodscore-score-low .floodscore-score-value { color: #4ade80; }
      .floodscore-score-medium .floodscore-score-value { color: #facc15; }
      .floodscore-score-high .floodscore-score-value { color: #fb7185; }
      .floodscore-score-extreme .floodscore-score-value { color: #f87171; }
      .floodscore-score-unknown .floodscore-score-value { color: #cbd5e1; }

      .floodscore-grid {
        margin-top: 10px;
        display: grid;
        gap: 8px;
      }

      .floodscore-grid.two-col {
        grid-template-columns: 1fr;
      }

      @media (min-width: 340px) {
        .floodscore-grid.two-col {
          grid-template-columns: 1fr 1fr;
        }
      }

      .floodscore-subpanel {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        background: rgba(15, 23, 42, 0.45);
        padding: 9px;
      }

      .floodscore-subtitle {
        font-size: 11px;
        color: #bfdbfe;
        font-weight: 700;
        margin-bottom: 8px;
        text-transform: uppercase;
      }

      .floodscore-kv {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        margin-top: 4px;
        color: #dbeafe;
      }

      .floodscore-kv strong {
        color: #f8fafc;
        font-size: 11px;
      }

      .floodscore-caption {
        margin-top: 7px;
        font-size: 10px;
        color: #9fb0cf;
        line-height: 1.35;
      }

      .floodscore-risk-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #e2e8f0;
      }

      .floodscore-meter {
        margin: 4px 0 8px;
        height: 7px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.22);
        overflow: hidden;
      }

      .floodscore-meter span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #38bdf8 0%, #f43f5e 100%);
      }

      .floodscore-bars {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        align-items: end;
      }

      .floodscore-bar-wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .floodscore-bar {
        width: 28px;
        border-radius: 8px 8px 4px 4px;
        min-height: 18px;
        transition: height 0.3s ease;
      }

      .floodscore-bar.low { background: linear-gradient(180deg, #86efac, #22c55e); }
      .floodscore-bar.medium { background: linear-gradient(180deg, #fde68a, #f59e0b); }
      .floodscore-bar.high { background: linear-gradient(180deg, #fca5a5, #ef4444); }

      .floodscore-bar-label {
        margin-top: 6px;
        font-size: 10px;
        color: #cbd5e1;
      }

      .floodscore-bar-value {
        margin-top: 3px;
        font-size: 10px;
        color: #e2e8f0;
      }
    `;
    document.head.appendChild(styleTag);
  }

  function setExpandedState(badge, expanded) {
    const toggle = badge.querySelector("#floodscore-report-toggle");
    if (expanded) {
      badge.classList.add("is-expanded");
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">✖</span><span>Close Report</span>';
    } else {
      badge.classList.remove("is-expanded");
      if (toggle) toggle.innerHTML = '<span aria-hidden="true">📊</span><span>View Full Report</span>';
    }
  }

  function attachReportEvents(badge) {
    const toggle = badge.querySelector("#floodscore-report-toggle");
    const collapse = badge.querySelector("#floodscore-collapse-btn");

    const onToggle = () => {
      const expanded = badge.classList.contains("is-expanded");
      setExpandedState(badge, !expanded);
    };

    if (toggle) {
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        onToggle();
      });
    }

    if (collapse) {
      collapse.addEventListener("click", (event) => {
        event.preventDefault();
        setExpandedState(badge, false);
      });
    }
  }

  function createBadge(level = "Unknown", payload = null, propertyData = null, statusMessage = "") {
    removeExistingArtifacts();

    const style = RISK_STYLES[level] || RISK_STYLES.Unknown;
    const summary = getAnalysisSummary(propertyData, payload, level);
    const zipText = summary.zip || "N/A";
    const priceText = toCurrency(summary.listingPrice);

    const badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.className = "floodscore-card";
    badge.style.cssText = `
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      background: linear-gradient(160deg, #0b1220, #111827);
      color: #f8fafc;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      padding: 12px 14px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      font-family: Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      transition: all 0.25s ease;
    `;

    if (style.glow) {
      badge.style.animation = "floodscorePulse 1.8s infinite";
    }

    const statusHtml = statusMessage
      ? `<div style="margin-top:8px;font-size:11px;color:#fca5a5;line-height:1.4;">${escapeHtml(statusMessage)}</div>`
      : "";

    const canExpand = Boolean(payload && !statusMessage);
    const reportHtml = canExpand
      ? buildExpandedReportHtml(summary)
      : `<div class="floodscore-subpanel"><div class="floodscore-caption">Run analysis on a property with detectable ZIP and listing price to view the inline full report.</div></div>`;

    badge.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:13px;opacity:0.9;letter-spacing:0.2px;">FloodScore</div>
        <div style="font-size:11px;color:${style.color};font-weight:600;">Live</div>
      </div>
      <div style="margin-top:8px;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;">
        <span>${style.dot}</span>
        <span>FloodScore: ${escapeHtml(level)}</span>
      </div>
      <div style="margin-top:8px;font-size:12px;opacity:0.9;display:flex;justify-content:space-between;gap:8px;">
        <span>ZIP: ${escapeHtml(zipText)}</span>
        <span>Price: ${priceText}</span>
      </div>
      ${statusHtml}
      <button id="floodscore-report-toggle" class="floodscore-main-btn" type="button" aria-label="Toggle FloodScore full report" ${canExpand ? "" : "disabled"}>
        <span aria-hidden="true">📊</span>
        <span>${canExpand ? "View Full Report" : "Report Unavailable"}</span>
      </button>
      <section class="floodscore-detail-wrap" aria-live="polite">
        ${reportHtml}
      </section>
    `;

    addStyleTag();
    document.body.appendChild(badge);
    attachReportEvents(badge);
  }

  async function analyzeAndRender(propertyData, token) {
    createBadge("Unknown", null, propertyData, "Analyzing property...");

    const missing = [];
    if (!propertyData.zip) missing.push("ZIP code");
    if (!propertyData.price) missing.push("listing price");

    if (missing.length > 0) {
      const message = `Could not extract ${missing.join(" and ")} from this Zillow sale listing.`;
      warn("missing extraction fields", { propertyData, missing });
      chrome.storage.local.set({
        floodscoreLastResult: null,
        floodscoreSubScores: null,
        floodscoreRiskLevel: "Unknown",
        floodscoreError: message
      });
      createBadge("Unknown", null, propertyData, message);
      return;
    }

    try {
      log("calling analyze API", { zip: propertyData.zip, price: propertyData.price });
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip_code: propertyData.zip, home_price: propertyData.price })
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${body}`.trim());
      }

      const payload = await res.json();
      if (token !== runToken) {
        log("stale analysis response ignored", { token, current: runToken });
        return;
      }

      const level = inferRiskLevel(payload);
      const subScores = extractScores(payload);

      log("analyze API success", {
        level,
        hasAdjustedValue: payload?.climate_adjusted_value_2040 != null,
        subScores,
        payload
      });

      chrome.storage.local.set({
        floodscoreLastResult: payload,
        floodscoreRiskLevel: level,
        floodscoreSubScores: subScores,
        floodscoreError: null
      });

      createBadge(level, payload, propertyData);
    } catch (error) {
      if (token !== runToken) {
        log("stale analysis error ignored", { token, current: runToken, error });
        return;
      }
      warn("analyze failed", error);
      const message = "FloodScore API call failed. Check local API server and try refresh.";
      chrome.storage.local.set({
        floodscoreLastResult: null,
        floodscoreSubScores: null,
        floodscoreRiskLevel: "Unknown",
        floodscoreError: message
      });
      createBadge("Unknown", null, propertyData, message);
    }
  }

  async function clearStateForNewProperty(propertyData) {
    await chrome.storage.local.set({
      floodscoreProperty: propertyData,
      floodscoreLastResult: null,
      floodscoreSubScores: null,
      floodscoreRiskLevel: "Unknown",
      floodscoreError: null
    });
  }

  function buildPropertyData() {
    const address = extractAddress();
    const price = extractPrice();
    const zip = extractZip(address);

    const propertyData = {
      address,
      price,
      zip,
      url: location.href,
      source: location.hostname,
      capturedAt: new Date().toISOString()
    };

    log("extracted property data", propertyData);
    return propertyData;
  }

  function getPropertyKey(propertyData) {
    return `${propertyData.url}::${propertyData.zip || ""}::${propertyData.price || ""}`;
  }

  async function runExtractionAndAnalysis() {
    runToken += 1;
    const token = runToken;

    const propertyData = buildPropertyData();
    const key = getPropertyKey(propertyData);

    if (key === lastAnalyzedKey) {
      log("skipping duplicate property analysis", { key });
      return;
    }

    lastAnalyzedKey = key;
    await clearStateForNewProperty(propertyData);
    await analyzeAndRender(propertyData, token);
  }

  function scheduleRunWithRetries(reason) {
    const maxAttempts = 6;
    let attempt = 0;

    const tick = async () => {
      attempt += 1;
      log(`run attempt ${attempt}/${maxAttempts}`, { reason, url: location.href });

      const propertyData = buildPropertyData();
      const hasBoth = Boolean(propertyData.zip && propertyData.price);
      const key = getPropertyKey(propertyData);

      if (key !== lastAnalyzedKey) {
        await clearStateForNewProperty(propertyData);
      }

      if (hasBoth || attempt >= maxAttempts) {
        lastAnalyzedKey = key;
        runToken += 1;
        await analyzeAndRender(propertyData, runToken);
        return;
      }

      setTimeout(tick, 700);
    };

    tick();
  }

  function watchForPropertySwitch() {
    let lastUrl = location.href;
    let debounceTimer = null;

    const trigger = (reason) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => scheduleRunWithRetries(reason), 300);
    };

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        const prev = lastUrl;
        lastUrl = location.href;
        log("URL changed via mutation", { from: prev, to: lastUrl });
        trigger("url-change-mutation");
      }
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });

    setInterval(() => {
      if (location.href !== lastUrl) {
        const prev = lastUrl;
        lastUrl = location.href;
        log("URL changed via interval", { from: prev, to: lastUrl });
        trigger("url-change-interval");
      }
    }, 800);
  }

  function init() {
    log("content script init", { url: location.href, readyState: document.readyState });
    scheduleRunWithRetries("initial-load");
    watchForPropertySwitch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
