#!/usr/bin/env python3
"""
Test script to validate February 2026 data adjustment
"""
import sys
import os
import pandas as pd

# Add backend directory to path
_backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _backend_dir)

# Load data
from fastapi_server import load_data, data_cache

print("=" * 60)
print("February 2026 Data Validation")
print("=" * 60)

# Load data (this will trigger the adjustment)
load_data()

# Get February 2026 data
fcast = data_cache.get("fact_sku_forecast", pd.DataFrame())
if fcast.empty:
    print("❌ No forecast data available")
    sys.exit(1)

fcast["date"] = pd.to_datetime(fcast["date"])

# Get February 2026 data
feb_mask = (fcast["date"] >= pd.Timestamp('2026-02-01')) & \
           (fcast["date"] <= pd.Timestamp('2026-02-28'))

if not feb_mask.any():
    print("❌ No February 2026 data found")
    sys.exit(1)

feb_data = fcast[feb_mask]

# Calculate totals
monthly_total = feb_data["demand_tons"].sum()
daily_avg = monthly_total / 28.0

# Historical vs Forecasted
historical_mask = feb_data["date"] <= pd.Timestamp('2026-02-14')
forecasted_mask = feb_data["date"] > pd.Timestamp('2026-02-14')

historical_total = feb_data[historical_mask]["demand_tons"].sum() if historical_mask.any() else 0
forecasted_total = feb_data[forecasted_mask]["demand_tons"].sum() if forecasted_mask.any() else 0

# Daily breakdown
daily_totals = feb_data.groupby("date")["demand_tons"].sum().sort_index()

print(f"\n📊 February 2026 Summary:")
print(f"   Monthly Total: {monthly_total:,.2f} tons")
print(f"   Target: 68,000.00 tons")
print(f"   Difference: {abs(monthly_total - 68000):,.2f} tons ({abs(monthly_total - 68000) / 68000 * 100:.2f}%)")
print(f"   Daily Average: {daily_avg:,.2f} tons/day")
print(f"\n   Historical (Feb 1-14): {historical_total:,.2f} tons")
print(f"   Forecasted (Feb 15-28): {forecasted_total:,.2f} tons")
print(f"\n   Daily Totals (first 5 and last 5 days):")
for i, (date, total) in enumerate(daily_totals.items()):
    if i < 5 or i >= len(daily_totals) - 5:
        print(f"      {date.strftime('%Y-%m-%d')}: {total:,.2f} tons")

# Validation
target = 68000.0
diff_pct = abs(monthly_total - target) / target * 100

if diff_pct <= 5.0:
    print(f"\n✅ VALIDATION PASSED: February total is within ±5% of target ({diff_pct:.2f}% difference)")
    sys.exit(0)
else:
    print(f"\n❌ VALIDATION FAILED: February total is {diff_pct:.2f}% off target (should be within ±5%)")
    sys.exit(1)
