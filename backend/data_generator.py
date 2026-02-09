"""
MC4 Synthetic Data Generator (v2 - Business Truth Aligned)
Generates realistic flour milling data with Arabian context, seasonality,
bulk flour buffering, recipe scheduling per mill, and changeovers.

Core truth: One mill can run only ONE recipe at a time.
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
# 1️⃣ TIME DIMENSION
# ---------------------------------------------
def generate_time_dimension():
    start_date = "2020-01-01"
    end_date = "2026-02-10"
    dates = pd.date_range(start_date, end_date, freq="D")

    df_time = pd.DataFrame({"date": dates})
    df_time["week"] = (
        df_time["date"].dt.isocalendar().year.astype(str)
        + "-W"
        + df_time["date"].dt.isocalendar().week.astype(str).str.zfill(2)
    )
    df_time["month"] = df_time["date"].dt.to_period("M").astype(str)
    df_time["year"] = df_time["date"].dt.year
    df_time["quarter"] = df_time["date"].dt.quarter
    df_time["day_of_week"] = df_time["date"].dt.dayofweek
    df_time["is_weekend"] = df_time["day_of_week"].isin([4, 5])  # Fri, Sat

    # Ramadan approximation
    def get_ramadan_flag(date):
        ramadan_starts = {
            2020: (4, 24), 2021: (4, 13), 2022: (4, 2), 2023: (3, 23),
            2024: (3, 11), 2025: (3, 1), 2026: (2, 18), 2027: (2, 7)
        }
        if date.year in ramadan_starts:
            m, d = ramadan_starts[date.year]
            start = datetime(date.year, m, d)
            end = start + timedelta(days=29)
            return start <= date <= end
        return False

    def get_hajj_flag(date):
        hajj_months = {
            2020: 7, 2021: 7, 2022: 7, 2023: 6,
            2024: 6, 2025: 6, 2026: 5, 2027: 5
        }
        return date.year in hajj_months and date.month == hajj_months[date.year]

    df_time["is_ramadan"] = df_time["date"].apply(get_ramadan_flag)
    df_time["is_hajj"] = df_time["date"].apply(get_hajj_flag)
    df_time["is_eid"] = df_time["is_ramadan"] | df_time["is_hajj"]

    return df_time


# ---------------------------------------------
# 2️⃣ SKU MASTER
# ---------------------------------------------
def generate_sku_master():
    return pd.DataFrame([
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


# ---------------------------------------------
# 3️⃣ RECIPE MASTER (Unique IDs)
# ---------------------------------------------
def generate_recipe_master():
    return pd.DataFrame([
        ["R1", "80/70 Blend", 10.5, 1.05, "High quality, slower"],
        ["R2", "80 Straight", 12.0, 1.10, "Faster, higher cost"],
        ["R3", "Brown Recipe", 8.5, 1.00, "Standard brown"],
        ["R4", "Standard Blend", 11.0, 1.02, "Balanced bakery blend"],
        ["R5", "Premium Blend", 9.5, 1.08, "Premium patent blend"],
    ], columns=["recipe_id", "recipe_name", "base_tons_per_hour", "cost_index", "notes"])


# ---------------------------------------------
# 4️⃣ FLOUR ↔ RECIPE ELIGIBILITY (Matrix)
# ---------------------------------------------
def generate_recipe_eligibility():
    return pd.DataFrame([
        ["Superior", "R1", 0.60],
        ["Superior", "R2", 0.40],
        ["Bakery", "R2", 0.50],
        ["Bakery", "R4", 0.50],
        ["Patent", "R2", 0.70],
        ["Patent", "R5", 0.30],
        ["Brown", "R3", 1.00],
        ["Superior Brown", "R3", 1.00],
    ], columns=["flour_type", "recipe_id", "default_allocation_pct"])


# ---------------------------------------------
# 5️⃣ MILL MASTER
# ---------------------------------------------
def generate_mill_master():
    return pd.DataFrame([
        ["M1", "Dammam Mill", "Eastern Region", 20, 1350, 80000],
        ["M2", "Medina Mill", "Medina", 20, 1200, 60000],
        ["M3", "Al-Kharj Mill", "Central Region", 18, 600, 10000],
    ], columns=["mill_id", "mill_name", "region", "hours_per_day", "daily_capacity_tons", "silo_capacity_tons"])


# ---------------------------------------------
# 6️⃣ MILL ↔ RECIPE RATES (Important!)
# ---------------------------------------------
def generate_mill_recipe_rates(mill_master, recipe_master):
    rows = []
    for _, mill in mill_master.iterrows():
        for _, recipe in recipe_master.iterrows():
            # each mill differs slightly in throughput
            variation = np.random.uniform(0.90, 1.10)
            tph = recipe["base_tons_per_hour"] * variation

            rows.append({
                "mill_id": mill["mill_id"],
                "recipe_id": recipe["recipe_id"],
                "tons_per_hour": round(tph, 2)
            })
    return pd.DataFrame(rows)


# ---------------------------------------------
# 7️⃣ RAW MATERIAL (Wheat by Country)
# ---------------------------------------------
def generate_raw_material(time_dim):
    countries = ["Saudi Arabia", "Egypt", "Pakistan", "Turkey", "Australia", "Canada"]
    base_prices = {
        "Saudi Arabia": 220,
        "Egypt": 210,
        "Pakistan": 200,
        "Turkey": 215,
        "Australia": 250,
        "Canada": 260
    }

    raw_material_list = []
    for _, row in time_dim.iterrows():
        date = row["date"]
        day_of_year = date.timetuple().tm_yday

        for country in countries:
            base = base_prices[country]
            seasonal = 10 * np.sin(2 * np.pi * day_of_year / 365)
            spike = 15 if row["is_ramadan"] else (10 if row["is_hajj"] else 0)
            noise = np.random.normal(0, 8)

            wheat_price = max(180, min(300, base + seasonal + spike + noise))

            raw_material_list.append({
                "date": date,
                "country": country,
                "wheat_price_sar_per_ton": round(wheat_price, 2),
                "availability_tons": np.random.randint(5000, 50000)
            })

    return pd.DataFrame(raw_material_list)


# ---------------------------------------------
# 8️⃣ SKU FORECAST
# ---------------------------------------------
def generate_sku_forecast(time_dim, sku_master):
    forecasts = []

    base_demand = {
        "SKU001": 35, "SKU002": 25, "SKU003": 8,
        "SKU004": 30, "SKU005": 20, "SKU006": 28,
        "SKU007": 18, "SKU008": 15, "SKU009": 12,
        "SKU010": 10, "SKU011": 20, "SKU012": 15,
        "SKU013": 18, "SKU014": 12
    }

    for _, time_row in time_dim.iterrows():
        date = time_row["date"]
        day_of_year = date.timetuple().tm_yday

        for _, sku_row in sku_master.iterrows():
            sku_id = sku_row["sku_id"]
            base = base_demand.get(sku_id, 15)

            annual_season = 0.15 * np.sin(2 * np.pi * day_of_year / 365)

            ramadan_multiplier = 2.5 if time_row["is_ramadan"] else 1.0
            hajj_multiplier = 1.8 if time_row["is_hajj"] else 1.0
            eid_multiplier = max(ramadan_multiplier, hajj_multiplier)

            weekend_effect = 0.90 if time_row["is_weekend"] else 1.0

            years_from_start = (date - datetime(2020, 1, 1)).days / 365.0
            trend = 1.0 + 0.03 * years_from_start

            noise = np.random.normal(0, 0.08)

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
# 9️⃣ BULK FLOUR INVENTORY LAYER
# ---------------------------------------------
def generate_bulk_flour_demand(sku_forecast, sku_master):
    sku_flour = sku_forecast.merge(sku_master, on="sku_id")
    bulk_flour_demand = sku_flour.groupby(["date", "flour_type"])["forecast_tons"].sum().reset_index()
    bulk_flour_demand.rename(columns={"forecast_tons": "required_bulk_tons"}, inplace=True)
    return bulk_flour_demand


# ---------------------------------------------
# 🔟 DYNAMIC RECIPE MIX (Seasonality-driven)
# ---------------------------------------------
def compute_dynamic_recipe_mix(time_dim, recipe_eligibility):
    """
    Returns recipe mix per flour type per day.
    During Ramadan: favor faster recipes (R2) for Superior/Patent.
    """
    mix_rows = []

    for _, row in time_dim.iterrows():
        date = row["date"]

        for flour_type in recipe_eligibility["flour_type"].unique():
            eligible = recipe_eligibility[recipe_eligibility["flour_type"] == flour_type].copy()

            # Start from default allocation
            eligible["allocation_pct"] = eligible["default_allocation_pct"]

            if row["is_ramadan"] and flour_type in ["Superior", "Patent"]:
                # Shift 15% demand to R2 (faster)
                if "R2" in eligible["recipe_id"].values:
                    eligible.loc[eligible["recipe_id"] == "R2", "allocation_pct"] += 0.15
                    eligible["allocation_pct"] = eligible["allocation_pct"] / eligible["allocation_pct"].sum()

            if row["is_hajj"] and flour_type in ["Bakery"]:
                # Slightly favor R4 during Hajj
                if "R4" in eligible["recipe_id"].values:
                    eligible.loc[eligible["recipe_id"] == "R4", "allocation_pct"] += 0.10
                    eligible["allocation_pct"] = eligible["allocation_pct"] / eligible["allocation_pct"].sum()

            for _, r in eligible.iterrows():
                mix_rows.append({
                    "date": date,
                    "flour_type": flour_type,
                    "recipe_id": r["recipe_id"],
                    "allocation_pct": round(r["allocation_pct"], 4)
                })

    return pd.DataFrame(mix_rows)


# ---------------------------------------------
# 1️⃣1️⃣ BULK FLOUR → RECIPE DEMAND
# ---------------------------------------------
def generate_recipe_demand(bulk_flour_demand, recipe_mix):
    recipe_demand = bulk_flour_demand.merge(recipe_mix, on=["date", "flour_type"])
    recipe_demand["recipe_required_tons"] = recipe_demand["required_bulk_tons"] * recipe_demand["allocation_pct"]

    return recipe_demand[["date", "flour_type", "recipe_id", "allocation_pct", "recipe_required_tons"]]


# ---------------------------------------------
# 1️⃣2️⃣ MILL CAPACITY (Realistic)
# ---------------------------------------------
def generate_mill_capacity(time_dim, mill_master):
    rows = []

    for _, mill in mill_master.iterrows():
        for _, t in time_dim.iterrows():
            date = t["date"]

            base_hours = mill["hours_per_day"]

            # Maintenance 4% probability
            is_maintenance = np.random.random() < 0.04

            # Weekends run reduced hours, not zero
            if t["is_weekend"]:
                base_hours = base_hours * 0.70

            available_hours = 0 if is_maintenance else base_hours

            rows.append({
                "date": date,
                "mill_id": mill["mill_id"],
                "available_hours": round(available_hours, 2),
                "is_maintenance": is_maintenance
            })

    return pd.DataFrame(rows)


# ---------------------------------------------
# 1️⃣3️⃣ MILL SCHEDULER (Gantt-ready)
# ---------------------------------------------
def generate_mill_recipe_schedule(recipe_demand, mill_capacity, mill_recipe_rates, recipe_master):
    """
    Produces a realistic schedule table:
    date, mill_id, recipe_id, start_hour, end_hour, duration_hours,
    tons_produced, changeover_hours
    """

    schedule_rows = []
    changeover_penalty = 0.5  # hours lost when switching recipes

    recipe_daily = recipe_demand.groupby(["date", "recipe_id"])["recipe_required_tons"].sum().reset_index()

    # Map recipe -> base cost index
    recipe_cost = recipe_master.set_index("recipe_id")["cost_index"].to_dict()

    for date in recipe_daily["date"].unique():
        day_recipes = recipe_daily[recipe_daily["date"] == date].copy()

        # Sort recipes by tons required (biggest first)
        day_recipes = day_recipes.sort_values("recipe_required_tons", ascending=False)

        for mill_id in mill_capacity["mill_id"].unique():
            cap_row = mill_capacity[(mill_capacity["date"] == date) & (mill_capacity["mill_id"] == mill_id)]
            if cap_row.empty:
                continue

            available_hours = float(cap_row["available_hours"].iloc[0])
            current_hour = 0.0
            prev_recipe = None

            for _, rec in day_recipes.iterrows():
                recipe_id = rec["recipe_id"]
                required_tons = rec["recipe_required_tons"]

                rate_row = mill_recipe_rates[
                    (mill_recipe_rates["mill_id"] == mill_id) &
                    (mill_recipe_rates["recipe_id"] == recipe_id)
                ]
                tph = float(rate_row["tons_per_hour"].iloc[0])

                # compute hours needed
                hours_needed = required_tons / tph

                # apply changeover if switching recipe
                changeover = 0
                if prev_recipe is not None and prev_recipe != recipe_id:
                    changeover = changeover_penalty

                # if no capacity left, stop scheduling
                if current_hour + changeover >= available_hours:
                    break

                remaining = available_hours - current_hour - changeover
                actual_hours = min(hours_needed, remaining)

                if actual_hours <= 0:
                    continue

                tons_produced = actual_hours * tph

                schedule_rows.append({
                    "date": date,
                    "mill_id": mill_id,
                    "recipe_id": recipe_id,
                    "start_hour": round(current_hour + changeover, 2),
                    "end_hour": round(current_hour + changeover + actual_hours, 2),
                    "duration_hours": round(actual_hours, 2),
                    "changeover_hours": round(changeover, 2),
                    "tons_produced": round(tons_produced, 2),
                    "recipe_cost_index": recipe_cost.get(recipe_id, 1.0)
                })

                current_hour += changeover + actual_hours
                prev_recipe = recipe_id

                if current_hour >= available_hours:
                    break

    return pd.DataFrame(schedule_rows)


# ---------------------------------------------
# 1️⃣4️⃣ MILL LOAD (derived from schedule)
# ---------------------------------------------
def generate_mill_load(mill_schedule, mill_capacity):
    daily_load = mill_schedule.groupby(["date", "mill_id"])["duration_hours"].sum().reset_index()
    daily_load.rename(columns={"duration_hours": "scheduled_hours"}, inplace=True)

    mill_load = daily_load.merge(mill_capacity, on=["date", "mill_id"], how="left")
    mill_load["overload_hours"] = mill_load["scheduled_hours"] - mill_load["available_hours"]

    mill_load["utilization_pct"] = np.where(
        mill_load["available_hours"] > 0,
        (mill_load["scheduled_hours"] / mill_load["available_hours"]) * 100,
        np.where(mill_load["scheduled_hours"] > 0, 999, 0)
    )

    mill_load["utilization_pct"] = mill_load["utilization_pct"].round(2)

    return mill_load


# ---------------------------------------------
# 1️⃣5️⃣ MAIN GENERATION FUNCTION
# ---------------------------------------------
def generate_all_data(output_dir="datasets"):
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

    print("🔄 Generating recipe eligibility...")
    recipe_eligibility = generate_recipe_eligibility()
    recipe_eligibility.to_csv(f"{output_dir}/recipe_eligibility.csv", index=False)

    print("🔄 Generating mill master...")
    mill_master = generate_mill_master()
    mill_master.to_csv(f"{output_dir}/mill_master.csv", index=False)

    print("🔄 Generating mill recipe rates...")
    mill_recipe_rates = generate_mill_recipe_rates(mill_master, recipe_master)
    mill_recipe_rates.to_csv(f"{output_dir}/mill_recipe_rates.csv", index=False)

    print("🔄 Generating raw material data...")
    raw_material = generate_raw_material(time_dim)
    raw_material.to_csv(f"{output_dir}/raw_material.csv", index=False)

    print("🔄 Generating SKU forecasts...")
    sku_forecast = generate_sku_forecast(time_dim, sku_master)
    sku_forecast.to_csv(f"{output_dir}/sku_forecast.csv", index=False)

    print("🔄 Generating bulk flour demand...")
    bulk_flour_demand = generate_bulk_flour_demand(sku_forecast, sku_master)
    bulk_flour_demand.to_csv(f"{output_dir}/bulk_flour_demand.csv", index=False)

    print("🔄 Computing dynamic recipe mix...")
    recipe_mix = compute_dynamic_recipe_mix(time_dim, recipe_eligibility)
    recipe_mix.to_csv(f"{output_dir}/recipe_mix.csv", index=False)

    print("🔄 Generating recipe demand...")
    recipe_demand = generate_recipe_demand(bulk_flour_demand, recipe_mix)
    recipe_demand.to_csv(f"{output_dir}/recipe_demand.csv", index=False)

    print("🔄 Generating mill capacity...")
    mill_capacity = generate_mill_capacity(time_dim, mill_master)
    mill_capacity.to_csv(f"{output_dir}/mill_capacity.csv", index=False)

    print("🔄 Generating mill recipe schedule (Gantt-ready)...")
    mill_schedule = generate_mill_recipe_schedule(
        recipe_demand, mill_capacity, mill_recipe_rates, recipe_master
    )
    mill_schedule.to_csv(f"{output_dir}/mill_recipe_schedule.csv", index=False)

    print("🔄 Generating mill load...")
    mill_load = generate_mill_load(mill_schedule, mill_capacity)
    mill_load.to_csv(f"{output_dir}/mill_load.csv", index=False)

    # Aggregations
    print("🔄 Generating weekly/monthly/yearly aggregations...")

    mill_load_weekly = mill_load.copy()
    mill_load_weekly["week"] = pd.to_datetime(mill_load_weekly["date"]).dt.isocalendar().year.astype(str) + "-W" + pd.to_datetime(mill_load_weekly["date"]).dt.isocalendar().week.astype(str).str.zfill(2)
    mill_load_weekly = mill_load_weekly.groupby(["week", "mill_id"])[["scheduled_hours", "available_hours", "overload_hours"]].sum().reset_index()
    mill_load_weekly.to_csv(f"{output_dir}/mill_load_weekly.csv", index=False)

    mill_load_monthly = mill_load.copy()
    mill_load_monthly["month"] = pd.to_datetime(mill_load_monthly["date"]).dt.to_period("M").astype(str)
    mill_load_monthly = mill_load_monthly.groupby(["month", "mill_id"])[["scheduled_hours", "available_hours", "overload_hours"]].sum().reset_index()
    mill_load_monthly.to_csv(f"{output_dir}/mill_load_monthly.csv", index=False)

    mill_load_yearly = mill_load.copy()
    mill_load_yearly["year"] = pd.to_datetime(mill_load_yearly["date"]).dt.year
    mill_load_yearly = mill_load_yearly.groupby(["year", "mill_id"])[["scheduled_hours", "available_hours", "overload_hours"]].sum().reset_index()
    mill_load_yearly.to_csv(f"{output_dir}/mill_load_yearly.csv", index=False)

    print("✅ All MC4 synthetic data generated successfully!")
    print(f"📁 Output directory: {output_dir}")
    print(f"📊 Summary:")
    print(f"   - Time dimension: {len(time_dim)}")
    print(f"   - SKU forecasts: {len(sku_forecast)}")
    print(f"   - Bulk flour demand: {len(bulk_flour_demand)}")
    print(f"   - Recipe demand: {len(recipe_demand)}")
    print(f"   - Mill schedule rows: {len(mill_schedule)}")
    print(f"   - Mill load rows: {len(mill_load)}")


if __name__ == "__main__":
    generate_all_data()
