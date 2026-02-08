"""
MC4 Synthetic Data Generator
Generates realistic flour milling data with Arabian context and seasonality
"""
import numpy as np
import pandas as pd
from datetime import timedelta, datetime
import random
import os

# Set seed for reproducibility
np.random.seed(42)
random.seed(42)

# ---------------------------------------------
# 1️⃣ TIME DIMENSION (2020-2026-02-10 for training)
# ---------------------------------------------
def generate_time_dimension():
    """Generate time dimension with week, month, year, and Arabian calendar events"""
    start_date = "2020-01-01"
    end_date = "2026-02-10"
    dates = pd.date_range(start_date, end_date, freq="D")
    
    df_time = pd.DataFrame({"date": dates})
    df_time["week"] = df_time["date"].dt.isocalendar().year.astype(str) + "-W" + df_time["date"].dt.isocalendar().week.astype(str).str.zfill(2)
    df_time["month"] = df_time["date"].dt.to_period("M").astype(str)
    df_time["year"] = df_time["date"].dt.year
    df_time["quarter"] = df_time["date"].dt.quarter
    df_time["day_of_week"] = df_time["date"].dt.dayofweek
    df_time["is_weekend"] = df_time["day_of_week"].isin([4, 5])  # Fri, Sat in Saudi
    
    # Arabian calendar events (approximate dates)
    def get_ramadan_flag(date):
        """Ramadan typically increases demand significantly"""
        year = date.year
        # Approximate Ramadan dates (Islamic calendar shifts ~11 days/year)
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7)
        }
        if year in ramadan_starts:
            start_month, start_day = ramadan_starts[year]
            ramadan_start = datetime(year, start_month, start_day)
            ramadan_end = ramadan_start + timedelta(days=29)
            return ramadan_start <= date <= ramadan_end
        return False
    
    def get_hajj_flag(date):
        """Hajj season increases demand"""
        year = date.year
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5
        }
        if year in hajj_months:
            return date.month == hajj_months[year]
        return False
    
    df_time["is_ramadan"] = df_time["date"].apply(get_ramadan_flag)
    df_time["is_hajj"] = df_time["date"].apply(get_hajj_flag)
    df_time["is_eid"] = df_time["is_ramadan"] | df_time["is_hajj"]
    
    return df_time

# ---------------------------------------------
# 2️⃣ SKU MASTER (MC4 Products - Arabian Context)
# ---------------------------------------------
def generate_sku_master():
    """Generate SKU master with MC4 product names"""
    sku_master = pd.DataFrame([
        ["SKU001", "FOOM Superior Flour 45kg", 45, "Superior", "FOOM"],
        ["SKU002", "FOOM Superior Flour 10kg", 10, "Superior", "FOOM"],
        ["SKU003", "FOOM Superior Flour 1kg", 1, "Superior", "FOOM"],
        ["SKU004", "FOOM Bakery Flour 45kg", 45, "Bakery", "FOOM"],
        ["SKU005", "FOOM Bakery Flour 10kg", 10, "Bakery", "FOOM"],
        ["SKU006", "FOOM Patent Flour 45kg", 45, "Patent", "FOOM"],
        ["SKU007", "FOOM Patent Flour 10kg", 10, "Patent", "FOOM"],
        ["SKU008", "FOOM Brown Flour 45kg", 45, "Brown", "FOOM"],
        ["SKU009", "FOOM Brown Flour 10kg", 10, "Brown", "FOOM"],
        ["SKU010", "FOOM Superior Brown Flour 45kg", 45, "Superior Brown", "FOOM"],
        ["SKU011", "Miller Superior Flour 45kg", 45, "Superior", "Miller"],
        ["SKU012", "Miller Superior Flour 10kg", 10, "Superior", "Miller"],
        ["SKU013", "Miller Bakery Flour 45kg", 45, "Bakery", "Miller"],
        ["SKU014", "Miller Bakery Flour 10kg", 10, "Bakery", "Miller"],
    ], columns=["sku_id", "sku_name", "pack_size_kg", "flour_type", "brand"])
    
    return sku_master

# ---------------------------------------------
# 3️⃣ RECIPE MASTER (MC4 Recipes)
# ---------------------------------------------
def generate_recipe_master():
    """Generate recipe master with production rates"""
    recipe_master = pd.DataFrame([
        ["R1", "80/70 Blend", "Superior", 10.5, 1.05, "High quality, slower"],
        ["R2", "80 Straight", "Superior", 12.0, 1.10, "Faster, higher cost"],
        ["R2", "80 Straight", "Bakery", 12.0, 1.10, "Faster, higher cost"],
        ["R2", "80 Straight", "Patent", 12.0, 1.10, "Faster, higher cost"],
        ["R3", "Brown Recipe", "Brown", 8.5, 1.00, "Standard brown"],
        ["R3", "Brown Recipe", "Superior Brown", 8.5, 1.00, "Standard brown"],
        ["R4", "Standard Blend", "Bakery", 11.0, 1.02, "Balanced"],
        ["R5", "Premium Blend", "Patent", 9.5, 1.08, "Premium quality"],
    ], columns=["recipe_id", "recipe_name", "flour_type", "tons_per_hour", "cost_index", "notes"])
    
    return recipe_master

