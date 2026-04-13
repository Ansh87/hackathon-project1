# FloodScore API - Quick Start Guide

## Installation & Setup (One-Time)

```bash
# Install dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

The server will start on `http://localhost:5000`

## Running Tests

```bash
# Run the complete test suite (9 tests)
python test_api.py
```

## Quick Example Requests

### 1. Analyze a High-Risk Property (New Orleans)

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 300000,
    "zip_code": "70117",
    "flood_score_fema": 85,
    "earthquake_score_usgs": 10
  }'
```

**Key Insight**: This property has a **2.38% annual loss rate** due to flood risk, resulting in a **$25,908 information asymmetry gap** between market and risk-adjusted pricing.

### 2. Analyze San Francisco Earthquake Risk

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 1000000,
    "zip_code": "94102",
    "flood_score_fema": 20,
    "earthquake_score_usgs": 75
  }'
```

**Key Insight**: Annual insurance premium of **$12,125** triggers an **insurance death spiral**, as it exceeds 5% of monthly mortgage payments.

### 3. Analyze Low-Risk Property (New York City)

```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 500000,
    "zip_code": "10001",
    "flood_score_fema": 15,
    "earthquake_score_usgs": 25
  }'
```

**Key Insight**: Low combined risk (40) classifies as **Low Risk**, but insurance still triggers death spiral due to the baseline 0.5% insurance rate.

## Understanding the Output

Each analysis returns:

| Field | Meaning |
|-------|---------|
| `risk_level` | Overall risk classification (Low/Medium/High/Extreme) |
| `climate_adjusted_value_2040` | Projected home value in 2040 with climate penalties |
| `information_asymmetry_gap` | Price difference: Market vs Risk-Adjusted Value |
| `insurance_death_spiral` | True if insurance costs exceed 5% of monthly payment |
| `annualized_loss_percent` | Annual loss rate from climate risks |
| `annual_insurance_premium` | Yearly insurance cost (0.5% base × risk multiplier) |
| `monthly_mortgage_payment` | Payment on 30-year mortgage at 7% fixed rate |
| `bank_insight` | 1-sentence summary of 30-year mortgage risk |

## API Response Examples

### Successful Response (200 OK)
```json
{
  "climate_adjusted_value_2040": 325908.23,
  "annualized_loss_percent": 2.38,
  "insurance_death_spiral": true,
  "information_asymmetry_gap": -25908.23,
  "risk_level": "Medium",
  "bank_insight": "Banks view this 30-year mortgage as high-risk due to escalating climate insurance costs exceeding acceptable debt-service thresholds.",
  "annual_insurance_premium": 3637.5,
  "monthly_mortgage_payment": 1995.91,
  "location": "New Orleans, LA"
}
```

### Error Response (400 Bad Request)
```json
{
  "error": "flood_score_fema must be between 0 and 100"
}
```

## Key Calculations Explained

### 1. Climate-Adjusted 2040 Value
```
Projected Value = Current Price × (1.03^15) × (1 - Annual Loss)^15

Example: $300K home with 2.38% annual loss
= 300,000 × 1.558 × 0.714
= $325,908.23
```

### 2. Annualized Loss Percentage
```
Loss % = (Flood Score + Earthquake Score) / 200 × 5%

Example: Flood 85 + Earthquake 10
= (95 / 200) × 5% = 2.38%
```

### 3. Insurance Death Spiral Detection
```
Death Spiral = True if: Annual Insurance > (Monthly Payment × 0.05)

Example: $3,637.50 > ($1,995.91 × 0.05 = $99.80)
= TRUE - Insurance exceeds 5% threshold
```

## Testing Scenarios

### Scenario 1: Extreme Risk Property
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 250000,
    "zip_code": "70117",
    "flood_score_fema": 95,
    "earthquake_score_usgs": 75
  }'
```
**Expected**: risk_level = "Extreme" (combined score 170)

### Scenario 2: Unknown Zip Code
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 400000,
    "zip_code": "90210",
    "flood_score_fema": 50,
    "earthquake_score_usgs": 45
  }'
```
**Expected**: Uses default risk values, no location field

### Scenario 3: Input Validation
```bash
# This will fail - price must be positive
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": -100000,
    "zip_code": "10001",
    "flood_score_fema": 15,
    "earthquake_score_usgs": 25
  }'
```
**Expected**: 400 error with message about positive price

## Endpoints Available

- **POST /analyze** - Main endpoint for climate risk analysis
- **GET /health** - Health check (returns `{"status": "healthy"}`)

## Database Locations Included

| ZIP | Location | Flood Risk | Earthquake Risk |
|-----|----------|-----------|-----------------|
| 70117 | New Orleans, LA | 85 | 10 |
| 94102 | San Francisco, CA | 20 | 75 |
| 10001 | New York, NY | 15 | 25 |

Unknown zips use defaults: Flood=40, Earthquake=30

## Production Deployment

To deploy with Gunicorn (recommended for production):

```bash
# Install Gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn --workers 4 --bind 0.0.0.0:5000 app:app
```

## Troubleshooting

**Server won't start**: Check if port 5000 is already in use
```bash
lsof -i :5000
kill -9 <PID>
```

**Connection refused**: Ensure Flask server is running
```bash
python app.py &
```

**Test failures**: Verify server is accessible
```bash
curl http://localhost:5000/health
```

## Next Steps

1. ✅ Start the server: `python app.py`
2. ✅ Run tests: `python test_api.py`
3. ✅ Read full docs: See `README.md`
4. ✅ Try the examples above
5. ✅ Integrate with your application

For detailed API documentation, see `README.md`.
