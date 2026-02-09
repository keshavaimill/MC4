"""
MC4 FastAPI Server (Updated for MC4 Synthetic Generator v2)
Backend API for MC4 Forecasting and Planning System
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import numpy as np
from datetime import datetime
import os
import sys

# Add parent directory to path for Text2SQL import
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import Text2SQL chatbot
try:
    text2sql_path = os.path.join(parent_dir, "Text2SQL_V2")
    if text2sql_path not in sys.path:
        sys.path.insert(0, text2sql_path)
    from chatbot_api import run_chatbot_query
    CHATBOT_AVAILABLE = True
except ImportError as e:
    print(f"⚠️ Text2SQL chatbot not available: {e}")
    CHATBOT_AVAILABLE = False

app = FastAPI(title="MC4 Forecasting API", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global data paths
DATA_DIR = "datasets"
MODEL_DIR = "models"

# Load data on startup
data_cache = {}

def load_data():
    """Load all data files into cache"""
    global data_cache
    try:
        data_cache = {
            "time_dimension": pd.read_csv(f"{DATA_DIR}/time_dimension.csv"),
            "sku_master": pd.read_csv(f"{DATA_DIR}/sku_master.csv"),
            "recipe_master": pd.read_csv(f"{DATA_DIR}/recipe_master.csv"),
            "recipe_eligibility": pd.read_csv(f"{DATA_DIR}/recipe_eligibility.csv"),
            "recipe_mix": pd.read_csv(f"{DATA_DIR}/recipe_mix.csv"),
            "mill_master": pd.read_csv(f"{DATA_DIR}/mill_master.csv"),
            "mill_recipe_rates": pd.read_csv(f"{DATA_DIR}/mill_recipe_rates.csv"),
            "raw_material": pd.read_csv(f"{DATA_DIR}/raw_material.csv"),
            "sku_forecast": pd.read_csv(f"{DATA_DIR}/sku_forecast.csv"),
            "bulk_flour_demand": pd.read_csv(f"{DATA_DIR}/bulk_flour_demand.csv"),
            "recipe_demand": pd.read_csv(f"{DATA_DIR}/recipe_demand.csv"),
            "mill_capacity": pd.read_csv(f"{DATA_DIR}/mill_capacity.csv"),
            "mill_recipe_schedule": pd.read_csv(f"{DATA_DIR}/mill_recipe_schedule.csv"),
            "mill_load": pd.read_csv(f"{DATA_DIR}/mill_load.csv"),
        }
        print("✅ Data loaded successfully (MC4 v2)")
    except Exception as e:
        print(f"⚠️ Error loading data: {str(e)}")
        data_cache = {}

@app.on_event("startup")
async def startup_event():
    load_data()

# ============================================
# PYDANTIC MODELS
# ============================================
class ChatbotQuery(BaseModel):
    question: str

# ============================================
# HEALTH CHECK
# ============================================
@app.get("/")
async def root():
    return {"message": "MC4 Forecasting API", "status": "running", "version": "2.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy", "data_loaded": len(data_cache) > 0}

# ============================================
# EXECUTIVE OVERVIEW KPIs
# ============================================
@app.get("/api/kpis/executive")
async def get_executive_kpis(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None
):
    """Get executive overview KPIs (demand, recipe time load, capacity, risk)"""
    try:
        # Get current period if not specified
        if not period:
            today = datetime.now()
            if horizon == "week":
                period = f"{today.year}-W{today.isocalendar()[1]:02d}"
            elif horizon == "month":
                period = today.strftime("%Y-%m")
            else:
                period = str(today.year)

        # -----------------------------
        # Demand KPI (SKU Forecast Tons)
        # -----------------------------
        sku_forecast = data_cache.get("sku_forecast", pd.DataFrame())
        current_demand = 0
        demand_growth = 0

        if not sku_forecast.empty:
            sku_forecast["date"] = pd.to_datetime(sku_forecast["date"])

            if horizon == "week":
                sku_forecast["period"] = (
                    sku_forecast["date"].dt.isocalendar().year.astype(str)
                    + "-W"
                    + sku_forecast["date"].dt.isocalendar().week.astype(str).str.zfill(2)
                )
            elif horizon == "month":
                sku_forecast["period"] = sku_forecast["date"].dt.to_period("M").astype(str)
            else:
                sku_forecast["period"] = sku_forecast["date"].dt.year.astype(str)

            current_demand = sku_forecast[sku_forecast["period"] == period]["forecast_tons"].sum()

            periods_sorted = sorted(sku_forecast["period"].unique())
            if period in periods_sorted:
                idx = periods_sorted.index(period)
                if idx > 0:
                    prev_period = periods_sorted[idx - 1]
                    prev_demand = sku_forecast[sku_forecast["period"] == prev_period]["forecast_tons"].sum()
                    demand_growth = ((current_demand - prev_demand) / prev_demand * 100) if prev_demand > 0 else 0

        # ---------------------------------------
        # Recipe Time KPI (from mill_load schedule)
        # ---------------------------------------
        mill_load = data_cache.get("mill_load", pd.DataFrame())
        required_hours = 0
        utilization = 0
        overload_mills = 0

        if not mill_load.empty:
            mill_load["date"] = pd.to_datetime(mill_load["date"])

            if horizon == "week":
                mill_load["period"] = (
                    mill_load["date"].dt.isocalendar().year.astype(str)
                    + "-W"
                    + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
                )
            elif horizon == "month":
                mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
            else:
                mill_load["period"] = mill_load["date"].dt.year.astype(str)

            period_load = mill_load[mill_load["period"] == period]

            required_hours = period_load["scheduled_hours"].sum()
            total_available = period_load["available_hours"].sum()

            utilization = (required_hours / total_available * 100) if total_available > 0 else 0
            overload_mills = len(period_load[period_load["overload_hours"] > 0]["mill_id"].unique())

        # -----------------------------
        # Risk KPI (Wheat Price Avg)
        # -----------------------------
        raw_material = data_cache.get("raw_material", pd.DataFrame())
        avg_price = 0
        price_change = 0

        if not raw_material.empty:
            raw_material["date"] = pd.to_datetime(raw_material["date"])

            if horizon == "week":
                raw_material["period"] = (
                    raw_material["date"].dt.isocalendar().year.astype(str)
                    + "-W"
                    + raw_material["date"].dt.isocalendar().week.astype(str).str.zfill(2)
                )
            elif horizon == "month":
                raw_material["period"] = raw_material["date"].dt.to_period("M").astype(str)
            else:
                raw_material["period"] = raw_material["date"].dt.year.astype(str)

            period_rm = raw_material[raw_material["period"] == period]
            avg_price = period_rm["wheat_price_sar_per_ton"].mean() if not period_rm.empty else 0

        return {
            "demand": {"total_tons": round(current_demand, 2), "growth_pct": round(demand_growth, 2)},
            "recipe_time": {"total_hours": round(required_hours, 2), "utilization_pct": round(utilization, 2)},
            "capacity": {"utilization_pct": round(utilization, 2), "overload_mills": overload_mills},
            "risk": {"avg_wheat_price": round(avg_price, 2), "price_change_pct": round(price_change, 2)}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# SKU FORECAST
# ============================================
@app.get("/api/forecast/sku")
async def get_sku_forecast(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None,
    sku_id: Optional[str] = None
):
    """Get SKU forecast aggregated by horizon"""
    try:
        sku_forecast = data_cache.get("sku_forecast", pd.DataFrame())
        if sku_forecast.empty:
            return {"data": []}

        sku_forecast["date"] = pd.to_datetime(sku_forecast["date"])

        if sku_id:
            sku_forecast = sku_forecast[sku_forecast["sku_id"] == sku_id]

        if horizon == "week":
            sku_forecast["period"] = (
                sku_forecast["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + sku_forecast["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            sku_forecast["period"] = sku_forecast["date"].dt.to_period("M").astype(str)
        else:
            sku_forecast["period"] = sku_forecast["date"].dt.year.astype(str)

        sku_master = data_cache.get("sku_master", pd.DataFrame())
        result = sku_forecast.merge(sku_master, on="sku_id", how="left")

        agg_result = result.groupby(["period", "sku_id", "sku_name", "flour_type"]).agg({
            "forecast_tons": "sum"
        }).reset_index()

        if period:
            agg_result = agg_result[agg_result["period"] == period]

        return {"data": agg_result.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# BULK FLOUR DEMAND
# ============================================
@app.get("/api/demand/bulk-flour")
async def get_bulk_flour_demand(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None,
    flour_type: Optional[str] = None
):
    """Get bulk flour demand aggregated by horizon"""
    try:
        bulk = data_cache.get("bulk_flour_demand", pd.DataFrame())
        if bulk.empty:
            return {"data": []}

        bulk["date"] = pd.to_datetime(bulk["date"])

        if flour_type:
            bulk = bulk[bulk["flour_type"].str.contains(flour_type, case=False, na=False)]

        if horizon == "week":
            bulk["period"] = (
                bulk["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + bulk["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            bulk["period"] = bulk["date"].dt.to_period("M").astype(str)
        else:
            bulk["period"] = bulk["date"].dt.year.astype(str)

        agg = bulk.groupby(["period", "flour_type"]).agg({
            "required_bulk_tons": "sum"
        }).reset_index()

        if period:
            agg = agg[agg["period"] == period]

        return {"data": agg.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# RECIPE PLANNING (from real mill schedule)
# ============================================
@app.get("/api/planning/recipe")
async def get_recipe_planning(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None
):
    """
    Recipe planning based on actual scheduled hours from mill_recipe_schedule.
    This supports the wireframe: "How many hours per recipe per month?"
    """
    try:
        schedule = data_cache.get("mill_recipe_schedule", pd.DataFrame())
        recipe_master = data_cache.get("recipe_master", pd.DataFrame())

        if schedule.empty:
            return {"data": []}

        schedule["date"] = pd.to_datetime(schedule["date"])

        if horizon == "week":
            schedule["period"] = (
                schedule["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + schedule["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            schedule["period"] = schedule["date"].dt.to_period("M").astype(str)
        else:
            schedule["period"] = schedule["date"].dt.year.astype(str)

        agg = schedule.groupby(["period", "recipe_id"]).agg({
            "duration_hours": "sum",
            "tons_produced": "sum",
            "changeover_hours": "sum"
        }).reset_index()

        agg = agg.merge(recipe_master[["recipe_id", "recipe_name", "cost_index"]], on="recipe_id", how="left")

        agg.rename(columns={
            "duration_hours": "scheduled_hours"
        }, inplace=True)

        if period:
            agg = agg[agg["period"] == period]

        return {"data": agg.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# MILL CAPACITY
# ============================================
@app.get("/api/capacity/mill")
async def get_mill_capacity(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None,
    mill_id: Optional[str] = None
):
    """Get mill capacity and load based on schedule-driven mill_load table"""
    try:
        mill_load = data_cache.get("mill_load", pd.DataFrame())
        if mill_load.empty:
            return {"data": []}

        mill_load["date"] = pd.to_datetime(mill_load["date"])

        if horizon == "week":
            mill_load["period"] = (
                mill_load["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
        else:
            mill_load["period"] = mill_load["date"].dt.year.astype(str)

        if mill_id:
            mill_load = mill_load[mill_load["mill_id"] == mill_id]

        if period:
            mill_load = mill_load[mill_load["period"] == period]

        agg_result = mill_load.groupby(["period", "mill_id"]).agg({
            "scheduled_hours": "sum",
            "available_hours": "sum",
            "overload_hours": "sum"
        }).reset_index()

        mill_master = data_cache.get("mill_master", pd.DataFrame())
        result = agg_result.merge(mill_master, on="mill_id", how="left")

        result["utilization_pct"] = np.where(
            result["available_hours"] > 0,
            (result["scheduled_hours"] / result["available_hours"] * 100).round(2),
            0
        )

        return {"data": result.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# MILL SCHEDULE (GANTT DATA)
# ============================================
@app.get("/api/capacity/mill-schedule")
async def get_mill_schedule(
    horizon: str = Query("week", pattern="^(week|month|year)$"),
    period: Optional[str] = None,
    mill_id: Optional[str] = None
):
    """Return mill recipe schedule rows (Gantt-ready)"""
    try:
        schedule = data_cache.get("mill_recipe_schedule", pd.DataFrame())
        recipe_master = data_cache.get("recipe_master", pd.DataFrame())

        if schedule.empty:
            return {"data": []}

        schedule["date"] = pd.to_datetime(schedule["date"])

        if horizon == "week":
            schedule["period"] = (
                schedule["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + schedule["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            schedule["period"] = schedule["date"].dt.to_period("M").astype(str)
        else:
            schedule["period"] = schedule["date"].dt.year.astype(str)

        if mill_id:
            schedule = schedule[schedule["mill_id"] == mill_id]

        if period:
            schedule = schedule[schedule["period"] == period]

        schedule = schedule.merge(recipe_master[["recipe_id", "recipe_name"]], on="recipe_id", how="left")

        return {"data": schedule.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# RECIPE ELIGIBILITY MATRIX
# ============================================
@app.get("/api/planning/recipe-eligibility")
async def get_recipe_eligibility():
    """Get recipe eligibility matrix (flour_type -> recipe_id mapping)"""
    try:
        eligibility = data_cache.get("recipe_eligibility", pd.DataFrame())
        recipe_master = data_cache.get("recipe_master", pd.DataFrame())

        if eligibility.empty:
            return {"data": []}

        result = eligibility.merge(
            recipe_master[["recipe_id", "recipe_name", "base_tons_per_hour", "cost_index"]],
            on="recipe_id",
            how="left"
        )

        return {"data": result.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# RAW MATERIAL
# ============================================
@app.get("/api/raw-material")
async def get_raw_material(
    horizon: str = Query("month", pattern="^(week|month|year)$"),
    period: Optional[str] = None,
    country: Optional[str] = None
):
    """Get raw material prices by country"""
    try:
        raw_material = data_cache.get("raw_material", pd.DataFrame())
        if raw_material.empty:
            return {"data": []}

        raw_material["date"] = pd.to_datetime(raw_material["date"])

        if country:
            raw_material = raw_material[raw_material["country"].str.contains(country, case=False, na=False)]

        if horizon == "week":
            raw_material["period"] = (
                raw_material["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + raw_material["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            raw_material["period"] = raw_material["date"].dt.to_period("M").astype(str)
        else:
            raw_material["period"] = raw_material["date"].dt.year.astype(str)

        if period:
            raw_material = raw_material[raw_material["period"] == period]

        agg_result = raw_material.groupby(["period", "country"]).agg({
            "wheat_price_sar_per_ton": "mean",
            "availability_tons": "mean"
        }).reset_index()

        return {"data": agg_result.to_dict(orient="records")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# TEXT-TO-SQL CHATBOT
# ============================================
@app.post("/api/chatbot/query")
async def chatbot_query(query: ChatbotQuery):
    """Text-to-SQL chatbot endpoint"""
    if not CHATBOT_AVAILABLE:
        raise HTTPException(status_code=503, detail="Chatbot service not available")

    try:
        result = run_chatbot_query(query.question)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# ALERTS
# ============================================
@app.get("/api/alerts")
async def get_alerts(
    horizon: str = Query("week", pattern="^(week|month|year)$"),
    period: Optional[str] = None
):
    """Get capacity overload alerts based on mill_load table"""
    try:
        alerts = []

        mill_load = data_cache.get("mill_load", pd.DataFrame())
        mill_master = data_cache.get("mill_master", pd.DataFrame())

        if mill_load.empty:
            return {"alerts": []}

        mill_load["date"] = pd.to_datetime(mill_load["date"])

        if horizon == "week":
            mill_load["period"] = (
                mill_load["date"].dt.isocalendar().year.astype(str)
                + "-W"
                + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            )
        elif horizon == "month":
            mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
        else:
            mill_load["period"] = mill_load["date"].dt.year.astype(str)

        if period:
            mill_load = mill_load[mill_load["period"] == period]

        overloads = mill_load[mill_load["overload_hours"] > 0]
        if not overloads.empty:
            agg_overloads = overloads.groupby(["period", "mill_id"]).agg({
                "overload_hours": "sum"
            }).reset_index()

            agg_overloads = agg_overloads.merge(mill_master, on="mill_id", how="left")

            for _, row in agg_overloads.iterrows():
                alerts.append({
                    "type": "capacity_overload",
                    "severity": "high",
                    "title": f"Mill {row['mill_name']} Overloaded",
                    "message": f"Mill {row['mill_name']} is overloaded by {row['overload_hours']:.1f} hours in {row['period']}",
                    "mill_id": row["mill_id"],
                    "period": row["period"]
                })

        return {"alerts": alerts}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