# ---------------------------------------------
# 4️⃣ RECIPE ALLOCATION RULES
# ---------------------------------------------
def generate_recipe_allocation():
    """Generate recipe allocation rules (which recipes can produce which flour)"""
    recipe_allocation = pd.DataFrame([
        ["Superior", "R1", 0.60, "Primary recipe for Superior"],
        ["Superior", "R2", 0.40, "Alternative recipe"],
        ["Bakery", "R2", 0.50, "Primary recipe"],
        ["Bakery", "R4", 0.50, "Alternative recipe"],
        ["Patent", "R2", 0.70, "Primary recipe"],
        ["Patent", "R5", 0.30, "Premium alternative"],
        ["Brown", "R3", 1.00, "Only recipe"],
        ["Superior Brown", "R3", 1.00, "Only recipe"],
    ], columns=["flour_type", "recipe_id", "allocation_pct", "notes"])
    
    return recipe_allocation

# ---------------------------------------------
# 5️⃣ MILL MASTER (MC4 Mills - Dammam, Medina, Al-Kharj)
# ---------------------------------------------
def generate_mill_master():
    """Generate mill master based on MC4 actual mills"""
    mill_master = pd.DataFrame([
        ["M1", "Dammam Mill", "Eastern Region", 8, 5, 20, 240, 1350, 80000],
        ["M2", "Medina Mill", "Medina", 8, 5, 20, 240, 1200, 60000],
        ["M3", "Al-Kharj Mill", "Central Region", 8, 5, 20, 240, 600, 10000],
    ], columns=["mill_id", "mill_name", "region", "hours_per_day", "days_per_week", 
                "days_per_month", "days_per_year", "daily_capacity_tons", "silo_capacity_tons"])
    
    return mill_master

# ---------------------------------------------
# 6️⃣ RAW MATERIAL (Wheat by Country)
# ---------------------------------------------
def generate_raw_material(time_dim):
    """Generate raw material prices by country with seasonality"""
    countries = ["Saudi Arabia", "Egypt", "Pakistan", "Turkey", "Australia", "Canada"]
    
    raw_material_list = []
    for _, row in time_dim.iterrows():
        date = row["date"]
        for country in countries:
            # Base price varies by country
            base_prices = {
                "Saudi Arabia": 220,
                "Egypt": 210,
                "Pakistan": 200,
                "Turkey": 215,
                "Australia": 250,
                "Canada": 260
            }
            base = base_prices[country]
            
            # Seasonal variation
            day_of_year = date.timetuple().tm_yday
            seasonal = 10 * np.sin(2 * np.pi * day_of_year / 365)
            
            # Ramadan/Hajj price spike
            price_spike = 15 if row["is_ramadan"] else (10 if row["is_hajj"] else 0)
            
            # Random variation
            noise = np.random.normal(0, 8)
            
            wheat_price = base + seasonal + price_spike + noise
            wheat_price = max(180, min(300, wheat_price))  # Reasonable bounds
            
            raw_material_list.append({
                "date": date,
                "country": country,
                "wheat_price_sar_per_ton": round(wheat_price, 2),
                "availability_tons": np.random.randint(5000, 50000)
            })
    
    return pd.DataFrame(raw_material_list)

