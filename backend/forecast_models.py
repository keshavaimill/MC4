"""
MC4 Forecast Models
Time-series forecasting for SKU demand with seasonality handling
Simplified to use XGBoost (primary) or Simple Model (fallback)
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pickle
import os
import warnings
warnings.filterwarnings('ignore')

# Import XGBoost for fast time series forecasting
XGBOOST_AVAILABLE = False
xgb = None
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
    print("✅ XGBoost is available and will be used for forecasting")
except ImportError as e:
    XGBOOST_AVAILABLE = False
    print(f"❌ XGBoost not available. Import error: {e}")
    print("   Install with: pip install xgboost")
    print("   Will use Simple Model only")


class XGBoostModelWrapper:
    """Wrapper for XGBoost model for time series forecasting"""
    def __init__(self, model, feature_columns, last_date, last_value, mean_value, std_value):
        self.model = model
        self.feature_columns = feature_columns
        self.last_date = pd.to_datetime(last_date)
        self.last_value = float(last_value)
        self.mean_value = float(mean_value)
        self.std_value = float(std_value)
        self.model_type = 'xgboost'
    
    def make_future_dataframe(self, periods, freq='D'):
        future_dates = pd.date_range(start=self.last_date, periods=periods + 1, freq=freq)[1:]
        return pd.DataFrame({'ds': future_dates})
    
    def _create_features(self, dates, historical_values=None):
        """Create features for XGBoost prediction"""
        # Handle both Series and list/array of dates
        if isinstance(dates, pd.Series):
            df = pd.DataFrame({'ds': dates})
        else:
            df = pd.DataFrame({'ds': dates})
        
        # Date features
        df['year'] = df['ds'].dt.year
        df['month'] = df['ds'].dt.month
        df['day'] = df['ds'].dt.day
        df['day_of_week'] = df['ds'].dt.dayofweek
        df['day_of_year'] = df['ds'].dt.dayofyear
        df['week_of_year'] = df['ds'].dt.isocalendar().week
        df['quarter'] = df['ds'].dt.quarter
        
        # Weekend indicator - Saudi Arabia: Friday (4) and Saturday (5)
        df['is_weekend'] = df['day_of_week'].isin([4, 5]).astype(int)
        
        # Ramadan and Hajj indicators
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7),
            2028: (1, 27), 2029: (1, 15),
        }
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5,
            2028: 5, 2029: 4,
        }
        
        def _is_ramadan(date):
            if date.year in ramadan_starts:
                m, d = ramadan_starts[date.year]
                s = pd.Timestamp(date.year, m, d)
                return 1 if s <= date <= s + pd.Timedelta(days=29) else 0
            return 0
        
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
        
        df['is_ramadan'] = df['ds'].apply(_is_ramadan).astype(int)
        df['is_hajj'] = df['ds'].apply(_is_hajj).astype(int)
        df['is_eid_fitr'] = df['ds'].apply(_is_eid_al_fitr).astype(int)
        df['is_eid_adha'] = df['ds'].apply(_is_eid_al_adha).astype(int)
        
        # Cyclical encoding for seasonality
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        df['day_of_year_sin'] = np.sin(2 * np.pi * df['day_of_year'] / 365)
        df['day_of_year_cos'] = np.cos(2 * np.pi * df['day_of_year'] / 365)
        df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        # If historical values provided, add lag features
        if historical_values is not None and len(historical_values) > 0:
            # Use mean as default for lag features if not enough history
            mean_val = np.mean(historical_values) if len(historical_values) > 0 else self.mean_value
            df['lag_1'] = historical_values[-1] if len(historical_values) >= 1 else mean_val
            df['lag_7'] = historical_values[-7] if len(historical_values) >= 7 else mean_val
            df['lag_30'] = historical_values[-30] if len(historical_values) >= 30 else mean_val
        else:
            # Use mean value for lag features
            df['lag_1'] = self.last_value
            df['lag_7'] = self.mean_value
            df['lag_30'] = self.mean_value
        
        # Rolling statistics (use mean/std as defaults)
        df['rolling_mean_7'] = self.mean_value
        df['rolling_mean_30'] = self.mean_value
        df['rolling_std_7'] = self.std_value
        
        # Select only the feature columns that the model was trained on
        available_features = [col for col in self.feature_columns if col in df.columns]
        return df[available_features]
    
    def predict(self, future, historical_values=None):
        """Generate XGBoost forecast with dynamic lag features
        
        Args:
            future: DataFrame with 'ds' column (dates)
            historical_values: List/array of recent historical values for initial lag features
        """
        # Initialize historical values for lag features
        if historical_values is None or len(historical_values) == 0:
            hist_vals = [self.last_value] * 30  # Use last value as default
        else:
            hist_vals = list(historical_values[-30:])  # Use last 30 values
            # Pad if needed
            while len(hist_vals) < 30:
                hist_vals.insert(0, self.mean_value)
        
        # Predict step by step to update lag features dynamically
        predictions = []
        rolling_window = hist_vals[-7:] if len(hist_vals) >= 7 else hist_vals.copy()
        
        for i, date in enumerate(future['ds']):
            # Create features for this date with current historical values
            X = self._create_features(pd.Series([date]), historical_values=hist_vals)
            
            # Update rolling statistics based on recent values (override defaults)
            if len(rolling_window) >= 7:
                X.loc[X.index[0], 'rolling_mean_7'] = float(np.mean(rolling_window[-7:]))
                X.loc[X.index[0], 'rolling_std_7'] = float(np.std(rolling_window[-7:])) if len(rolling_window) >= 7 else self.std_value
            else:
                X.loc[X.index[0], 'rolling_mean_7'] = float(np.mean(rolling_window)) if len(rolling_window) > 0 else self.mean_value
                X.loc[X.index[0], 'rolling_std_7'] = self.std_value
            
            if len(hist_vals) >= 30:
                X.loc[X.index[0], 'rolling_mean_30'] = float(np.mean(hist_vals[-30:]))
            else:
                X.loc[X.index[0], 'rolling_mean_30'] = float(np.mean(hist_vals)) if len(hist_vals) > 0 else self.mean_value
            
            # Predict
            yhat = self.model.predict(X.values)[0]
            yhat = max(0, yhat)  # Ensure non-negative
            predictions.append(yhat)
            
            # Update historical values for next iteration (sliding window)
            hist_vals.append(yhat)
            if len(hist_vals) > 30:
                hist_vals.pop(0)
            
            # Update rolling window
            rolling_window.append(yhat)
            if len(rolling_window) > 7:
                rolling_window.pop(0)
        
        future['yhat'] = np.array(predictions)
        
        # Confidence intervals based on model's uncertainty
        std_estimate = self.std_value
        future['yhat_lower'] = np.maximum(future['yhat'] - 1.96 * std_estimate, 0)
        future['yhat_upper'] = future['yhat'] + 1.96 * std_estimate
        
        return future


class SimpleModel:
    """Simple trend-based model - fully pickleable and reliable fallback"""
    def __init__(self, data):
        # Store only primitive values for easy pickling
        self.mean = float(data['y'].mean())
        # Calculate trend from recent data (last 30 days or all if less)
        recent_data = data['y'].tail(min(30, len(data)))
        if len(recent_data) > 1:
            # Calculate daily trend, but bound it to prevent extreme negative trends
            raw_trend = float((recent_data.iloc[-1] - recent_data.iloc[0]) / len(recent_data))
            # Bound negative trend: don't allow more than 0.5% daily decline
            min_allowed_trend = -self.mean * 0.005  # Max 0.5% daily decline
            self.trend = max(raw_trend, min_allowed_trend)
        else:
            self.trend = 0.0
        
        # Use rolling std for better uncertainty estimate
        if len(data) > 7:
            rolling_std = data['y'].tail(30).std() if len(data) >= 30 else data['y'].std()
            self.std = float(rolling_std) if not np.isnan(rolling_std) else float(data['y'].iloc[0] * 0.1)
        else:
            self.std = float(data['y'].iloc[0] * 0.1) if len(data) > 0 else 1.0
        
        # Use mean of recent values (last 7 days) as base
        if len(data) >= 7:
            self.base_value = float(data['y'].tail(7).mean())
        else:
            self.base_value = float(data['y'].iloc[-1])
        
        self.last_value = float(data['y'].iloc[-1])
        self.last_date = pd.to_datetime(data['ds'].iloc[-1])
        self.model_type = 'simple'
    
    def make_future_dataframe(self, periods, freq='D'):
        future_dates = pd.date_range(start=self.last_date, periods=periods + 1, freq=freq)[1:]
        return pd.DataFrame({'ds': future_dates})
    
    def predict(self, future):
        n_periods = len(future)
        base_value = self.base_value
        
        # Convert dates to datetime if needed
        if not isinstance(future['ds'].iloc[0], pd.Timestamp):
            future['ds'] = pd.to_datetime(future['ds'])
        
        # Linear trend projection
        trend_component = self.trend * np.arange(1, n_periods + 1)
        min_allowed_value = base_value * 0.5
        trend_component = np.maximum(trend_component, min_allowed_value - base_value)
        
        # Add seasonal variability (sine wave based on day of year)
        doy = future['ds'].dt.dayofyear
        seasonal_multiplier = 1.0 + 0.08 * np.sin(2 * np.pi * doy / 365)
        
        # Add weekend effect - Saudi Arabia: Friday (4) and Saturday (5)
        day_of_week = future['ds'].dt.dayofweek
        is_weekend = np.isin(day_of_week, [4, 5])  # Friday and Saturday
        weekend_multiplier = np.where(is_weekend, 0.92, 1.0)
        
        # Add Ramadan, Hajj, and Eid event multipliers
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7),
            2028: (1, 27), 2029: (1, 15),
        }
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5,
            2028: 5, 2029: 4,
        }
        
        def _is_ramadan(date):
            if date.year in ramadan_starts:
                m, d = ramadan_starts[date.year]
                s = pd.Timestamp(date.year, m, d)
                return s <= date <= s + pd.Timedelta(days=29)
            return False
        
        def _is_hajj(date):
            return date.year in hajj_months and date.month == hajj_months[date.year]
        
        def _is_eid_al_fitr(date):
            """Eid al-Fitr: 1-3 days after Ramadan ends"""
            if date.year in ramadan_starts:
                m, d = ramadan_starts[date.year]
                ramadan_end = pd.Timestamp(date.year, m, d) + pd.Timedelta(days=29)
                eid_start = ramadan_end + pd.Timedelta(days=1)
                eid_end = eid_start + pd.Timedelta(days=2)  # 3 days total
                return eid_start <= date <= eid_end
            return False
        
        def _is_eid_al_adha(date):
            """Eid al-Adha: Around day 10-13 of Dhu al-Hijjah (Hajj month)"""
            if date.year in hajj_months:
                hajj_month = hajj_months[date.year]
                if date.month == hajj_month and 10 <= date.day <= 13:
                    return True
            return False
        
        is_ramadan = future['ds'].apply(_is_ramadan).values
        is_hajj = future['ds'].apply(_is_hajj).values
        is_eid_fitr = future['ds'].apply(_is_eid_al_fitr).values
        is_eid_adha = future['ds'].apply(_is_eid_al_adha).values
        
        # Event multipliers (Eid has highest priority, then Ramadan, then Hajj)
        event_multiplier = np.maximum.reduce([
            np.where(is_eid_fitr, 1.50, 1.0),  # Eid al-Fitr: 50% increase
            np.where(is_eid_adha, 1.45, 1.0),  # Eid al-Adha: 45% increase
            np.where(is_ramadan, 1.35, 1.0),  # Ramadan: 35% increase
            np.where(is_hajj, 1.25, 1.0)      # Hajj: 25% increase
        ])
        
        # Add random noise based on historical variability
        first_date = future['ds'].iloc[0]
        seed = int(first_date.timestamp()) % (2**31)
        rng = np.random.RandomState(seed)
        noise_component = rng.normal(0, self.std * 0.05, n_periods)
        
        # Combine all components
        forecast_values = (
            (base_value + trend_component) * seasonal_multiplier * weekend_multiplier * event_multiplier + noise_component
        )
        
        # Ensure non-negative
        forecast_values = np.maximum(forecast_values, 0)
        future['yhat'] = forecast_values
        
        # Confidence intervals
        future['yhat_lower'] = np.maximum(forecast_values - 1.96 * self.std, 0)
        future['yhat_upper'] = forecast_values + 1.96 * self.std
        return future


class MC4ForecastModel:
    """Forecast model for MC4 SKU demand"""
    
    def __init__(self, model_dir="models"):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        self.models = {}
    
    def prepare_data(self, df, sku_id=None):
        if sku_id:
            df = df[df["sku_id"] == sku_id].copy()

        df["date"] = pd.to_datetime(df["date"], errors='coerce')
        # Remove rows with invalid dates
        df = df[df["date"].notna()].copy()
        df = df.sort_values("date")

        # Aggregate by date in case there are multiple records per date
        df_agg = df.groupby("date")["demand_tons"].sum().reset_index()
        df_agg.columns = ["ds", "y"]

        return df_agg
    
    def _create_features(self, df):
        """Create features for XGBoost training"""
        # Date features - ensure all are int
        df['year'] = df['ds'].dt.year.astype(int)
        df['month'] = df['ds'].dt.month.astype(int)
        df['day'] = df['ds'].dt.day.astype(int)
        df['day_of_week'] = df['ds'].dt.dayofweek.astype(int)
        df['day_of_year'] = df['ds'].dt.dayofyear.astype(int)
        df['week_of_year'] = df['ds'].dt.isocalendar().week.astype(int)
        df['quarter'] = df['ds'].dt.quarter.astype(int)
        
        # Weekend indicator - Saudi Arabia: Friday (4) and Saturday (5)
        df['is_weekend'] = df['day_of_week'].isin([4, 5]).astype(int)
        
        # Ramadan and Hajj indicators
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7),
            2028: (1, 27), 2029: (1, 15),
        }
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5,
            2028: 5, 2029: 4,
        }
        
        def _is_ramadan(date):
            if date.year in ramadan_starts:
                m, d = ramadan_starts[date.year]
                s = pd.Timestamp(date.year, m, d)
                return 1 if s <= date <= s + pd.Timedelta(days=29) else 0
            return 0
        
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
                # Eid al-Adha is typically on day 10-13 of the Hajj month
                if date.month == hajj_month and 10 <= date.day <= 13:
                    return 1
            return 0
        
        df['is_ramadan'] = df['ds'].apply(_is_ramadan).astype(int)
        df['is_hajj'] = df['ds'].apply(_is_hajj).astype(int)
        df['is_eid_fitr'] = df['ds'].apply(_is_eid_al_fitr).astype(int)
        df['is_eid_adha'] = df['ds'].apply(_is_eid_al_adha).astype(int)
        
        # Cyclical encoding for seasonality - ensure float
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12).astype(float)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12).astype(float)
        df['day_of_year_sin'] = np.sin(2 * np.pi * df['day_of_year'] / 365).astype(float)
        df['day_of_year_cos'] = np.cos(2 * np.pi * df['day_of_year'] / 365).astype(float)
        df['day_of_week_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7).astype(float)
        df['day_of_week_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7).astype(float)
        
        # Lag features
        df['lag_1'] = df['y'].shift(1)
        df['lag_7'] = df['y'].shift(7)
        df['lag_30'] = df['y'].shift(30)
        
        # Rolling statistics
        df['rolling_mean_7'] = df['y'].rolling(window=7, min_periods=1).mean()
        df['rolling_mean_30'] = df['y'].rolling(window=30, min_periods=1).mean()
        df['rolling_std_7'] = df['y'].rolling(window=7, min_periods=1).std()
        
        # Fill NaN values in lag and rolling features
        mean_val = float(df['y'].mean())
        std_val = float(df['y'].std()) if df['y'].std() > 0 else 1.0
        
        df['lag_1'] = df['lag_1'].fillna(mean_val).astype(float)
        df['lag_7'] = df['lag_7'].fillna(mean_val).astype(float)
        df['lag_30'] = df['lag_30'].fillna(mean_val).astype(float)
        df['rolling_mean_7'] = df['rolling_mean_7'].fillna(mean_val).astype(float)
        df['rolling_mean_30'] = df['rolling_mean_30'].fillna(mean_val).astype(float)
        df['rolling_std_7'] = df['rolling_std_7'].fillna(std_val).astype(float)
        
        # Ensure target is float
        df['y'] = df['y'].astype(float)
        
        return df
    
    def train_model(self, df, sku_id):
        """Train forecasting model for a specific SKU - XGBoost or Simple Model"""
        df_prep = self.prepare_data(df, sku_id)
        
        if len(df_prep) < 30:
            raise ValueError(f"Insufficient data for SKU {sku_id}")
        
        # Try XGBoost first - MUST use XGBoost if available
        if not XGBOOST_AVAILABLE:
            print(f"   ❌ XGBoost not available. Install with: pip install xgboost")
            print(f"   ⚠️ Using Simple Model for {sku_id} (fallback only)")
            return self._train_simple(df_prep)
        
        # XGBoost is available - MUST use it, don't fall back silently
        print(f"   🔄 Training XGBoost model for {sku_id}...")
        try:
            xgb_model = self._train_xgboost(df_prep)
            print(f"   ✅ XGBoost model trained successfully for {sku_id}")
            return xgb_model
        except Exception as e:
            # Print full error for debugging
            import traceback
            error_msg = str(e)
            print(f"   ❌ XGBoost training FAILED for {sku_id}")
            print(f"   Error: {error_msg}")
            print(f"   📋 Full traceback:")
            traceback.print_exc()
            # Re-raise to prevent silent fallback - user needs to fix XGBoost
            raise RuntimeError(
                f"XGBoost training failed for {sku_id}. "
                f"This should not happen if XGBoost is properly installed. "
                f"Error: {error_msg}\n"
                f"Please check the traceback above and ensure XGBoost is correctly installed: pip install xgboost"
            )
    
    def _train_xgboost(self, df_prep):
        """Train XGBoost model with time series features"""
        # Create features
        df_features = self._create_features(df_prep.copy())
        
        # Prepare features and target
        feature_columns = [
            'year', 'month', 'day', 'day_of_week', 'day_of_year', 'week_of_year', 'quarter',
            'is_weekend', 'is_ramadan', 'is_hajj', 'is_eid_fitr', 'is_eid_adha',
            'month_sin', 'month_cos', 'day_of_year_sin', 'day_of_year_cos',
            'day_of_week_sin', 'day_of_week_cos',
            'lag_1', 'lag_7', 'lag_30',
            'rolling_mean_7', 'rolling_mean_30', 'rolling_std_7'
        ]
        
        # Ensure all feature columns exist
        missing_cols = [col for col in feature_columns if col not in df_features.columns]
        if missing_cols:
            raise ValueError(f"Missing feature columns: {missing_cols}")
        
        # Convert all feature columns to numeric, handling any errors
        for col in feature_columns:
            df_features[col] = pd.to_numeric(df_features[col], errors='coerce')
        
        # Ensure target is numeric
        df_features['y'] = pd.to_numeric(df_features['y'], errors='coerce')
        
        # Remove any rows with NaN using pandas (works with all types)
        valid_mask = ~(df_features[feature_columns].isna().any(axis=1) | df_features['y'].isna())
        df_features = df_features[valid_mask].copy()
        
        if len(df_features) < 30:
            raise ValueError(f"Insufficient data after feature engineering: {len(df_features)} points")
        
        # Now convert to numpy arrays (all numeric at this point)
        X = df_features[feature_columns].values.astype(np.float32)
        y = df_features['y'].values.astype(np.float32)
        
        # Verify XGBoost is available
        if not XGBOOST_AVAILABLE or xgb is None:
            raise ImportError("XGBoost is not available. Please install with: pip install xgboost")
        
        # Train XGBoost model with parameters optimized for pattern capture
        print(f"      Training XGBoost with {len(X)} samples and {len(feature_columns)} features...")
        model = xgb.XGBRegressor(
            n_estimators=150,  # Increased to capture more patterns
            max_depth=8,  # Deeper trees to capture complex patterns
            learning_rate=0.08,  # Slightly lower for better generalization
            subsample=0.85,
            colsample_bytree=0.85,
            min_child_weight=3,  # Prevent overfitting
            gamma=0.1,  # Minimum loss reduction for splits
            random_state=42,
            n_jobs=-1,  # Use all CPU cores
            tree_method='hist',  # Fast histogram-based method
            verbosity=0
        )
        
        # Fit model
        model.fit(X, y)
        print(f"      ✅ XGBoost model fitted successfully")
        
        # Get statistics for uncertainty estimation
        last_date = df_prep['ds'].iloc[-1]
        last_value = float(df_prep['y'].iloc[-1])
        mean_value = float(df_prep['y'].mean())
        std_value = float(df_prep['y'].std())
        
        return XGBoostModelWrapper(model, feature_columns, last_date, last_value, mean_value, std_value)
    
    def _train_simple(self, df_prep):
        """Simple trend model as fallback"""
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
    
    def forecast(self, sku_id, periods=30, start_date=None, historical_values=None):
        """Generate forecast for a SKU
        
        Args:
            sku_id: SKU identifier
            periods: Number of periods to forecast
            start_date: Start date for forecast (optional)
            historical_values: List/array of recent historical values for lag features (optional)
        """
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
        
        # Predict - pass historical values if available for better lag features
        if hasattr(model, 'predict'):
            # Check if model supports historical_values parameter
            if model.model_type == 'xgboost' and historical_values is not None:
                forecast = model.predict(future, historical_values=historical_values)
            else:
                forecast = model.predict(future)
        else:
            forecast = model.predict(future)
        
        # Handle model outputs
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
            if 'yhat' not in forecast.columns:
                raise ValueError("Model prediction missing 'yhat' column")
            
            if 'date' not in forecast.columns and 'ds' not in forecast.columns:
                if hasattr(forecast, 'index') and isinstance(forecast.index, pd.DatetimeIndex):
                    forecast['date'] = forecast.index
                else:
                    forecast['date'] = pd.date_range(start=datetime.now(), periods=len(forecast), freq='D')
            
            date_col = 'ds' if 'ds' in forecast.columns else 'date'
            
            result = forecast[[date_col, 'yhat', 'yhat_lower', 'yhat_upper']].copy()
            result.rename(columns={
                date_col: 'date',
                'yhat': 'demand_tons',
                'yhat_lower': 'forecast_lower',
                'yhat_upper': 'forecast_upper'
            }, inplace=True)
            return result
    
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
    time_dim_path=None,  # Not used, kept for compatibility
    model_dir="models"
):
    """Train all models from historical data - XGBoost or Simple Model"""

    # Verify XGBoost availability at startup
    if XGBOOST_AVAILABLE:
        print("✅ XGBoost is available - will use XGBoost for all SKUs")
        # Quick test to ensure XGBoost works
        try:
            test_model = xgb.XGBRegressor(n_estimators=1, verbosity=0)
            test_X = np.array([[1, 2, 3]])
            test_y = np.array([1.0])
            test_model.fit(test_X, test_y)
            print("✅ XGBoost test passed - ready for training")
        except Exception as e:
            print(f"❌ XGBoost test FAILED: {e}")
            print("   Please reinstall XGBoost: pip install --upgrade xgboost")
            raise RuntimeError("XGBoost is imported but not working. Please fix installation.")
    else:
        print("❌ XGBoost is NOT available - will use Simple Model (fallback)")
        print("   ⚠️ WARNING: To use XGBoost (recommended), install with: pip install xgboost")
        print("   Continuing with Simple Model fallback...")

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
