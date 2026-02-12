# MC4 Domain Business Queries for Text2SQL Chatbot

These queries are designed for the MC4 flour milling and production planning domain. They cover mill operations, recipe planning, SKU forecasts, flour demand, and raw material (wheat) supply.

**Schema Overview:**
- **Dimension Tables (dim_*)**: `dim_mill`, `dim_recipe`, `dim_flour_type`, `dim_sku`, `dim_wheat_type`, `dim_country`
- **Mapping Tables (map_*)**: `map_flour_recipe`, `map_recipe_mill`, `map_sku_flour`, `map_recipe_wheat`, `map_wheat_country`
- **Fact Tables (fact_*)**: `fact_sku_forecast`, `fact_bulk_flour_requirement`, `fact_recipe_demand`, `fact_mill_recipe_plan`, `fact_mill_capacity`, `fact_mill_schedule_daily`, `fact_wheat_requirement`, `fact_waste_metrics`, `fact_kpi_snapshot`

---

## 1. SKU Forecast Analysis
**Query:** "What is the total forecasted tons for SKU001 in January 2020?"

**Business Context:** Demand planners need to understand forecasted demand for specific SKUs to plan production and inventory.

**Expected SQL Logic:**
- Filter `fact_sku_forecast` by `sku_id = 'SKU001'` and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Sum `demand_tons`

---

## 2. Mill Utilization Analysis
**Query:** "Show me the utilization percentage for each mill in January 2020"

**Business Context:** Operations managers need to track mill utilization to optimize production capacity and identify bottlenecks.

**Expected SQL Logic:**
- Filter `fact_mill_recipe_plan` by `period` containing January 2020 (or use date range if period is date)
- Group by `mill_id`
- Show `mill_id` and average `utilization_pct`
- Join with `dim_mill` to get mill names

---

## 3. Flour Type Demand Comparison
**Query:** "Compare total bulk flour demand by flour type for January 2020"

**Business Context:** Production planners need to understand demand distribution across different flour types to allocate production capacity.

**Expected SQL Logic:**
- Filter `fact_bulk_flour_requirement` by `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Group by `flour_type_id`
- Sum `required_tons`
- Join with `dim_flour_type` to get flour names

---

## 4. Recipe Production Schedule
**Query:** "What recipes were scheduled at M1 mill in January 2020 and how many tons were produced?"

**Business Context:** Production managers need to track which recipes are being run and their production output.

**Expected SQL Logic:**
- Filter `fact_mill_schedule_daily` by `mill_id = 'M1'` and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Group by `recipe_id`
- Sum `tons_produced`
- Join with `dim_recipe` to get recipe names

---

## 5. Mill Capacity vs Load
**Query:** "Show me the planned hours vs available hours for each mill in January 2020"

**Business Context:** Capacity planners need to compare planned production hours against available capacity to identify overload situations.

**Expected SQL Logic:**
- Filter `fact_mill_recipe_plan` by `period` containing January 2020
- Group by `mill_id`
- Sum `planned_hours` and `available_hours`
- Calculate utilization: `SUM(planned_hours) / SUM(available_hours) * 100`
- Join with `dim_mill` for mill names

---

## 6. Recipe Demand by Flour Type
**Query:** "What is the recipe demand for Superior flour in January 2020?"

**Business Context:** Recipe planners need to understand how much of each recipe is required to meet flour type demand.

**Expected SQL Logic:**
- Join `fact_recipe_demand` with `map_flour_recipe` on `recipe_id`
- Join `map_flour_recipe` with `dim_flour_type` on `flour_type_id`
- Filter by `flour_name LIKE '%Superior%'` (case-insensitive) and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Group by `recipe_id`
- Sum `required_tons`
- Join with `dim_recipe` for recipe names

---

## 7. Wheat Requirement Analysis
**Query:** "What is the total wheat requirement by wheat type in January 2020?"

**Business Context:** Procurement teams need to understand wheat requirements to plan sourcing decisions.

**Expected SQL Logic:**
- Filter `fact_wheat_requirement` by `period` containing January 2020
- Group by `wheat_type_id`
- Sum `required_tons`
- Join with `dim_wheat_type` to get wheat names

---

## 8. Mill Overload Analysis
**Query:** "Which mills had utilization above 90% in January 2020?"

**Business Context:** Operations managers need to identify mills operating near capacity to take corrective action.

**Expected SQL Logic:**
- Filter `fact_mill_recipe_plan` by `period` containing January 2020
- Where `utilization_pct > 90`
- Group by `mill_id`
- Show `mill_id` and average `utilization_pct`
- Join with `dim_mill` for mill names

---

## 9. Recipe Production Rates
**Query:** "What are the production rates (tons per hour) for each recipe at M1 mill?"

**Business Context:** Production planners need to know production rates to estimate production time and capacity requirements.

**Expected SQL Logic:**
- Filter `map_recipe_mill` by `mill_id = 'M1'` and `allowed = 1`
- Join with `dim_recipe` to get recipe names
- Show `recipe_name`, `max_rate_tph`

---

## 10. SKU Forecast by Flour Type
**Query:** "What is the total forecasted tons for Superior flour SKUs in January 2020?"

**Business Context:** Demand planners need aggregated forecasts by flour type to plan production and inventory.

**Expected SQL Logic:**
- Join `fact_sku_forecast` with `dim_sku` on `sku_id`
- Join `dim_sku` with `dim_flour_type` on `flour_type_id`
- Filter by `flour_name LIKE '%Superior%'` (case-insensitive) and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Sum `demand_tons`

---

## 11. Historical vs Forecasted Demand
**Query:** "Compare historical actuals and future forecasts for SKU001"

**Business Context:** Analysts need to compare historical performance with future forecasts to assess forecast accuracy.

**Expected SQL Logic:**
- Filter `fact_sku_forecast` by `sku_id = 'SKU001'`
- Separate historical (date <= '2026-02-14' AND confidence_pct = 1.0) and forecasted (date > '2026-02-14' AND confidence_pct < 1.0)
- Group by date range category
- Sum `demand_tons`

---

## 12. Waste Metrics Analysis
**Query:** "Show me waste percentage and energy consumption by mill and recipe in January 2020"

**Business Context:** Sustainability managers need to track waste and energy metrics for Vision 2030 compliance.

**Expected SQL Logic:**
- Filter `fact_waste_metrics` by `period` containing January 2020
- Group by `mill_id`, `recipe_id`
- Show average `waste_pct`, `energy_per_ton`, `water_per_ton`
- Join with `dim_mill` and `dim_recipe` for names

---

## Visualization Queries

### 13. Forecast Trend Over Time
**Query:** "Show me a line chart of forecasted tons for SKU001 over time in January 2020"

**Expected SQL Logic:**
- Filter `fact_sku_forecast` by `sku_id = 'SKU001'` and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Order by `date`
- Show `date` and `demand_tons`

**Chart Type:** Line chart

---

### 14. Mill Utilization Comparison
**Query:** "Plot a bar chart comparing utilization percentage across all mills in January 2020"

**Expected SQL Logic:**
- Filter `fact_mill_recipe_plan` by `period` containing January 2020
- Group by `mill_id`
- Calculate average `utilization_pct`
- Join with `dim_mill` for mill names

**Chart Type:** Bar chart

---

### 15. Flour Type Demand Breakdown
**Query:** "Create a pie chart showing bulk flour demand by flour type in January 2020"

**Expected SQL Logic:**
- Filter `fact_bulk_flour_requirement` by `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Group by `flour_type_id`
- Sum `required_tons`
- Join with `dim_flour_type` for flour names