# ---------------------------------------------
# 7️⃣ SKU FORECAST (With Seasonality)
# ---------------------------------------------
def generate_sku_forecast(time_dim, sku_master):
    """Generate SKU forecasts with realistic seasonality"""
    forecasts = []
    
    # Base demand by SKU (tons per day)
    base_demand = {
        "SKU001": 35, "SKU002": 25, "SKU003": 8,
        "SKU004": 30, "SKU005": 20, "SKU006": 28,
        "SKU007": 18, "SKU008": 15, "SKU009": 12,
        "SKU010": 10, "SKU011": 20, "SKU012": 15,
        "SKU013": 18, "SKU014": 12
    }
    
    for _, time_row in time_dim.iterrows():
        date = date = time_row["date"]
        day_of_year = date.timetuple().tm_yday
        
        for _, sku_row in sku_master.iterrows():
            sku_id = sku_row["sku_id"]
            base = base_demand.get(sku_id, 15)
            
            # Annual seasonality
            annual_season = 0.15 * np.sin(2 * np.pi * day_of_year / 365)
            
            # Ramadan/Hajj spike (2-3x demand)
            ramadan_multiplier = 2.5 if time_row["is_ramadan"] else 1.0
            hajj_multiplier = 1.8 if time_row["is_hajj"] else 1.0
            eid_multiplier = max(ramadan_multiplier, hajj_multiplier)
            
            # Weekend effect (lower demand)
            weekend_effect = 0.85 if time_row["is_weekend"] else 1.0
            
            # Long-term trend (slight growth)
            years_from_start = (date - datetime(2020, 1, 1)).days / 365.0
            trend = 1.0 + 0.03 * years_from_start  # 3% annual growth
            
            # Random noise
            noise = np.random.normal(0, 0.1)
            
            # Calculate forecast
            forecast_tons = base * (1 + annual_season) * eid_multiplier * weekend_effect * trend * (1 + noise)
            forecast_tons = max(0, forecast_tons)
            
            forecasts.append({
                "date": date,
                "sku_id": sku_id,
                "forecast_tons": round(forecast_tons, 2),
                "confidence_level": round(np.random.uniform(0.75, 0.95), 2)
            })
    
    return pd.DataFrame(forecasts)

# ---------------------------------------------
# 8️⃣ DATA TRANSFORMATIONS (SKU → Flour → Recipe → Time)
# ---------------------------------------------
def generate_derived_tables(sku_forecast, sku_master, recipe_allocation, recipe_master, mill_master, time_dim):
    """Generate all derived planning tables"""
    
    # A) SKU → Flour Demand
    sku_flour = sku_forecast.merge(sku_master, on="sku_id")
    flour_demand = sku_flour.groupby(["date", "flour_type"])["forecast_tons"].sum().reset_index()
    flour_demand.rename(columns={"forecast_tons": "required_tons"}, inplace=True)
    
    # B) Flour → Recipe Demand
    recipe_demand = flour_demand.merge(recipe_allocation, on="flour_type")
    recipe_demand["recipe_tons"] = recipe_demand["required_tons"] * recipe_demand["allocation_pct"]
    
    # C) Recipe → Time Requirement
    recipe_time = recipe_demand.merge(recipe_master, on=["recipe_id", "flour_type"])
    recipe_time["required_hours"] = recipe_time["recipe_tons"] / recipe_time["tons_per_hour"]
    recipe_time = recipe_time[["date", "recipe_id", "recipe_name", "flour_type", 
                               "required_hours", "recipe_tons", "cost_index"]].copy()
    
    # D) Mill Capacity (with maintenance windows)
    mill_capacity_list = []
    for _, mill_row in mill_master.iterrows():
        for _, time_row in time_dim.iterrows():
            date = time_row["date"]
            mill_id = mill_row["mill_id"]
            
            # Base capacity
            base_hours = mill_row["hours_per_day"]
            
            # Maintenance (random days, ~5% of time)
            is_maintenance = np.random.random() < 0.05
            available_hours = 0 if is_maintenance else base_hours
            
            # Holiday effect
            if time_row["is_weekend"]:
                available_hours = 0  # No weekend operations
            
            mill_capacity_list.append({
                "date": date,
                "mill_id": mill_id,
                "available_hours": available_hours,
                "is_maintenance": is_maintenance
            })
    
    mill_capacity = pd.DataFrame(mill_capacity_list)
    
    # E) Mill Load (aggregate recipe time to mills)
    # Simple allocation: distribute recipe time across mills
    recipe_time_agg = recipe_time.groupby(["date", "recipe_id"])["required_hours"].sum().reset_index()
    
    mill_load_list = []
    for _, time_row in time_dim.iterrows():
        date = time_row["date"]
        daily_recipe_time = recipe_time_agg[recipe_time_agg["date"] == date]
        
        for _, mill_row in mill_master.iterrows():
            mill_id = mill_row["mill_id"]
            mill_cap = mill_capacity[(mill_capacity["date"] == date) & 
                                     (mill_capacity["mill_id"] == mill_id)]["available_hours"].values
            available = mill_cap[0] if len(mill_cap) > 0 else 0
            
            # Distribute recipe time (simplified - in reality would be optimized)
            total_required = daily_recipe_time["required_hours"].sum()
            allocated = min(total_required / len(mill_master), available * 1.1)  # Allow slight overload
            
            mill_load_list.append({
                "date": date,
                "mill_id": mill_id,
                "required_hours": round(allocated, 2),
                "available_hours": available
            })
    
    mill_load = pd.DataFrame(mill_load_list)
    mill_load["overload_hours"] = mill_load["required_hours"] - mill_load["available_hours"]
    mill_load["utilization_pct"] = (mill_load["required_hours"] / mill_load["available_hours"] * 100).round(2)
    mill_load["utilization_pct"] = mill_load["utilization_pct"].replace([np.inf, -np.inf], 0)
    
    return flour_demand, recipe_demand, recipe_time, mill_capacity, mill_load

