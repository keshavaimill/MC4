"""
MC4 Forecast Service
Service layer for generating forecasts and updating datasets
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os


def generate_future_forecast(start_date, end_date, dim_sku, forecaster=None, data_cache=None):
    """
    Generate forecast data for future dates using ML models trained on historical data.
    Returns data in the same format as historical data with all required columns.
    
    Args:
        start_date: Start date for forecast (pd.Timestamp)
        end_date: End date for forecast (pd.Timestamp)
        dim_sku: DataFrame with SKU dimension data (must have pack_size_kg)
        forecaster: MC4ForecastModel instance (optional)
        data_cache: Dictionary with cached datasets (optional)
    
    Returns:
        DataFrame with forecast data matching historical schema:
        (sku_id, date, demand_tons, demand_units, confidence_pct, seasonality_index, scenario_id, forecast_lower, forecast_upper)
    """
    if dim_sku.empty:
        print("⚠️ No SKU data available for forecasting")
        return pd.DataFrame()
    
    # Get list of SKUs
    sku_list = dim_sku["sku_id"].unique()
    
    # Calculate number of periods
    periods = (end_date - start_date).days + 1
    
    all_forecasts = []
    
    # Get historical data to calculate trends and seasonality
    historical = None
    if data_cache and "fact_sku_forecast" in data_cache:
        historical = data_cache["fact_sku_forecast"]
        if not historical.empty:
            historical["date"] = pd.to_datetime(historical["date"])
    
    # If forecaster is available, use it
    if forecaster is not None:
        print(f"   Using trained models to forecast {len(sku_list)} SKUs for {periods} days...")
        for sku_id in sku_list:
            try:
                # Get recent historical values for better lag features
                historical_values = None
                if historical is not None:
                    sku_historical = historical[historical["sku_id"] == sku_id].copy()
                    if not sku_historical.empty:
                        sku_historical = sku_historical.sort_values("date")
                        # Get last 30 values for lag features
                        historical_values = sku_historical["demand_tons"].tail(30).values.tolist()
                
                # Get forecast from model with historical values for better predictions
                forecast = forecaster.forecast(sku_id, periods=periods, start_date=start_date, historical_values=historical_values)
                forecast['sku_id'] = sku_id
                
                # Get SKU info for unit conversion
                sku_info = dim_sku[dim_sku["sku_id"] == sku_id]
                if sku_info.empty:
                    pack_size_kg = 10.0  # Default
                else:
                    pack_size_kg = float(sku_info.iloc[0]["pack_size_kg"])
                
                # Light constraint: only prevent extreme outliers, let model capture patterns
                if historical is not None:
                    sku_historical = historical[historical["sku_id"] == sku_id].copy()
                    if not sku_historical.empty:
                        sku_historical = sku_historical.sort_values("date")
                        recent_data = sku_historical.tail(30)
                        
                        if len(recent_data) >= 7:
                            recent_mean = recent_data["demand_tons"].mean()
                            recent_std = recent_data["demand_tons"].std()
                            recent_min = recent_data["demand_tons"].min()
                            recent_max = recent_data["demand_tons"].max()
                            
                            # Calculate reasonable bounds (wider to allow variation)
                            upper_bound = recent_max * 2.0  # Allow up to 2x max
                            lower_bound = max(0, recent_min * 0.3)  # Allow down to 30% of min
                            
                            # Light adjustment: Only blend 20% with recent mean at start, let model drive
                            # This allows the model to capture patterns while preventing extreme jumps
                            forecast_values = forecast['demand_tons'].values.copy()
                            recent_last = recent_data["demand_tons"].iloc[-1]
                            
                            for i in range(len(forecast_values)):
                                model_value = forecast_values[i]
                                
                                # Light blend: Start with 20% recent mean, quickly fade to 0%
                                # This ensures smooth transition from last value but lets model take over
                                blend_factor = max(0, 0.2 - (i / len(forecast_values)) * 0.2)  # 0.2 to 0.0
                                if i == 0:
                                    # First value: blend with last historical value for continuity
                                    adjusted_value = recent_last * 0.3 + model_value * 0.7
                                else:
                                    adjusted_value = recent_mean * blend_factor + model_value * (1 - blend_factor)
                                
                                # Apply wide bounds only to prevent extreme outliers
                                adjusted_value = max(lower_bound, min(upper_bound, adjusted_value))
                                
                                forecast_values[i] = adjusted_value
                            
                            forecast['demand_tons'] = forecast_values
                        else:
                            # If less than 7 days, use minimal constraint
                            recent_mean = recent_data["demand_tons"].mean()
                            forecast_values = forecast['demand_tons'].values.copy()
                            for i in range(len(forecast_values)):
                                # Minimal blend: 10% recent mean, 90% model
                                blend = max(0, 0.1 - (i / len(forecast_values)) * 0.1)  # 0.1 to 0.0
                                forecast_values[i] = recent_mean * blend + forecast_values[i] * (1 - blend)
                            forecast['demand_tons'] = forecast_values
                
                # Final safety check: only cap extreme outliers (very wide bounds)
                if historical is not None:
                    sku_historical = historical[historical["sku_id"] == sku_id].copy()
                    if not sku_historical.empty:
                        historical_max = sku_historical["demand_tons"].max()
                        historical_mean = sku_historical["demand_tons"].mean()
                        historical_min = sku_historical["demand_tons"].min()
                        # Very wide bounds: allow 3x max or 4x mean, whichever is higher (allows for growth/events)
                        max_allowed = max(historical_max * 3.0, historical_mean * 4.0)
                        min_allowed = max(0, historical_min * 0.2)  # Allow down to 20% of historical min
                        forecast['demand_tons'] = forecast['demand_tons'].clip(lower=min_allowed, upper=max_allowed)
                
                # Round demand_tons to 2 decimal places (match historical format)
                forecast['demand_tons'] = forecast['demand_tons'].round(2)
                
                # Calculate demand_units: demand_tons * 1000 / pack_size_kg
                forecast['demand_units'] = (forecast['demand_tons'] * 1000 / pack_size_kg).round(0).astype(int)
                
                # Set confidence_pct (0.8 for forecasts vs 1.0 for actuals)
                forecast['confidence_pct'] = 0.8
                
                # Calculate seasonality_index from recent historical data if available
                if historical is not None:
                    sku_historical = historical[historical["sku_id"] == sku_id]
                    if not sku_historical.empty and len(sku_historical) >= 30:
                        # Use last 30 days average seasonality_index, or calculate from data
                        recent_data = sku_historical.tail(30)
                        if "seasonality_index" in recent_data.columns:
                            seasonality = recent_data["seasonality_index"].mean()
                        else:
                            # Calculate from demand variation
                            mean_demand = recent_data["demand_tons"].mean()
                            if mean_demand > 0:
                                seasonality = 1.0 + (recent_data["demand_tons"].std() / mean_demand) * 0.5
                            else:
                                seasonality = 1.0
                        forecast['seasonality_index'] = round(seasonality, 2)
                    else:
                        forecast['seasonality_index'] = 1.0
                else:
                    forecast['seasonality_index'] = 1.0
                
                # Set scenario_id to "base" (matching historical)
                forecast['scenario_id'] = 'base'
                
                # Adjust forecast bounds to match adjusted demand_tons
                # Keep the same relative spread but centered on adjusted values
                if 'forecast_lower' in forecast.columns and 'forecast_upper' in forecast.columns:
                    # Calculate original spread
                    original_center = (forecast['forecast_lower'] + forecast['forecast_upper']) / 2
                    original_spread = forecast['forecast_upper'] - forecast['forecast_lower']
                    
                    # Recalculate bounds around adjusted demand_tons
                    # Use 15% spread (more conservative than original)
                    spread_factor = 0.15
                    forecast['forecast_lower'] = (forecast['demand_tons'] * (1 - spread_factor)).round(2)
                    forecast['forecast_upper'] = (forecast['demand_tons'] * (1 + spread_factor)).round(2)
                    
                    # Ensure bounds are non-negative
                    forecast['forecast_lower'] = forecast['forecast_lower'].clip(lower=0)
                else:
                    # If bounds don't exist, create them
                    forecast['forecast_lower'] = (forecast['demand_tons'] * 0.85).round(2)
                    forecast['forecast_upper'] = (forecast['demand_tons'] * 1.15).round(2)
                
                all_forecasts.append(forecast)
            except Exception as e:
                print(f"   ⚠️ Forecast failed for {sku_id}: {str(e)}")
                # Continue with other SKUs
    else:
        # Fallback: simple forecast using recent trend values
        print(f"   ⚠️ No forecaster available, using trend-based forecast...")
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        
        # Get historical data if available
        if data_cache and "fact_sku_forecast" in data_cache:
            historical = data_cache["fact_sku_forecast"]
            if not historical.empty and "demand_tons" in historical.columns:
                historical["date"] = pd.to_datetime(historical["date"])
                for sku_id in sku_list:
                    sku_data = historical[historical["sku_id"] == sku_id].copy()
                    sku_data = sku_data.sort_values("date")
                    
                    # Get SKU info for unit conversion
                    sku_info = dim_sku[dim_sku["sku_id"] == sku_id]
                    pack_size_kg = float(sku_info.iloc[0]["pack_size_kg"]) if not sku_info.empty else 10.0
                    
                    if not sku_data.empty and len(sku_data) >= 7:
                        # Use recent trend (last 7 days average) for better continuity
                        recent = sku_data.tail(7)
                        base_demand = recent["demand_tons"].mean()
                        std_demand = recent["demand_tons"].std() if len(recent) > 1 else base_demand * 0.1
                        
                        # Calculate trend from last 30 days if available
                        if len(sku_data) >= 30:
                            trend_data = sku_data.tail(30)
                            trend = (trend_data["demand_tons"].iloc[-1] - trend_data["demand_tons"].iloc[0]) / len(trend_data)
                        else:
                            trend = 0.0
                        
                        # Apply small trend to forecast
                        forecast_values = []
                        for i, date in enumerate(dates):
                            # Start from recent average, apply small trend
                            value = base_demand + (trend * i * 0.1)  # Dampen trend
                            forecast_values.append(max(0, value))
                    else:
                        # Use mean if available, else default
                        if not sku_data.empty:
                            base_demand = sku_data["demand_tons"].mean()
                            std_demand = sku_data["demand_tons"].std() if len(sku_data) > 1 else base_demand * 0.1
                        else:
                            base_demand = 100.0
                            std_demand = 10.0
                        forecast_values = [base_demand] * len(dates)
                    
                    forecast_df = pd.DataFrame({
                        'date': dates,
                        'sku_id': sku_id,
                        'demand_tons': [round(v, 2) for v in forecast_values],
                        'demand_units': [int(v * 1000 / pack_size_kg) for v in forecast_values],
                        'confidence_pct': 0.8,
                        'seasonality_index': 1.0,
                        'scenario_id': 'base',
                        'forecast_lower': [round(max(0, v - 1.96 * std_demand), 2) for v in forecast_values],
                        'forecast_upper': [round(v + 1.96 * std_demand, 2) for v in forecast_values]
                    })
                    all_forecasts.append(forecast_df)
            else:
                # No historical data - use default values
                for sku_id in sku_list:
                    sku_info = dim_sku[dim_sku["sku_id"] == sku_id]
                    pack_size_kg = float(sku_info.iloc[0]["pack_size_kg"]) if not sku_info.empty else 10.0
                    
                    forecast_df = pd.DataFrame({
                        'date': dates,
                        'sku_id': sku_id,
                        'demand_tons': 100.0,
                        'demand_units': int(100.0 * 1000 / pack_size_kg),
                        'confidence_pct': 0.8,
                        'seasonality_index': 1.0,
                        'scenario_id': 'base',
                        'forecast_lower': 50.0,
                        'forecast_upper': 150.0
                    })
                    all_forecasts.append(forecast_df)
        else:
            # No data cache - use default values
            for sku_id in sku_list:
                sku_info = dim_sku[dim_sku["sku_id"] == sku_id]
                pack_size_kg = float(sku_info.iloc[0]["pack_size_kg"]) if not sku_info.empty else 10.0
                
                forecast_df = pd.DataFrame({
                    'date': dates,
                    'sku_id': sku_id,
                    'demand_tons': 100.0,
                    'demand_units': int(100.0 * 1000 / pack_size_kg),
                    'confidence_pct': 0.8,
                    'seasonality_index': 1.0,
                    'scenario_id': 'base',
                    'forecast_lower': 50.0,
                    'forecast_upper': 150.0
                })
                all_forecasts.append(forecast_df)
    
    if all_forecasts:
        result = pd.concat(all_forecasts, ignore_index=True)
        # Ensure date column is datetime
        result['date'] = pd.to_datetime(result['date'])
        # Filter to requested date range
        result = result[(result['date'] >= start_date) & (result['date'] <= end_date)]
        
        # Ensure all required columns exist and are in correct order (matching historical schema)
        required_columns = [
            'sku_id', 'date', 'demand_tons', 'demand_units', 
            'confidence_pct', 'seasonality_index', 'scenario_id', 
            'forecast_lower', 'forecast_upper'
        ]
        
        # Add missing columns with default values
        for col in required_columns:
            if col not in result.columns:
                if col == 'demand_units':
                    # Calculate from demand_tons if missing
                    if 'demand_tons' in result.columns:
                        # Merge with dim_sku to get pack_size_kg
                        result = result.merge(
                            dim_sku[['sku_id', 'pack_size_kg']], 
                            on='sku_id', 
                            how='left'
                        )
                        result['pack_size_kg'] = result['pack_size_kg'].fillna(10.0)
                        result['demand_units'] = (result['demand_tons'] * 1000 / result['pack_size_kg']).round(0).astype(int)
                        result = result.drop('pack_size_kg', axis=1)
                    else:
                        result[col] = 0
                elif col == 'confidence_pct':
                    result[col] = 0.8
                elif col == 'seasonality_index':
                    result[col] = 1.0
                elif col == 'scenario_id':
                    result[col] = 'base'
                elif col in ['forecast_lower', 'forecast_upper']:
                    result[col] = result['demand_tons'] if 'demand_tons' in result.columns else 0.0
        
        # Reorder columns to match historical schema
        result = result[required_columns]
        
        # Ensure date is string format (YYYY-MM-DD) to match historical
        result['date'] = result['date'].dt.strftime('%Y-%m-%d')
        
        return result
    else:
        return pd.DataFrame()


def generate_forecasts_and_propagate_datasets(
    start_date,
    end_date,
    forecaster=None,
    data_cache=None,
    backend_dir=None,
    data_dir="datasets",
    update_derived_datasets_func=None
):
    """
    Generate forecasts for a date range and update all related datasets.
    
    Args:
        start_date: Start date for forecast (pd.Timestamp)
        end_date: End date for forecast (pd.Timestamp)
        forecaster: MC4ForecastModel instance (optional)
        data_cache: Dictionary with cached datasets
        backend_dir: Backend directory path
        data_dir: Data directory name (default: "datasets")
        update_derived_datasets_func: Function to update derived datasets (optional)
    
    Returns:
        Dictionary with 'success', 'records', 'sku_count', 'message'
    """
    try:
        if data_cache is None:
            return {
                "success": False,
                "records": 0,
                "sku_count": 0,
                "message": "Data cache not provided"
            }
        
        # Get SKU dimension
        dim_sku = data_cache.get("dim_sku", pd.DataFrame())
        if dim_sku.empty:
            return {
                "success": False,
                "records": 0,
                "sku_count": 0,
                "message": "No SKU dimension data available"
            }
        
        # Generate forecasts
        print(f"   Generating forecasts from {start_date.date()} to {end_date.date()}...")
        forecast_df = generate_future_forecast(
            start_date=start_date,
            end_date=end_date,
            dim_sku=dim_sku,
            forecaster=forecaster,
            data_cache=data_cache
        )
        
        if forecast_df.empty:
            return {
                "success": False,
                "records": 0,
                "sku_count": 0,
                "message": "No forecasts generated"
            }
        
        # Append to forecast dataset
        forecast_path = os.path.join(backend_dir, data_dir, "fact_sku_forecast.csv")
        
        if os.path.exists(forecast_path):
            existing_df = pd.read_csv(forecast_path)
            if "date" in existing_df.columns:
                existing_df["date"] = pd.to_datetime(existing_df["date"])
                # Remove overlapping dates
                forecast_df["date"] = pd.to_datetime(forecast_df["date"])
                min_new_date = forecast_df["date"].min()
                existing_df = existing_df[existing_df["date"] < min_new_date]
            
            # Combine
            combined_df = pd.concat([existing_df, forecast_df], ignore_index=True)
        else:
            combined_df = forecast_df.copy()
        
        # Save
        combined_df.to_csv(forecast_path, index=False)
        
        # Update cache
        data_cache["fact_sku_forecast"] = combined_df.copy()
        
        # Update derived datasets if function provided
        if update_derived_datasets_func is not None:
            try:
                update_derived_datasets_func(start_date, end_date)
            except Exception as e:
                print(f"   ⚠️ Error updating derived datasets: {e}")
        
        # Return success
        sku_count = forecast_df["sku_id"].nunique() if "sku_id" in forecast_df.columns else 0
        record_count = len(forecast_df)
        
        return {
            "success": True,
            "records": record_count,
            "sku_count": sku_count,
            "message": f"Successfully generated {record_count} forecast records for {sku_count} SKUs"
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "records": 0,
            "sku_count": 0,
            "message": f"Error generating forecasts: {str(e)}"
        }


def generate_time_dimension_for_dates(start_date, end_date):
    """
    Generate time dimension DataFrame for a date range.
    
    Args:
        start_date: Start date (pd.Timestamp)
        end_date: End date (pd.Timestamp)
    
    Returns:
        DataFrame with time dimension features
    """
    dates = pd.date_range(start=start_date, end=end_date, freq='D')
    df = pd.DataFrame({"date": dates})
    
    df["day_of_week"] = df["date"].dt.dayofweek
    # Saudi Arabia weekend: Friday (4) and Saturday (5)
    df["is_weekend"] = df["day_of_week"].isin([4, 5]).astype(int)
    
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
            return 1 if s <= date <= s + pd.Timedelta(days=29) else 0
        return 0
    
    hajj_months = {
        2020: 7, 2021: 7, 2022: 7, 2023: 6,
        2024: 6, 2025: 6, 2026: 5, 2027: 5,
        2028: 5, 2029: 4,
    }
    
    def _is_hajj(date):
        return 1 if (date.year in hajj_months and date.month == hajj_months[date.year]) else 0
    
    def _is_eid_al_fitr(date):
        """Eid al-Fitr: 1-3 days after Ramadan ends"""
        if date.year in ramadan_starts:
            m, d = ramadan_starts[date.year]
            ramadan_end = pd.Timestamp(date.year, m, d) + pd.Timedelta(days=29)
            eid_start = ramadan_end + pd.Timedelta(days=1)
            eid_end = eid_start + pd.Timedelta(days=2)  # 3 days total
            return 1 if eid_start <= date <= eid_end else 0
        return 0
    
    def _is_eid_al_adha(date):
        """Eid al-Adha: Around day 10-13 of Dhu al-Hijjah (Hajj month)"""
        if date.year in hajj_months:
            hajj_month = hajj_months[date.year]
            if date.month == hajj_month and 10 <= date.day <= 13:
                return 1
        return 0
    
    df["is_ramadan"] = df["date"].apply(_is_ramadan)
    df["is_hajj"] = df["date"].apply(_is_hajj)
    df["is_eid_fitr"] = df["date"].apply(_is_eid_al_fitr)
    df["is_eid_adha"] = df["date"].apply(_is_eid_al_adha)
    
    return df
