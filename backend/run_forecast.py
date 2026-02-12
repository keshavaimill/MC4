#!/usr/bin/env python3
"""
Simple script to run forecasting end-to-end
This will:
1. Train models if needed
2. Generate forecasts
3. Update all derived datasets
"""
import os
import sys
import pandas as pd

_backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _backend_dir)

print("=" * 60)
print("MC4 Forecast Runner")
print("=" * 60)

# Step 1: Load data
print("\n📊 Step 1: Loading data...")
from fastapi_server import load_data, data_cache, initialize_forecaster

load_data()
print(f"✅ Data loaded")

# Step 2: Initialize/Train models
print("\n🤖 Step 2: Initializing forecast models...")
forecaster = initialize_forecaster()

if forecaster is None:
    print("❌ Failed to initialize forecaster")
    sys.exit(1)

if len(forecaster.models) == 0:
    print("❌ No models available")
    sys.exit(1)

print(f"✅ Forecaster ready with {len(forecaster.models)} models")

# Step 3: Determine date range
print("\n📅 Step 3: Determining forecast date range...")
fcast = data_cache.get("fact_sku_forecast", pd.DataFrame())
if fcast.empty:
    print("❌ No forecast data available")
    sys.exit(1)

fcast["date"] = pd.to_datetime(fcast["date"])
max_date = fcast["date"].max()
ACTUAL_DATA_END_DATE = pd.Timestamp("2026-02-14")

# Forecast should start after actual data ends
if max_date <= ACTUAL_DATA_END_DATE:
    from_dt = ACTUAL_DATA_END_DATE + pd.Timedelta(days=1)
else:
    from_dt = max_date + pd.Timedelta(days=1)

# Forecast for 1 year ahead
to_dt = from_dt + pd.Timedelta(days=365)

print(f"   Forecast range: {from_dt.date()} to {to_dt.date()} ({(to_dt - from_dt).days} days)")

# Step 4: Generate forecasts
print("\n🔄 Step 4: Generating forecasts...")
from forecast_service import generate_forecasts_and_propagate_datasets
from fastapi_server import _update_derived_datasets, _backend_dir, DATA_DIR

result = generate_forecasts_and_propagate_datasets(
    start_date=from_dt,
    end_date=to_dt,
    forecaster=forecaster,
    data_cache=data_cache,
    backend_dir=_backend_dir,
    data_dir=DATA_DIR,
    update_derived_datasets_func=_update_derived_datasets
)

# Step 5: Report results
print("\n" + "=" * 60)
if result["success"]:
    print("✅ FORECAST GENERATION SUCCESSFUL!")
    print("=" * 60)
    print(f"   Records generated: {result['records']:,}")
    print(f"   SKUs forecasted: {result['sku_count']}")
    print(f"   Date range: {from_dt.date()} to {to_dt.date()}")
    print(f"\n   Updated datasets:")
    print(f"   - fact_sku_forecast.csv")
    print(f"   - fact_bulk_flour_requirement.csv")
    print(f"   - fact_recipe_demand.csv")
    print(f"   - fact_mill_schedule_daily.csv")
    print(f"   - fact_mill_recipe_plan.csv")
    print(f"   - fact_mill_capacity.csv")
    print(f"   - fact_wheat_requirement.csv")
    print(f"   - fact_waste_metrics.csv")
    print(f"   - fact_kpi_snapshot.csv")
else:
    print("❌ FORECAST GENERATION FAILED!")
    print("=" * 60)
    print(f"   Error: {result['message']}")
    sys.exit(1)

print("\n" + "=" * 60)