# ---------------------------------------------
# 9️⃣ MAIN GENERATION FUNCTION
# ---------------------------------------------
def generate_all_data(output_dir="datasets"):
    """Generate all synthetic data files"""
    os.makedirs(output_dir, exist_ok=True)
    
    print("🔄 Generating time dimension...")
    time_dim = generate_time_dimension()
    time_dim.to_csv(f"{output_dir}/time_dimension.csv", index=False)
    
    print("🔄 Generating SKU master...")
    sku_master = generate_sku_master()
    sku_master.to_csv(f"{output_dir}/sku_master.csv", index=False)
    
    print("🔄 Generating recipe master...")
    recipe_master = generate_recipe_master()
    recipe_master.to_csv(f"{output_dir}/recipe_master.csv", index=False)
    
    print("🔄 Generating recipe allocation...")
    recipe_allocation = generate_recipe_allocation()
    recipe_allocation.to_csv(f"{output_dir}/recipe_allocation.csv", index=False)
    
    print("🔄 Generating mill master...")
    mill_master = generate_mill_master()
    mill_master.to_csv(f"{output_dir}/mill_master.csv", index=False)
    
    print("🔄 Generating raw material data...")
    raw_material = generate_raw_material(time_dim)
    raw_material.to_csv(f"{output_dir}/raw_material.csv", index=False)
    
    print("🔄 Generating SKU forecasts (this may take a while)...")
    sku_forecast = generate_sku_forecast(time_dim, sku_master)
    sku_forecast.to_csv(f"{output_dir}/sku_forecast.csv", index=False)
    
    print("🔄 Generating derived planning tables...")
    flour_demand, recipe_demand, recipe_time, mill_capacity, mill_load = generate_derived_tables(
        sku_forecast, sku_master, recipe_allocation, recipe_master, mill_master, time_dim
    )
    
    flour_demand.to_csv(f"{output_dir}/flour_demand.csv", index=False)
    recipe_demand.to_csv(f"{output_dir}/recipe_demand.csv", index=False)
    recipe_time.to_csv(f"{output_dir}/recipe_time.csv", index=False)
    mill_capacity.to_csv(f"{output_dir}/mill_capacity.csv", index=False)
    mill_load.to_csv(f"{output_dir}/mill_load.csv", index=False)
    
    # Generate aggregated views for different horizons
    print("🔄 Generating weekly/monthly/yearly aggregations...")
    
    # Weekly
    recipe_time_weekly = recipe_time.copy()
    recipe_time_weekly["week"] = pd.to_datetime(recipe_time_weekly["date"]).dt.isocalendar().year.astype(str) + "-W" + pd.to_datetime(recipe_time_weekly["date"]).dt.isocalendar().week.astype(str).str.zfill(2)
    recipe_time_weekly = recipe_time_weekly.groupby(["week", "recipe_id", "recipe_name"])["required_hours"].sum().reset_index()
    recipe_time_weekly.to_csv(f"{output_dir}/recipe_time_weekly.csv", index=False)
    
    # Monthly
    recipe_time_monthly = recipe_time.copy()
    recipe_time_monthly["month"] = pd.to_datetime(recipe_time_monthly["date"]).dt.to_period("M").astype(str)
    recipe_time_monthly = recipe_time_monthly.groupby(["month", "recipe_id", "recipe_name"])["required_hours"].sum().reset_index()
    recipe_time_monthly.to_csv(f"{output_dir}/recipe_time_monthly.csv", index=False)
    
    # Yearly
    recipe_time_yearly = recipe_time.copy()
    recipe_time_yearly["year"] = pd.to_datetime(recipe_time_yearly["date"]).dt.year
    recipe_time_yearly = recipe_time_yearly.groupby(["year", "recipe_id", "recipe_name"])["required_hours"].sum().reset_index()
    recipe_time_yearly.to_csv(f"{output_dir}/recipe_time_yearly.csv", index=False)
    
    print("✅ All data generated successfully!")
    print(f"📁 Output directory: {output_dir}")
    print(f"📊 Total records generated:")
    print(f"   - Time dimension: {len(time_dim)}")
    print(f"   - SKU forecasts: {len(sku_forecast)}")
    print(f"   - Recipe time: {len(recipe_time)}")
    print(f"   - Raw material: {len(raw_material)}")

if __name__ == "__main__":
    generate_all_data()
