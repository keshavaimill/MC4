#!/usr/bin/env python3
"""
Standalone script to run the forecast service
==============================================
This script allows you to generate forecasts directly from the command line.

Usage:
    python run_forecast_service.py [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--days-ahead N]

Examples:
    # Generate forecasts for next 365 days from last available date
    python run_forecast_service.py

    # Generate forecasts for specific date range
    python run_forecast_service.py --start-date 2026-02-11 --end-date 2027-02-10

    # Generate forecasts for next 30 days
    python run_forecast_service.py --days-ahead 30
"""

import os
import sys
import argparse
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Add current directory to path
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import forecast service and models
try:
    from forecast_service import (
        generate_forecasts_and_propagate_datasets,
        generate_future_forecast
    )
    from forecast_models import MC4ForecastModel, train_and_save_models
    FORECAST_AVAILABLE = True
except ImportError as e:
    print(f"❌ Error importing forecast modules: {e}")
    print("   Make sure you're running this from the backend directory")
    sys.exit(1)

# Import data generator for dataset updates
try:
    import data_generator as dg
    DATA_GENERATOR_AVAILABLE = True
except ImportError:
    DATA_GENERATOR_AVAILABLE = False
    print("⚠️ Data generator not available - derived datasets won't be updated")

DATA_DIR = "datasets"
MODEL_DIR = "models"


def load_data_cache():
    """Load all datasets into a cache dictionary"""
    cache = {}
    datasets_dir = os.path.join(_backend_dir, DATA_DIR)
    
    if not os.path.exists(datasets_dir):
        print(f"❌ Datasets directory not found: {datasets_dir}")
        return None
    
    # Load all required datasets
    all_files = {
        # Dimensions
        "dim_sku": "dim_sku.csv",
        "dim_recipe": "dim_recipe.csv",
        "dim_mill": "dim_mill.csv",
        "dim_wheat_type": "dim_wheat_type.csv",
        "dim_country": "dim_country.csv",
        # Mappings
        "map_flour_recipe": "map_flour_recipe.csv",
        "map_recipe_mill": "map_recipe_mill.csv",
        "map_recipe_wheat": "map_recipe_wheat.csv",
        "map_wheat_country": "map_wheat_country.csv",
        # Facts (load existing if available)
        "fact_sku_forecast": "fact_sku_forecast.csv",
        "fact_bulk_flour_requirement": "fact_bulk_flour_requirement.csv",
        "fact_recipe_demand": "fact_recipe_demand.csv",
        "fact_mill_schedule_daily": "fact_mill_schedule_daily.csv",
        "fact_mill_recipe_plan": "fact_mill_recipe_plan.csv",
        "fact_mill_capacity": "fact_mill_capacity.csv",
        "fact_wheat_requirement": "fact_wheat_requirement.csv",
        "fact_waste_metrics": "fact_waste_metrics.csv",
        "fact_kpi_snapshot": "fact_kpi_snapshot.csv",
    }
    
    for key, filename in all_files.items():
        filepath = os.path.join(datasets_dir, filename)
        if os.path.exists(filepath):
            try:
                df = pd.read_csv(filepath)
                # Convert date columns
                if "date" in df.columns:
                    df["date"] = pd.to_datetime(df["date"])
                cache[key] = df
                print(f"✅ Loaded {key}: {len(df)} records")
            except Exception as e:
                print(f"⚠️ Error loading {filename}: {e}")
        else:
            # Create empty DataFrame for missing files (they'll be created during forecast)
            cache[key] = pd.DataFrame()
            if key.startswith("dim_") or key.startswith("map_"):
                print(f"⚠️ File not found: {filename} (required - using empty DataFrame)")
    
    return cache