**Chart Type:** Pie chart

---

### 16. Recipe Production Comparison
**Query:** "Visualize total tons produced by recipe at M1 mill in January 2020 as a bar chart"

**Expected SQL Logic:**
- Filter `fact_mill_schedule_daily` by `mill_id = 'M1'` and `date BETWEEN '2020-01-01' AND '2020-01-31'`
- Group by `recipe_id`
- Sum `tons_produced`
- Join with `dim_recipe` for recipe names

**Chart Type:** Bar chart

---

### 17. KPI Snapshot Analysis
**Query:** "Show me the total demand tons KPI over time"

**Business Context:** Executives need to track key performance indicators for strategic decision-making.

**Expected SQL Logic:**
- Filter `fact_kpi_snapshot` by `kpi_name = 'total_demand_tons'`
- Order by `period`
- Show `period` and `value`

**Chart Type:** Line chart

---

## Notes for Testing

1. **Date Formats:** Use 'YYYY-MM-DD' format (e.g., '2020-01-01')
2. **Period Formats:** Use 'YYYY-MM-DD' or 'YYYY-MM' format as stored in period columns
3. **Mill IDs:** Use exact format 'M1', 'M2', 'M3' (case sensitive)
4. **Recipe IDs:** Use exact format 'R1', 'R2', 'R3', etc. (case sensitive)
5. **SKU IDs:** Use exact format 'SKU001', 'SKU002', etc. (case sensitive)
6. **Flour Type IDs:** Use exact format 'FT001', 'FT002', etc. (case sensitive)
7. **Wheat Type IDs:** Use exact format 'WT001', 'WT002', etc. (case sensitive)
8. **Country IDs:** Use exact format 'C001', 'C002', etc. (case sensitive)
9. **Flour Names:** Use 'Fortified Patent', 'Superior', 'Standard', 'Brown' (case-insensitive match via dim_flour_type)
10. **Historical vs Forecast:** Historical actuals have `date <= '2026-02-14'` and `confidence_pct = 1.0`, future forecasts have `date > '2026-02-14'` and `confidence_pct < 1.0`
11. **Scenario IDs:** Typically 'base' (exact match)

## Query Complexity Levels

- **Simple (1-5):** Single table queries with basic filters and aggregations
- **Medium (6-12):** Multi-table joins or complex filtering
- **Advanced (13+):** Complex joins, calculations, or visualization queries

## Key Join Patterns

- `fact_sku_forecast.sku_id` → `dim_sku.sku_id` → `dim_flour_type.flour_type_id`
- `fact_bulk_flour_requirement.flour_type_id` → `dim_flour_type.flour_type_id`
- `fact_recipe_demand.recipe_id` → `dim_recipe.recipe_id`
- `fact_mill_recipe_plan.mill_id` → `dim_mill.mill_id` AND `fact_mill_recipe_plan.recipe_id` → `dim_recipe.recipe_id`
- `fact_mill_schedule_daily.mill_id` → `dim_mill.mill_id` AND `fact_mill_schedule_daily.recipe_id` → `dim_recipe.recipe_id`
- `map_flour_recipe.flour_type_id` → `dim_flour_type.flour_type_id` AND `map_flour_recipe.recipe_id` → `dim_recipe.recipe_id`
- `map_recipe_mill.recipe_id` → `dim_recipe.recipe_id` AND `map_recipe_mill.mill_id` → `dim_mill.mill_id`
