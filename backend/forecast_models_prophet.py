"""
MC4 Forecast Models - Prophet Implementation
===========================================
Prophet is ideal for this use case because:
- Daily time series with strong seasonality
- Multiple seasonalities (weekly, yearly)
- Holiday/event effects (Ramadan, Hajj)
- Automatic changepoint detection
- Robust to missing data and outliers
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pickle
import os
import warnings
warnings.filterwarnings('ignore')

# Try to import Prophet
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("⚠️ Prophet not available. Install with: pip install prophet")

# Import statsmodels as fallback
try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False

class ProphetModelWrapper:
    """Wrapper for Prophet model to match interface"""
    def __init__(self, model, last_date, last_value):
        self.model = model
        self.last_date = pd.to_datetime(last_date)
        self.last_value = float(last_value)
        self.model_type = 'prophet'
    
    def make_future_dataframe(self, periods, freq='D'):
        return self.model.make_future_dataframe(periods=periods, freq=freq)
    
    def predict(self, future):
        forecast = self.model.predict(future)
        return forecast

class MC4ForecastModel:
    """Forecast model for MC4 SKU demand using Prophet"""
    
    def __init__(self, model_dir="models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.models = {}
    
    def prepare_data(self, df, sku_id=None):
        """Prepare data for Prophet (requires 'ds' and 'y' columns)"""
        if sku_id:
            df = df[df["sku_id"] == sku_id].copy()
        
        df["date"] = pd.to_datetime(df["date"], errors='coerce')
        df = df[df["date"].notna()].copy()
        df = df.sort_values("date")
        
        # Aggregate by date
        df_agg = df.groupby("date")["demand_tons"].sum().reset_index()
        df_agg.columns = ["ds", "y"]
        
        return df_agg
    
    def _create_holidays_dataframe(self):
        """Create holidays dataframe for Prophet (Ramadan and Hajj)"""
        holidays = []
        
        # Ramadan dates
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7),
            2028: (1, 27), 2029: (1, 15),
        }
        
        # Hajj months
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5,
            2028: 5, 2029: 4,
        }
        
        # Add Ramadan holidays
        for year, (month, day) in ramadan_starts.items():
            start = pd.Timestamp(year, month, day)
            for i in range(30):  # Ramadan lasts ~30 days
                date = start + pd.Timedelta(days=i)
                holidays.append({
                    'holiday': 'ramadan',
                    'ds': date,
                    'lower_window': 0,
                    'upper_window': 0,
                })
        
        # Add Hajj holidays (entire month)
        for year, month in hajj_months.items():
            start = pd.Timestamp(year, month, 1)
            end = start + pd.offsets.MonthEnd(0)
            current = start
            while current <= end:
                holidays.append({
                    'holiday': 'hajj',
                    'ds': current,
                    'lower_window': 0,
                    'upper_window': 0,
                })
                current += pd.Timedelta(days=1)
        
        return pd.DataFrame(holidays)
    
    def train_model(self, df, sku_id, include_holidays=True):
        """Train Prophet model for a specific SKU"""
        df_prep = self.prepare_data(df, sku_id)
        
        if len(df_prep) < 30:
            raise ValueError(f"Insufficient data for SKU {sku_id}: {len(df_prep)} points")
        
        # Try Prophet first (best for this use case)
        if PROPHET_AVAILABLE:
            try:
                return self._train_prophet(df_prep, include_holidays)
            except Exception as e:
                print(f"   ⚠️ Prophet failed for {sku_id}: {str(e)}")
                print(f"   ⚠️ Attempting fallback methods...")
        
        # Fallback to ExponentialSmoothing
        if STATSMODELS_AVAILABLE:
            try:
                return self._train_exponential_smoothing(df_prep)
            except Exception as e:
                print(f"   ⚠️ ExponentialSmoothing failed: {str(e)}")
        
        # Last resort: Simple model
        print(f"   ⚠️ Using SimpleModel as last resort for {sku_id}")
        return self._train_simple(df_prep)
    
    def _train_prophet(self, df_prep, include_holidays=True):
        """Train Prophet model - ideal for daily data with seasonality"""
        # Ensure positive values (Prophet requires positive values)
        if (df_prep['y'] <= 0).any():
            min_val = df_prep['y'].min()
            if min_val <= 0:
                offset = abs(min_val) + 0.001
                df_prep = df_prep.copy()
                df_prep['y'] = df_prep['y'] + offset
        
        # Create Prophet model with appropriate settings for daily data
        model_params = {
            'daily_seasonality': False,  # Daily data, no daily seasonality needed
            'weekly_seasonality': True,  # Weekly patterns (weekends)
            'yearly_seasonality': True,  # Yearly patterns
            'seasonality_mode': 'multiplicative',  # Multiplicative for demand
            'changepoint_prior_scale': 0.05,  # Conservative changepoints
            'seasonality_prior_scale': 10.0,  # Allow strong seasonality
            'holidays_prior_scale': 10.0,  # Allow strong holiday effects
            'mcmc_samples': 0,  # No MCMC for speed
            'interval_width': 0.80,  # 80% confidence intervals
            'uncertainty_samples': 1000,
        }
        
        # Add holidays if requested
        if include_holidays:
            holidays_df = self._create_holidays_dataframe()
            model_params['holidays'] = holidays_df
        
        # Create and fit model
        model = Prophet(**model_params)
        model.fit(df_prep)
        
        last_date = df_prep['ds'].max()
        last_value = float(df_prep['y'].iloc[-1])
        
        return ProphetModelWrapper(model, last_date, last_value)
    
    def _train_exponential_smoothing(self, df_prep):
        """Fallback: ExponentialSmoothing with trend and seasonality"""
        from forecast_models import StatsModelWrapper
        
        df_indexed = df_prep.set_index('ds')
        if not isinstance(df_indexed.index, pd.DatetimeIndex):
            df_indexed.index = pd.to_datetime(df_indexed.index)
        
        if df_indexed.index.freq is None:
            try:
                df_indexed = df_indexed.asfreq('D', method='pad')
            except:
                df_indexed.index.freq = pd.infer_freq(df_indexed.index) or 'D'
        
        series = df_indexed['y'].dropna()
        
        # Ensure positive values
        min_val = series.min()
        if min_val <= 0:
            offset = abs(min_val) + 0.001
            series = series + offset
        
        # Try ExponentialSmoothing
        with warnings.catch_warnings():
            warnings.filterwarnings('ignore', category=UserWarning)
            
            try:
                fitted_model = ExponentialSmoothing(
                    series,
                    trend='add',
                    seasonal='add',
                    seasonal_periods=min(365, len(series) // 2)
                ).fit(optimized=True, remove_bias=False)
            except:
                try:
                    fitted_model = ExponentialSmoothing(
                        series,
                        trend='add'
                    ).fit(optimized=True, remove_bias=False)
                except:
                    raise ValueError("ExponentialSmoothing failed")
        
        model_params = {
            'smoothing_level': float(fitted_model.params.get('smoothing_level', 0.3)),
            'smoothing_trend': float(fitted_model.params.get('smoothing_trend', 0.0)),
            'initial_level': float(fitted_model.params.get('initial_level', series.iloc[0])),
        }
        
        last_date = df_indexed.index[-1]
        last_value = float(series.iloc[-1])
        
        return StatsModelWrapper(model_params, last_date, last_value)
    
    def _train_simple(self, df_prep):
        """Last resort: Simple trend model"""
        from forecast_models import SimpleModel
        return SimpleModel(df_prep)
    
    def train_all_skus(self, df, sku_list=None):
        """Train models for all SKUs"""
        if sku_list is None:
            sku_list = df["sku_id"].unique()
        
        print(f"🔄 Training models for {len(sku_list)} SKUs...")
        for i, sku_id in enumerate(sku_list, 1):
            try:
                print(f"   [{i}/{len(sku_list)}] Training {sku_id}...")
                model = self.train_model(df, sku_id)
                self.models[sku_id] = model
                
                # Save model
                model_path = os.path.join(self.model_dir, f"model_{sku_id}.pkl")
                with open(model_path, 'wb') as f:
                    pickle.dump(model, f)
                    
            except Exception as e:
                print(f"   ⚠️ Failed to train {sku_id}: {str(e)}")
        
        print(f"✅ Trained {len(self.models)} models successfully")
    
    def forecast(self, sku_id, periods=30, start_date=None):
        """Generate forecast for a SKU"""
        if sku_id not in self.models:
            # Try to load from disk
            model_path = os.path.join(self.model_dir, f"model_{sku_id}.pkl")
            if os.path.exists(model_path):
                try:
                    with open(model_path, 'rb') as f:
                        self.models[sku_id] = pickle.load(f)
                except Exception as e:
                    raise ValueError(f"Failed to load model for SKU {sku_id}: {str(e)}")
            else:
                raise ValueError(f"No model found for SKU {sku_id}")
        
        model = self.models[sku_id]
        
        # Create future dataframe
        if start_date:
            start_date_ts = pd.to_datetime(start_date)
            model_last_date = model.last_date if hasattr(model, 'last_date') else None
            
            if model_last_date and start_date_ts > model_last_date:
                days_from_model = (start_date_ts - model_last_date).days + periods
                future = model.make_future_dataframe(periods=max(days_from_model, periods), freq='D')
                future = future[future['ds'] >= start_date_ts]
                if len(future) > periods:
                    future = future.head(periods)
            else:
                future = model.make_future_dataframe(periods=periods, freq='D')
                future = future[future['ds'] >= start_date_ts]
        else:
            future = model.make_future_dataframe(periods=periods, freq='D')
        
        # Predict
        if model.model_type == 'prophet':
            forecast = model.predict(future)
            result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()
            result.rename(columns={
                'ds': 'date',
                'yhat': 'demand_tons',
                'yhat_lower': 'forecast_lower',
                'yhat_upper': 'forecast_upper'
            }, inplace=True)
            return result
        else:
            # For other model types, use their predict method
            forecast = model.predict(future)
            if 'ds' in forecast.columns:
                result = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()
                result.rename(columns={
                    'ds': 'date',
                    'yhat': 'demand_tons',
                    'yhat_lower': 'forecast_lower',
                    'yhat_upper': 'forecast_upper'
                }, inplace=True)
                return result
            else:
                raise ValueError("Model prediction format not recognized")
    
    def forecast_all(self, periods=30, start_date=None):
        """Generate forecasts for all trained SKUs"""
        all_forecasts = []
        for sku_id in self.models.keys():
            try:
                forecast = self.forecast(sku_id, periods, start_date)
                forecast['sku_id'] = sku_id
                all_forecasts.append(forecast)
            except Exception as e:
                print(f"⚠️ Forecast failed for {sku_id}: {str(e)}")
        
        if all_forecasts:
            return pd.concat(all_forecasts, ignore_index=True)
        return pd.DataFrame()


def train_and_save_models(
    data_path="datasets/fact_sku_forecast.csv",
    model_dir="models"
):
    """Train all models from historical data using Prophet"""
    
    print("📊 Loading historical data...")
    df = pd.read_csv(data_path)
    df["date"] = pd.to_datetime(df["date"], errors='coerce')
    
    # Check for corrupted dates
    na_count = df["date"].isna().sum()
    if na_count > 0:
        print(f"⚠️ WARNING: {na_count} rows have corrupted/invalid dates and will be excluded")
        df = df[df["date"].notna()].copy()
        if len(df) == 0:
            raise ValueError(f"All dates in {data_path} are corrupted. Cannot train models.")
    
    # Filter to historical ACTUAL data only (before 2026-02-14 for training)
    ACTUAL_DATA_END_DATE = pd.Timestamp("2026-02-14")
    df_train = df[df["date"] <= ACTUAL_DATA_END_DATE].copy()
    
    if len(df_train) == 0:
        raise ValueError("No historical data found for training")
    
    print(f"📈 Training on {len(df_train)} records from {df_train['date'].min()} to {df_train['date'].max()}")
    
    # Train models
    forecaster = MC4ForecastModel(model_dir=model_dir)
    sku_list = df_train["sku_id"].unique()
    forecaster.train_all_skus(df_train, sku_list)
    
    return forecaster


if __name__ == "__main__":
    # Train models
    forecaster = train_and_save_models()
    print("✅ Model training complete!")
