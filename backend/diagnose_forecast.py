#!/usr/bin/env python3
"""
Diagnostic script to check forecast model status
"""
import os
import sys
import pickle
import pandas as pd

_backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _backend_dir)

print("=" * 60)
print("Forecast Model Diagnostic")
print("=" * 60)

# Check 1: Models directory
model_dir = os.path.join(_backend_dir, "models")
print(f"\n1. Checking models directory: {model_dir}")
if os.path.exists(model_dir):
    model_files = [f for f in os.listdir(model_dir) if f.endswith(".pkl")]
    print(f"   ✅ Found {len(model_files)} model files")
    for f in model_files[:5]:  # Show first 5
        print(f"      - {f}")
    if len(model_files) > 5:
        print(f"      ... and {len(model_files) - 5} more")
else:
    print(f"   ❌ Models directory does not exist")

# Check 2: Try loading models
print(f"\n2. Testing model loading...")
try:
    from forecast_models import MC4ForecastModel
    forecaster = MC4ForecastModel(model_dir=model_dir)
    
    if os.path.exists(model_dir):
        model_files = [f for f in os.listdir(model_dir) if f.endswith(".pkl")]
        loaded_count = 0
        failed_count = 0
        
        # Custom unpickler to handle __main__ module references
        import forecast_models
        
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
        
        for model_file in model_files:
            sku_id = model_file.replace("model_", "").replace(".pkl", "")
            model_path = os.path.join(model_dir, model_file)
            try:
                with open(model_path, 'rb') as f:
                    try:
                        # Try normal loading first
                        model = pickle.load(f)
                        forecaster.models[sku_id] = model
                        loaded_count += 1
                        print(f"   ✅ Loaded {sku_id}: {type(model).__name__}")
                    except Exception as e:
                        # If that fails, use custom unpickler
                        f.seek(0)
                        unpickler = CustomUnpickler(f)
                        model = unpickler.load()
                        forecaster.models[sku_id] = model
                        loaded_count += 1
                        print(f"   ✅ Loaded {sku_id}: {type(model).__name__} (via custom unpickler)")
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Failed to load {sku_id}: {str(e)[:50]}")
        
        print(f"\n   Summary: {loaded_count} loaded, {failed_count} failed")
        print(f"   Total models in forecaster: {len(forecaster.models)}")
        
        if len(forecaster.models) > 0:
            print(f"\n   ✅ Forecaster has {len(forecaster.models)} models ready")
        else:
            print(f"\n   ❌ Forecaster has no models!")
            
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Check 3: Check forecast data
print(f"\n3. Checking forecast data...")
data_path = os.path.join(_backend_dir, "datasets", "fact_sku_forecast.csv")
if os.path.exists(data_path):
    try:
        df = pd.read_csv(data_path)
        print(f"   ✅ Found {len(df)} records")
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
            min_date = df["date"].min()
            max_date = df["date"].max()
            print(f"   Date range: {min_date.date()} to {max_date.date()}")
            
            # Check actual vs forecast split
            ACTUAL_END = pd.Timestamp("2026-02-14")
            actual_count = len(df[df["date"] <= ACTUAL_END])
            forecast_count = len(df[df["date"] > ACTUAL_END])
            print(f"   Actual data (≤2026-02-14): {actual_count} records")
            print(f"   Forecast data (>2026-02-14): {forecast_count} records")
            
            sku_count = df["sku_id"].nunique()
            print(f"   Unique SKUs: {sku_count}")
        else:
            print(f"   ⚠️ No 'date' column found")
    except Exception as e:
        print(f"   ❌ Error reading data: {e}")
else:
    print(f"   ❌ Forecast data file not found: {data_path}")

# Check 4: Test forecast generation
print(f"\n4. Testing forecast generation...")
try:
    from forecast_service import generate_future_forecast
    from forecast_models import MC4ForecastModel
    
    # Load SKU dimension
    dim_sku_path = os.path.join(_backend_dir, "datasets", "dim_sku.csv")
    if os.path.exists(dim_sku_path):
        dim_sku = pd.read_csv(dim_sku_path)
        print(f"   ✅ Loaded {len(dim_sku)} SKUs")
        
        # Try to generate a small forecast
        if len(forecaster.models) > 0:
            print(f"   Testing forecast generation...")
            test_forecast = generate_future_forecast(
                start_date=pd.Timestamp("2026-02-15"),
                end_date=pd.Timestamp("2026-02-20"),
                dim_sku=dim_sku,
                forecaster=forecaster,
                data_cache={"fact_sku_forecast": pd.read_csv(data_path) if os.path.exists(data_path) else pd.DataFrame()}
            )
            if not test_forecast.empty:
                print(f"   ✅ Generated {len(test_forecast)} forecast records")
                print(f"   Columns: {list(test_forecast.columns)}")
            else:
                print(f"   ⚠️ No forecast generated (empty result)")
        else:
            print(f"   ⚠️ Cannot test - no models loaded")
    else:
        print(f"   ⚠️ SKU dimension file not found")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Check 5: Check forecast service availability
print(f"\n5. Checking forecast service...")
try:
    from forecast_service import FORECAST_MODELS_AVAILABLE
    print(f"   FORECAST_MODELS_AVAILABLE: {FORECAST_MODELS_AVAILABLE}")
except:
    print(f"   ⚠️ Could not check FORECAST_MODELS_AVAILABLE")

print("\n" + "=" * 60)
print("Diagnostic Complete")
print("=" * 60)