def initialize_forecaster(data_cache):
    """Initialize and load forecast models"""
    model_dir_path = os.path.join(_backend_dir, MODEL_DIR)
    os.makedirs(model_dir_path, exist_ok=True)
    
    # Check if models exist
    fcast_df = data_cache.get("fact_sku_forecast", pd.DataFrame())
    if fcast_df.empty:
        print("⚠️ No forecast data available for training")
        return None
    
    sku_list = fcast_df["sku_id"].unique()
    existing_models = [f for f in os.listdir(model_dir_path) if f.endswith(".pkl")]
    
    # Train models if they don't exist
    if len(existing_models) < len(sku_list):
        print(f"🔄 Training forecast models for {len(sku_list)} SKUs...")
        fcast_path = os.path.join(_backend_dir, DATA_DIR, "fact_sku_forecast.csv")
        time_dim_path = None  # Time dimension generated inline
        
        if not os.path.exists(fcast_path):
            fcast_df.to_csv(fcast_path, index=False)
        
        try:
            forecaster = train_and_save_models(
                data_path=fcast_path,
                time_dim_path=time_dim_path,
                model_dir=model_dir_path
            )
            print("✅ Forecast models trained successfully")
            return forecaster
        except Exception as e:
            print(f"⚠️ Error training models: {e}")
            return None
    else:
        # Load existing models
        print(f"📦 Loading existing forecast models from {model_dir_path}...")
        forecaster = MC4ForecastModel(model_dir=model_dir_path)
        
        # Load models with proper pickle handling
        import pickle
        import forecast_models
        
        # Custom unpickler to handle __main__ module references
        class CustomUnpickler(pickle.Unpickler):
            def find_class(self, module, name):
                # Map __main__ classes to forecast_models module
                if module == '__main__':
                    if hasattr(forecast_models, name):
                        return getattr(forecast_models, name)
                # Also handle direct forecast_models references
                if module.startswith('forecast_models') or module == 'forecast_models':
                    return getattr(forecast_models, name)
                return super().find_class(module, name)
        
        loaded_count = 0
        failed_skus = []
        for sku_id in sku_list:
            model_path = os.path.join(model_dir_path, f"model_{sku_id}.pkl")
            if os.path.exists(model_path):
                try:
                    with open(model_path, 'rb') as f:
                        try:
                            # Try normal loading first
                            model = pickle.load(f)
                            forecaster.models[sku_id] = model
                            loaded_count += 1
                        except Exception as e:
                            # If normal loading fails, try custom unpickler
                            f.seek(0)
                            try:
                                unpickler = CustomUnpickler(f)
                                model = unpickler.load()
                                forecaster.models[sku_id] = model
                                loaded_count += 1
                            except Exception as e2:
                                # If custom unpickler also fails, re-raise to mark as failed
                                raise e
                except Exception as e:
                    print(f"   ⚠️ Failed to load model for {sku_id}: {str(e)}")
                    failed_skus.append(sku_id)
        
        print(f"✅ Loaded {loaded_count}/{len(sku_list)} forecast models")
        
        # If many models failed to load or none loaded, retrain them
        if len(failed_skus) > len(sku_list) / 2 or loaded_count == 0:
            print(f"🔄 Retraining models due to loading issues ({len(failed_skus)} failed, {loaded_count} loaded)...")
            fcast_path = os.path.join(_backend_dir, DATA_DIR, "fact_sku_forecast.csv")
            if os.path.exists(fcast_path):
                try:
                    forecaster = train_and_save_models(
                        data_path=fcast_path,
                        time_dim_path=None,
                        model_dir=model_dir_path
                    )
                    loaded_count = len(forecaster.models)
                    print(f"✅ Retrained {loaded_count} models successfully")
                except Exception as e:
                    print(f"⚠️ Error retraining models: {e}")
                    import traceback
                    traceback.print_exc()
        
        return forecaster


def _generate_time_dimension_extended(start_date, end_date):
    """Generate time dimension for extended date range"""
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    df = pd.DataFrame({"date": dates})
    df["day_of_week"] = df["date"].dt.dayofweek
    
    # Saudi Arabia weekend: From Jan 2022: Saturday-Sunday (dayofweek 5, 6)
    df["is_weekend"] = np.where(
        df["date"] < pd.Timestamp("2022-01-01"),
        df["day_of_week"].isin([4, 5]),   # Fri, Sat
        df["day_of_week"].isin([5, 6]),   # Sat, Sun
    )
    
    # Ramadan dates
    ramadan_starts = {
        2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
        2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7),
        2028: (1, 27), 2029: (1, 15),
    }
    
    def _is_ramadan(date):
        if date.year in ramadan_starts:
            m, d = ramadan_starts[date.year]
            s = pd.Timestamp(date.year, m, d)
            return s <= date <= s + pd.Timedelta(days=29)
        return False
    
    hajj_months = {
        2020: 7, 2021: 7, 2022: 7, 2023: 6,
        2024: 6, 2025: 6, 2026: 5, 2027: 5,
        2028: 5, 2029: 4,
    }
    
    def _is_hajj(date):
        return date.year in hajj_months and date.month == hajj_months[date.year]
    
    df["is_ramadan"] = df["date"].apply(_is_ramadan)
    df["is_hajj"] = df["date"].apply(_is_hajj)
    return df


