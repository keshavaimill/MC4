"""
MC4 FastAPI Server
Backend API for MC4 Forecasting and Planning System
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
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

# Import forecast models
from forecast_models import MC4ForecastModel

app = FastAPI(title="MC4 Forecasting API", version="1.0.0")

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
            "recipe_allocation": pd.read_csv(f"{DATA_DIR}/recipe_allocation.csv"),
            "mill_master": pd.read_csv(f"{DATA_DIR}/mill_master.csv"),
            "raw_material": pd.read_csv(f"{DATA_DIR}/raw_material.csv"),
            "sku_forecast": pd.read_csv(f"{DATA_DIR}/sku_forecast.csv"),
            "flour_demand": pd.read_csv(f"{DATA_DIR}/flour_demand.csv"),
            "recipe_time": pd.read_csv(f"{DATA_DIR}/recipe_time.csv"),
            "mill_capacity": pd.read_csv(f"{DATA_DIR}/mill_capacity.csv"),
            "mill_load": pd.read_csv(f"{DATA_DIR}/mill_load.csv"),
            "recipe_time_weekly": pd.read_csv(f"{DATA_DIR}/recipe_time_weekly.csv"),
            "recipe_time_monthly": pd.read_csv(f"{DATA_DIR}/recipe_time_monthly.csv"),
            "recipe_time_yearly": pd.read_csv(f"{DATA_DIR}/recipe_time_yearly.csv"),
        }
        print("✅ Data loaded successfully")
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

class ForecastRequest(BaseModel):
    sku_id: Optional[str] = None
    horizon: str = "month"  # week, month, year
    periods: int = 30

# ============================================
# HEALTH CHECK
# ============================================
@app.get("/")
async def root():
    return {"message": "MC4 Forecasting API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy", "data_loaded": len(data_cache) > 0}

# ============================================
# EXECUTIVE OVERVIEW KPIs
# ============================================
@app.get("/api/kpis/executive")
async def get_executive_kpis(
    horizon: str = Query("month", regex="^(week|month|year)$"),
    period: Optional[str] = None
):
    """Get executive overview KPIs"""
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
        
        # Demand KPI
        sku_forecast = data_cache.get("sku_forecast", pd.DataFrame())
        if not sku_forecast.empty:
            sku_forecast["date"] = pd.to_datetime(sku_forecast["date"])
            if horizon == "week":
                sku_forecast["period"] = sku_forecast["date"].dt.isocalendar().year.astype(str) + "-W" + sku_forecast["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            elif horizon == "month":
                sku_forecast["period"] = sku_forecast["date"].dt.to_period("M").astype(str)
            else:
                sku_forecast["period"] = sku_forecast["date"].dt.year.astype(str)
            
            current_demand = sku_forecast[sku_forecast["period"] == period]["forecast_tons"].sum()
            
            # Previous period for growth
            periods = sku_forecast["period"].unique()
            periods = sorted(periods)
            if period in periods:
                idx = periods.index(period)
                if idx > 0:
                    prev_period = periods[idx - 1]
                    prev_demand = sku_forecast[sku_forecast["period"] == prev_period]["forecast_tons"].sum()
                    demand_growth = ((current_demand - prev_demand) / prev_demand * 100) if prev_demand > 0 else 0
                else:
                    demand_growth = 0
            else:
                demand_growth = 0
        else:
            current_demand = 0
            demand_growth = 0
        
        # Recipe Time KPI
        recipe_time = data_cache.get("recipe_time", pd.DataFrame())
        if not recipe_time.empty:
            recipe_time["date"] = pd.to_datetime(recipe_time["date"])
            if horizon == "week":
                recipe_time["period"] = recipe_time["date"].dt.isocalendar().year.astype(str) + "-W" + recipe_time["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            elif horizon == "month":
                recipe_time["period"] = recipe_time["date"].dt.to_period("M").astype(str)
            else:
                recipe_time["period"] = recipe_time["date"].dt.year.astype(str)
            
            required_hours = recipe_time[recipe_time["period"] == period]["required_hours"].sum()
        else:
            required_hours = 0
        
        # Capacity KPI
        mill_load = data_cache.get("mill_load", pd.DataFrame())
        if not mill_load.empty:
            mill_load["date"] = pd.to_datetime(mill_load["date"])
            if horizon == "week":
                mill_load["period"] = mill_load["date"].dt.isocalendar().year.astype(str) + "-W" + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            elif horizon == "month":
                mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
            else:
                mill_load["period"] = mill_load["date"].dt.year.astype(str)
            
            period_load = mill_load[mill_load["period"] == period]
            total_required = period_load["required_hours"].sum()
            total_available = period_load["available_hours"].sum()
            utilization = (total_required / total_available * 100) if total_available > 0 else 0
            overload_mills = len(period_load[period_load["overload_hours"] > 0])
        else:
            utilization = 0
            overload_mills = 0
        
        # Risk KPI (wheat price volatility)
        raw_material = data_cache.get("raw_material", pd.DataFrame())
        if not raw_material.empty:
            raw_material["date"] = pd.to_datetime(raw_material["date"])
            if horizon == "week":
                raw_material["period"] = raw_material["date"].dt.isocalendar().year.astype(str) + "-W" + raw_material["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            elif horizon == "month":
                raw_material["period"] = raw_material["date"].dt.to_period("M").astype(str)
            else:
                raw_material["period"] = raw_material["date"].dt.year.astype(str)
            
            period_rm = raw_material[raw_material["period"] == period]
            avg_price = period_rm["wheat_price_sar_per_ton"].mean() if not period_rm.empty else 0
            price_change = 0  # Simplified
        else:
            avg_price = 0
            price_change = 0
        
        return {
            "demand": {"total_tons": current_demand, "growth_pct": round(demand_growth, 2)},
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
    horizon: str = Query("month", regex="^(week|month|year)$"),
    period: Optional[str] = None,
    sku_id: Optional[str] = None
):
    """Get SKU forecast aggregated by horizon"""
    try:
        sku_forecast = data_cache.get("sku_forecast", pd.DataFrame())
        if sku_forecast.empty:
            return {"data": []}
        
        sku_forecast["date"] = pd.to_datetime(sku_forecast["date"])
        
        # Filter by SKU if specified
        if sku_id:
            sku_forecast = sku_forecast[sku_forecast["sku_id"] == sku_id]
        
        # Aggregate by horizon
        if horizon == "week":
            sku_forecast["period"] = sku_forecast["date"].dt.isocalendar().year.astype(str) + "-W" + sku_forecast["date"].dt.isocalendar().week.astype(str).str.zfill(2)
        elif horizon == "month":
            sku_forecast["period"] = sku_forecast["date"].dt.to_period("M").astype(str)
        else:
            sku_forecast["period"] = sku_forecast["date"].dt.year.astype(str)
        
        # Merge with SKU master for names
        sku_master = data_cache.get("sku_master", pd.DataFrame())
        result = sku_forecast.merge(sku_master, on="sku_id", how="left")
        
        # Aggregate
        agg_result = result.groupby(["period", "sku_id", "sku_name", "flour_type"]).agg({
            "forecast_tons": "sum"
        }).reset_index()
        
        # Filter by period if specified
        if period:
            agg_result = agg_result[agg_result["period"] == period]
        
        return {"data": agg_result.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# RECIPE PLANNING
# ============================================
@app.get("/api/planning/recipe")
async def get_recipe_planning(
    horizon: str = Query("month", regex="^(week|month|year)$"),
    period: Optional[str] = None
):
    """Get recipe time requirements"""
    try:
        if horizon == "week":
            recipe_time = data_cache.get("recipe_time_weekly", pd.DataFrame())
        elif horizon == "month":
            recipe_time = data_cache.get("recipe_time_monthly", pd.DataFrame())
        else:
            recipe_time = data_cache.get("recipe_time_yearly", pd.DataFrame())
        
        if recipe_time.empty:
            return {"data": []}
        
        # Filter by period if specified
        period_col = "week" if horizon == "week" else ("month" if horizon == "month" else "year")
        if period:
            recipe_time = recipe_time[recipe_time[period_col] == period]
        
        return {"data": recipe_time.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# MILL CAPACITY
# ============================================
@app.get("/api/capacity/mill")
async def get_mill_capacity(
    horizon: str = Query("month", regex="^(week|month|year)$"),
    period: Optional[str] = None,
    mill_id: Optional[str] = None
):
    """Get mill capacity and load"""
    try:
        mill_load = data_cache.get("mill_load", pd.DataFrame())
        if mill_load.empty:
            return {"data": []}
        
        mill_load["date"] = pd.to_datetime(mill_load["date"])
        
        # Aggregate by horizon
        if horizon == "week":
            mill_load["period"] = mill_load["date"].dt.isocalendar().year.astype(str) + "-W" + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
        elif horizon == "month":
            mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
        else:
            mill_load["period"] = mill_load["date"].dt.year.astype(str)
        
        # Filter by mill if specified
        if mill_id:
            mill_load = mill_load[mill_load["mill_id"] == mill_id]
        
        # Filter by period if specified
        if period:
            mill_load = mill_load[mill_load["period"] == period]
        
        # Aggregate
        agg_result = mill_load.groupby(["period", "mill_id"]).agg({
            "required_hours": "sum",
            "available_hours": "sum",
            "overload_hours": "sum"
        }).reset_index()
        
        # Merge with mill master
        mill_master = data_cache.get("mill_master", pd.DataFrame())
        result = agg_result.merge(mill_master, on="mill_id", how="left")
        result["utilization_pct"] = (result["required_hours"] / result["available_hours"] * 100).round(2)
        result["utilization_pct"] = result["utilization_pct"].replace([np.inf, -np.inf], 0)
        
        return {"data": result.to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# RECIPE ELIGIBILITY MATRIX
# ============================================
@app.get("/api/planning/recipe-eligibility")
async def get_recipe_eligibility():
    """Get recipe eligibility matrix"""
    try:
        recipe_allocation = data_cache.get("recipe_allocation", pd.DataFrame())
        recipe_master = data_cache.get("recipe_master", pd.DataFrame())
        
        # Merge to get full details
        result = recipe_allocation.merge(
            recipe_master[["recipe_id", "recipe_name", "tons_per_hour", "cost_index"]],
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
    horizon: str = Query("month", regex="^(week|month|year)$"),
    period: Optional[str] = None,
    country: Optional[str] = None
):
    """Get raw material prices by country"""
    try:
        raw_material = data_cache.get("raw_material", pd.DataFrame())
        if raw_material.empty:
            return {"data": []}
        
        raw_material["date"] = pd.to_datetime(raw_material["date"])
        
        # Filter by country if specified
        if country:
            raw_material = raw_material[raw_material["country"].str.contains(country, case=False, na=False)]
        
        # Aggregate by horizon
        if horizon == "week":
            raw_material["period"] = raw_material["date"].dt.isocalendar().year.astype(str) + "-W" + raw_material["date"].dt.isocalendar().week.astype(str).str.zfill(2)
        elif horizon == "month":
            raw_material["period"] = raw_material["date"].dt.to_period("M").astype(str)
        else:
            raw_material["period"] = raw_material["date"].dt.year.astype(str)
        
        # Filter by period if specified
        if period:
            raw_material = raw_material[raw_material["period"] == period]
        
        # Aggregate
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
    horizon: str = Query("week", regex="^(week|month|year)$"),
    period: Optional[str] = None
):
    """Get capacity and planning alerts"""
    try:
        alerts = []
        
        # Get mill capacity data
        mill_load = data_cache.get("mill_load", pd.DataFrame())
        if not mill_load.empty:
            mill_load["date"] = pd.to_datetime(mill_load["date"])
            
            # Aggregate by horizon
            if horizon == "week":
                mill_load["period"] = mill_load["date"].dt.isocalendar().year.astype(str) + "-W" + mill_load["date"].dt.isocalendar().week.astype(str).str.zfill(2)
            elif horizon == "month":
                mill_load["period"] = mill_load["date"].dt.to_period("M").astype(str)
            else:
                mill_load["period"] = mill_load["date"].dt.year.astype(str)
            
            if period:
                mill_load = mill_load[mill_load["period"] == period]
            
            # Find overloads
            overloads = mill_load[mill_load["overload_hours"] > 0]
            if not overloads.empty:
                agg_overloads = overloads.groupby(["period", "mill_id"]).agg({
                    "overload_hours": "sum"
                }).reset_index()
                
                mill_master = data_cache.get("mill_master", pd.DataFrame())
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
