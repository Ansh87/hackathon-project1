#!/usr/bin/env python
"""
FloodScore API Test Suite
Tests all endpoints and validates calculations
"""

import requests
import json
import sys

BASE_URL = 'http://localhost:5000'

def print_result(test_name, response):
    """Pretty print test results"""
    print(f"\n{'='*70}")
    print(f"TEST: {test_name}")
    print(f"{'='*70}")
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    print(json.dumps(response.json(), indent=2))


def test_health_check():
    """Test the health check endpoint"""
    response = requests.get(f'{BASE_URL}/health')
    print_result("Health Check", response)
    assert response.status_code == 200
    assert response.json()['status'] == 'healthy'


def test_new_orleans_high_flood_risk():
    """Test New Orleans property with high flood risk"""
    data = {
        'home_price': 300000,
        'zip_code': '70117',
        'flood_score_fema': 85,
        'earthquake_score_usgs': 10
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("New Orleans - High Flood Risk", response)
    assert response.status_code == 200
    result = response.json()
    assert result['risk_level'] == 'Medium'
    assert result['insurance_death_spiral'] == True
    assert 'location' in result


def test_san_francisco_high_earthquake_risk():
    """Test San Francisco property with high earthquake risk"""
    data = {
        'home_price': 1000000,
        'zip_code': '94102',
        'flood_score_fema': 20,
        'earthquake_score_usgs': 75
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("San Francisco - High Earthquake Risk", response)
    assert response.status_code == 200
    result = response.json()
    assert result['risk_level'] == 'Medium'
    assert result['location'] == 'San Francisco, CA'


def test_nyc_low_risk():
    """Test New York property with low risk"""
    data = {
        'home_price': 500000,
        'zip_code': '10001',
        'flood_score_fema': 15,
        'earthquake_score_usgs': 25
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("New York - Low Risk", response)
    assert response.status_code == 200
    result = response.json()
    assert result['risk_level'] == 'Low'


def test_extreme_risk():
    """Test property with extreme combined risk"""
    data = {
        'home_price': 250000,
        'zip_code': '70117',
        'flood_score_fema': 95,
        'earthquake_score_usgs': 75
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("Extreme Risk Property", response)
    assert response.status_code == 200
    result = response.json()
    assert result['risk_level'] == 'Extreme'


def test_invalid_price():
    """Test validation: negative price"""
    data = {
        'home_price': -100000,
        'zip_code': '10001',
        'flood_score_fema': 15,
        'earthquake_score_usgs': 25
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("Validation: Negative Price", response)
    assert response.status_code == 400
    assert 'error' in response.json()


def test_invalid_flood_score():
    """Test validation: flood score out of range"""
    data = {
        'home_price': 400000,
        'zip_code': '10001',
        'flood_score_fema': 150,
        'earthquake_score_usgs': 25
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("Validation: Flood Score Out of Range", response)
    assert response.status_code == 400
    assert 'error' in response.json()


def test_missing_field():
    """Test validation: missing required field"""
    data = {
        'home_price': 400000,
        'flood_score_fema': 30
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("Validation: Missing Field", response)
    assert response.status_code == 400
    assert 'error' in response.json()


def test_unknown_zip_code():
    """Test handling of unknown zip code with default values"""
    data = {
        'home_price': 400000,
        'zip_code': '90210',
        'flood_score_fema': 50,
        'earthquake_score_usgs': 45
    }
    response = requests.post(f'{BASE_URL}/analyze', json=data)
    print_result("Unknown ZIP Code (Default Risk)", response)
    assert response.status_code == 200
    result = response.json()
    assert 'location' not in result  # Should not have location for unknown zip
    assert result['risk_level'] == 'Medium'


def run_all_tests():
    """Run all test cases"""
    tests = [
        test_health_check,
        test_new_orleans_high_flood_risk,
        test_san_francisco_high_earthquake_risk,
        test_nyc_low_risk,
        test_extreme_risk,
        test_invalid_price,
        test_invalid_flood_score,
        test_missing_field,
        test_unknown_zip_code
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
            print("✓ PASSED")
        except AssertionError as e:
            failed += 1
            print(f"✗ FAILED: {str(e)}")
        except Exception as e:
            failed += 1
            print(f"✗ ERROR: {str(e)}")
    
    print(f"\n{'='*70}")
    print(f"TEST SUMMARY: {passed} passed, {failed} failed")
    print(f"{'='*70}\n")
    
    return failed == 0


if __name__ == '__main__':
    try:
        success = run_all_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Test suite error: {str(e)}")
        sys.exit(1)