def _append_to_dataset(dataset_name, new_data, start_date, data_cache, backend_dir, data_dir):
    """Append new data to a dataset CSV file, removing any overlapping dates."""
    if new_data.empty:
        return
    
    dataset_path = os.path.join(backend_dir, data_dir, f"{dataset_name}.csv")
    
    # Load existing data
    if os.path.exists(dataset_path):
        existing_df = pd.read_csv(dataset_path)
        if "date" in existing_df.columns or "period" in existing_df.columns:
            date_col = "date" if "date" in existing_df.columns else "period"
            existing_df[date_col] = pd.to_datetime(existing_df[date_col], errors='coerce')
            # Remove overlapping dates
            if "date" in new_data.columns:
                new_data["date"] = pd.to_datetime(new_data["date"])
                min_new_date = new_data["date"].min()
                existing_df = existing_df[existing_df[date_col] < min_new_date]
            elif "period" in new_data.columns:
                new_periods = set(new_data["period"].unique())
                existing_df = existing_df[~existing_df[date_col].isin(new_periods)]
        else:
            existing_df = pd.DataFrame()
    else:
        existing_df = pd.DataFrame()
    
    # Combine and save
    if not existing_df.empty:
        combined_df = pd.concat([existing_df, new_data], ignore_index=True)
    else:
        combined_df = new_data.copy()
    
    combined_df.to_csv(dataset_path, index=False)
    
    # Update cache
    data_cache[dataset_name] = combined_df.copy()


