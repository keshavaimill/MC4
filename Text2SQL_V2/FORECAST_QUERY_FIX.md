# Forecast Query Fix

## Issue
The chatbot cannot answer: "What is the 7-day sales forecast for WL-SKU-001 at Store_01?"

## Root Cause
1. **Database needs rebuild**: The database still has the old `sku_daily_forecast` table, but the new tables `sku_daily_forecast_7day` and `sku_daily_forecast_30day` are not in the database yet.

2. **Prompt complexity**: The prompt was too complex for simple forecast queries, requiring forecast_date computation even when not needed.

## Fixes Applied

### 1. Updated Prompt for Simple Forecast Queries
The prompt now clearly distinguishes between:
- **Simple queries** (no date range): Just sum `forecast_units` directly
- **Date-filtered queries**: Compute `forecast_date` using date + forecast_horizon

### 2. Updated Schema Metadata
- Added clear notes about when to use simple queries vs date-filtered queries
- Added example SQL for simple forecast queries

## Solution: Rebuild Database

The database needs to be rebuilt to include the new tables. When the server restarts, it will:
1. Load the new schema from `chatbot_api.py`
2. Build tables for `sku_daily_forecast_7day` and `sku_daily_forecast_30day`
3. Remove/ignore the old `sku_daily_forecast` table

## Expected SQL for Simple Forecast Query

For query: "What is the 7-day sales forecast for WL-SKU-001 at Store_01?"

**Expected SQL:**
```sql
SELECT SUM(forecast_units) as total_forecast 
FROM sku_daily_forecast_7day 
WHERE sku_id = 'WL-SKU-001' AND store_id = 'Store_01'
```

This will sum all forecast_units for that SKU and store across all dates in the 7-day forecast table.

## Testing

After rebuilding the database, test with:
1. "What is the 7-day sales forecast for WL-SKU-001 at Store_01?"
2. "What is the 30-day sales forecast for WL-SKU-002 at Store_02?"
3. "Show me the 7-day forecast for all stores for WL-SKU-001"
