# FloodScore - Financial Transparency Tool for Homebuyers

A production-ready Flask API that provides comprehensive climate risk analysis for residential properties, helping homebuyers and financial institutions understand the long-term financial impact of climate hazards.

## Features

### Climate Risk Analysis
- **15-Year Value Projection**: Calculates projected home value in 2040 accounting for 3% annual appreciation minus annualized climate loss penalties
- **Annualized Loss Calculation**: Derives loss percentages from combined flood and earthquake risk scores
- **Insurance Death Spiral Detection**: Identifies properties where insurance costs exceed 5% of monthly mortgage payments
- **Information Asymmetry Gap**: Quantifies the dollar difference between market price and risk-adjusted value

### Risk Classification
- **Extreme**: Combined risk score > 160
- **High**: Combined risk score 120-160
- **Medium**: Combined risk score 60-120  
- **Low**: Combined risk score < 60

### Insurance Calculations
- Base annual insurance: 0.5% of home value
- Risk multiplier: (flood_score + earthquake_score) / 100
- Final premium: base_insurance × (1 + risk_multiplier × 1.5)

### Mortgage Analysis
- 30-year fixed-rate mortgage at 7% annual interest
- Monthly payment calculation using standard amortization formula
- Bank insight generation based on long-term climate risk exposure

## Installation

```bash
pip install -r requirements.txt
```

## Running the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### POST /analyze

Analyze climate risk for a property.

**Request:**
```json
{
  "home_price": 300000,
  "zip_code": "70117",
  "flood_score_fema": 85,
  "earthquake_score_usgs": 10
}
```

**Response:**
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

**Parameters:**
- `home_price` (float, required): Current home price. Must be > 0
- `zip_code` (string, required): Property ZIP code
- `flood_score_fema` (number, required): FEMA flood risk score (0-100)
- `earthquake_score_usgs` (number, required): USGS earthquake risk score (0-100)

**Response Fields:**
- `climate_adjusted_value_2040` (float): Projected 2040 value after climate adjustments
- `annualized_loss_percent` (float): Annual loss percentage based on risk scores
- `insurance_death_spiral` (boolean): True if insurance costs exceed 5% of monthly payment
- `information_asymmetry_gap` (float): Market price minus risk-adjusted price difference
- `risk_level` (string): Overall risk classification
- `bank_insight` (string): 1-sentence insight about mortgage risk for 30-year terms
- `annual_insurance_premium` (float): Calculated annual insurance cost
- `monthly_mortgage_payment` (float): Monthly payment on 30-year mortgage at 7%
- `location` (string, optional): Location name if ZIP code is in database

### GET /health

Health check endpoint to verify server is running.

**Response:**
```json
{
  "status": "healthy"
}
```

## Input Validation

The API validates all inputs and returns appropriate error messages:

- `home_price`: Must be a positive number
- `zip_code`: Must be a non-empty string
- `flood_score_fema`: Must be a number between 0 and 100
- `earthquake_score_usgs`: Must be a number between 0 and 100

**Error Response Example:**
```json
{
  "error": "flood_score_fema must be between 0 and 100"
}
```

## Mock Risk Database

The system includes data for three major metro areas:

| ZIP Code | Location | Base Flood Risk | Base Earthquake Risk |
|----------|----------|-----------------|----------------------|
| 70117    | New Orleans, LA | 85 | 10 |
| 94102    | San Francisco, CA | 20 | 75 |
| 10001    | New York, NY | 15 | 25 |

Unknown ZIP codes use default values: flood_risk=40, earthquake_risk=30

## Example Usage

### cURL

```bash
# Analyze a property in San Francisco
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "home_price": 1000000,
    "zip_code": "94102",
    "flood_score_fema": 20,
    "earthquake_score_usgs": 75
  }'
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:5000/analyze',
    json={
        'home_price': 300000,
        'zip_code': '70117',
        'flood_score_fema': 85,
        'earthquake_score_usgs': 10
    }
)

result = response.json()
print(f"Risk Level: {result['risk_level']}")
print(f"2040 Value: ${result['climate_adjusted_value_2040']:,.2f}")
print(f"Insurance Death Spiral: {result['insurance_death_spiral']}")
```

## Technical Details

### Calculations

**Climate-Adjusted 2040 Value:**
```
value_2040 = home_price × (1.03^15) × (1 - annualized_loss)^15
```

**Annualized Loss:**
```
annualized_loss = (flood_score + earthquake_score) / 200 × 5%
```

**Monthly Mortgage Payment:**
```
monthly_payment = principal × [r(1+r)^n] / [(1+r)^n - 1]
where r = 0.07/12, n = 360 months
```

**Insurance Death Spiral Threshold:**
```
if annual_insurance > monthly_payment × 0.05: death_spiral = True
```

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: Invalid input parameters
- **404 Not Found**: Unknown endpoint
- **405 Method Not Allowed**: Wrong HTTP method
- **500 Internal Server Error**: Unexpected server error

## CORS Support

CORS is enabled for all origins, allowing the API to be called from web applications.

## Production Deployment

### Prerequisites
- Python 3.8+
- Flask 2.3+
- Flask-CORS 4.0+

### For Production Use
1. Set `debug=False` in `app.run()` call
2. Use a production WSGI server (Gunicorn, uWSGI)
3. Add rate limiting middleware
4. Implement request logging
5. Add database persistence for risk data
6. Use environment variables for configuration

### Example with Gunicorn
```bash
gunicorn --workers 4 --bind 0.0.0.0:5000 app:app
```

## License

FloodScore - Financial Transparency Tool for Homebuyers