def update_derived_datasets(min_date, max_date, data_cache, backend_dir, data_dir):
    """Update derived datasets using data_generator functions"""
    if not DATA_GENERATOR_AVAILABLE:
        print("⚠️ Data generator not available - skipping derived dataset updates")
        return
    
    try:
        print(f"🔄 Updating derived datasets for date range {min_date.date()} to {max_date.date()}...")
        
        # Get required dimension tables
        dim_sku = data_cache.get("dim_sku", pd.DataFrame())
        dim_recipe = data_cache.get("dim_recipe", pd.DataFrame())
        dim_mill = data_cache.get("dim_mill", pd.DataFrame())
        dim_wheat_type = data_cache.get("dim_wheat_type", pd.DataFrame())
        dim_country = data_cache.get("dim_country", pd.DataFrame())
        map_flour_recipe = data_cache.get("map_flour_recipe", pd.DataFrame())
        map_recipe_mill = data_cache.get("map_recipe_mill", pd.DataFrame())
        map_recipe_wheat = data_cache.get("map_recipe_wheat", pd.DataFrame())
        map_wheat_country = data_cache.get("map_wheat_country", pd.DataFrame())
        
        # Get forecast data for the date range
        fcast = data_cache.get("fact_sku_forecast", pd.DataFrame())
        if fcast.empty:
            print("⚠️ No forecast data available")
            return
        
        fcast["date"] = pd.to_datetime(fcast["date"])
        fcast_range = fcast[(fcast["date"] >= min_date) & (fcast["date"] <= max_date)].copy()
        
        if fcast_range.empty:
            print("⚠️ No forecast data in specified range")
            return
        
        # Generate time dimension for the range
        time_dim_range = _generate_time_dimension_extended(min_date, max_date)
        
        # Compute intermediate results
        bulk_flour = None
        recipe_mix = None
        recipe_demand = None
        mill_capacity = None
        schedule = None
        
        # 1. Bulk flour requirement
        if not dim_sku.empty:
            bulk_flour = dg.derive_fact_bulk_flour_requirement(fcast_range, dim_sku)
            _append_to_dataset("fact_bulk_flour_requirement", bulk_flour, min_date, data_cache, backend_dir, data_dir)
        
        # 2. Recipe mix (computed inline, not saved)
        if not map_flour_recipe.empty:
            recipe_mix = dg.compute_dynamic_recipe_mix(time_dim_range, map_flour_recipe)
        
        # 3. Recipe demand
        if bulk_flour is not None and recipe_mix is not None and not dim_recipe.empty:
            recipe_demand = dg.derive_fact_recipe_demand(bulk_flour, recipe_mix, dim_recipe)
            _append_to_dataset("fact_recipe_demand", recipe_demand, min_date, data_cache, backend_dir, data_dir)
        
        # 4. Mill capacity
        if not dim_mill.empty:
            mill_capacity = dg.generate_fact_mill_capacity(time_dim_range, dim_mill)
            _append_to_dataset("fact_mill_capacity", mill_capacity, min_date, data_cache, backend_dir, data_dir)
        
        # 5. Mill schedule
        if recipe_demand is not None and mill_capacity is not None and not map_recipe_mill.empty and not dim_recipe.empty:
            schedule = dg.generate_fact_mill_schedule_daily(recipe_demand, mill_capacity, map_recipe_mill, dim_recipe)
            _append_to_dataset("fact_mill_schedule_daily", schedule, min_date, data_cache, backend_dir, data_dir)
        
        # 6. Mill recipe plan
        if schedule is not None and not schedule.empty and mill_capacity is not None and not mill_capacity.empty:
            plan = dg.derive_fact_mill_recipe_plan(schedule, mill_capacity)
            if not plan.empty:
                _append_to_dataset("fact_mill_recipe_plan", plan, min_date, data_cache, backend_dir, data_dir)
        
        # 7. Wheat requirement
        if recipe_demand is not None and not recipe_demand.empty and len(map_recipe_wheat) > 0 and len(dim_wheat_type) > 0:
            wheat_req = dg.derive_fact_wheat_requirement(recipe_demand, map_recipe_wheat, dim_wheat_type)
            if not wheat_req.empty:
                _append_to_dataset("fact_wheat_requirement", wheat_req, min_date, data_cache, backend_dir, data_dir)
        
        # 8. Waste metrics
        if schedule is not None and not schedule.empty and len(dim_recipe) > 0 and len(dim_mill) > 0:
            waste = dg.generate_fact_waste_metrics(schedule, dim_recipe, dim_mill)
            if not waste.empty:
                _append_to_dataset("fact_waste_metrics", waste, min_date, data_cache, backend_dir, data_dir)
        
        # 9. Raw material prices (computed inline, not saved)
        raw_prices = dg.generate_raw_material_prices(time_dim_range)
        
        # 10. KPI snapshot - reload full datasets after updates
        # Reload datasets from files to get updated data
        for key in ["fact_sku_forecast", "fact_bulk_flour_requirement", "fact_recipe_demand", 
                    "fact_mill_schedule_daily", "fact_mill_capacity", "fact_wheat_requirement", 
                    "fact_waste_metrics"]:
            filepath = os.path.join(backend_dir, data_dir, f"{key}.csv")
            if os.path.exists(filepath):
                try:
                    df = pd.read_csv(filepath)
                    if "date" in df.columns:
                        df["date"] = pd.to_datetime(df["date"], errors='coerce')
                    elif "period" in df.columns:
                        df["period"] = pd.to_datetime(df["period"], errors='coerce')
                    data_cache[key] = df
                except Exception as e:
                    print(f"   ⚠️ Error reloading {key}: {e}")
        
        fcast_full = data_cache.get("fact_sku_forecast", pd.DataFrame())
        bulk_flour_full = data_cache.get("fact_bulk_flour_requirement", pd.DataFrame())
        recipe_demand_full = data_cache.get("fact_recipe_demand", pd.DataFrame())
        schedule_full = data_cache.get("fact_mill_schedule_daily", pd.DataFrame())
        mill_capacity_full = data_cache.get("fact_mill_capacity", pd.DataFrame())
        wheat_req_full = data_cache.get("fact_wheat_requirement", pd.DataFrame())
        waste_full = data_cache.get("fact_waste_metrics", pd.DataFrame())
        
        if (len(fcast_full) > 0 and len(bulk_flour_full) > 0 and len(recipe_demand_full) > 0 and 
            len(schedule_full) > 0 and len(mill_capacity_full) > 0 and len(wheat_req_full) > 0 and 
            len(waste_full) > 0 and len(dim_mill) > 0 and len(dim_country) > 0 and 
            len(map_wheat_country) > 0):
            kpi = dg.generate_fact_kpi_snapshot(
                fcast_full, bulk_flour_full, recipe_demand_full,
                schedule_full, mill_capacity_full, wheat_req_full,
                waste_full, dim_mill, dim_country, map_wheat_country,
                raw_prices
            )
            # Filter to new periods only
            new_periods = pd.date_range(min_date, max_date, freq="M").to_period("M").astype(str)
            if not kpi.empty and "period" in kpi.columns:
                kpi_new = kpi[kpi["period"].isin(new_periods)]
                if not kpi_new.empty:
                    _append_to_dataset("fact_kpi_snapshot", kpi_new, min_date, data_cache, backend_dir, data_dir)
        
        print("✅ Derived datasets updated")
    except Exception as e:
        print(f"⚠️ Error updating derived datasets: {e}")
        import traceback
        traceback.print_exc()


def main():
    """
    Clean workflow:
    1. Historical Data Generated (load_data_cache)
    2. Forecast models are trained (initialize_forecaster)
    3. The Forecasted Data is appended (generate_forecasts_and_propagate_datasets)
    4. Other Derived datasets are built (update_derived_datasets)
    5. Chatbot db is setup once all datasets are ready (separate process)
    6. fastapi_server will run to flow data from backend (separate process)
    """
    parser = argparse.ArgumentParser(
        description="Generate forecasts using the forecast service",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date for forecast (YYYY-MM-DD). Default: day after last available forecast"
    )
    parser.add_argument(
        "--end-date",
        type=str,
        help="End date for forecast (YYYY-MM-DD). Default: start_date + days_ahead"
    )
    parser.add_argument(
        "--days-ahead",
        type=int,
        default=365,
        help="Number of days to forecast ahead (default: 365). Ignored if --end-date is provided"
    )
    parser.add_argument(
        "--skip-derived",
        action="store_true",
        help="Skip updating derived datasets"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("MC4 Forecast Service - Standalone Runner")
    print("=" * 60)
    
    # Step 1: Historical Data Generated
    print("\n📊 Step 1: Loading historical datasets...")
    data_cache = load_data_cache()
    if data_cache is None:
        print("❌ Failed to load data cache")
        sys.exit(1)
    
    # Step 2: Forecast models are trained
    print("\n🤖 Step 2: Initializing forecast models (XGBoost or Simple Model)...")
    forecaster = initialize_forecaster(data_cache)
    if forecaster is None:
        print("⚠️ Forecaster not available - will use fallback simple forecast")
    
    # Determine date range
    fcast = data_cache.get("fact_sku_forecast", pd.DataFrame())
    
    if args.start_date:
        from_dt = pd.to_datetime(args.start_date)
    else:
        if fcast.empty or "date" not in fcast.columns:
            from_dt = pd.Timestamp("2026-02-11")  # Default start
        else:
            max_date = pd.to_datetime(fcast["date"]).max()
            from_dt = max_date + pd.Timedelta(days=1)
    
    if args.end_date:
        to_dt = pd.to_datetime(args.end_date)
    else:
        to_dt = from_dt + pd.Timedelta(days=args.days_ahead)
    
    print(f"\n📈 Generating forecasts from {from_dt.date()} to {to_dt.date()}")
    print(f"   ({(to_dt - from_dt).days} days)")
    
    # Step 3: The Forecasted Data is appended
    print("\n🔄 Step 3: Generating and appending forecasted data...")
    
    # Step 4: Other Derived datasets are built
    def update_func(min_date, max_date):
        update_derived_datasets(min_date, max_date, data_cache, _backend_dir, DATA_DIR)
    
    result = generate_forecasts_and_propagate_datasets(
        start_date=from_dt,
        end_date=to_dt,
        forecaster=forecaster,
        data_cache=data_cache,
        backend_dir=_backend_dir,
        data_dir=DATA_DIR,
        update_derived_datasets_func=None if args.skip_derived else update_func
    )
    
    if result["success"]:
        print("\n" + "=" * 60)
        print("✅ Forecast generation completed successfully!")
        print("=" * 60)
        print(f"   Records generated: {result['records']}")
        print(f"   SKUs forecasted: {result['sku_count']}")
        print(f"   Date range: {from_dt.date()} to {to_dt.date()}")
        print(f"\n   Forecasts saved to: {os.path.join(_backend_dir, DATA_DIR, 'fact_sku_forecast.csv')}")
    else:
        print("\n" + "=" * 60)
        print("❌ Forecast generation failed!")
        print("=" * 60)
        print(f"   Error: {result['message']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
