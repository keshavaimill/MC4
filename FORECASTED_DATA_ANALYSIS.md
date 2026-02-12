# Forecasted Production Planning Data Analysis

## Current Implementation

### Data Flow for Forecasted Production Planning:

1. **SKU Forecast Generation** (`fact_sku_forecast`)
   - Historical data: Up to 2026-02-14 (actual demand)
   - Forecasted data: From 2026-02-15+ (ML model predictions)

2. **Derived Datasets Generation** (via `update_derived_datasets`)
   - `fact_bulk_flour_requirement` ← Derived from `fact_sku_forecast`
   - `fact_recipe_demand` ← Derived from bulk flour + recipe mix
   - `fact_mill_capacity` ← Generated for all dates (deterministic)
   - `fact_mill_schedule_daily` ← **KEY**: Generated from recipe demand + mill capacity
   - `fact_mill_recipe_plan` ← Monthly aggregation of schedule

3. **Production Planning Chart Data Sources**
   - **Planned Recipe Hours**: From `fact_schedule` (via `/api/planning/recipe`)
     - Historical: Actual scheduled production hours
     - Forecasted: Planned production hours based on forecasted demand
   - **Available Mill Hours**: From `fact_mill_capacity` (via `/api/capacity/mill`)
     - Both historical and forecasted: Mill capacity (deterministic)

## How Forecasted Schedule is Generated

The `generate_fact_mill_schedule_daily` function:
1. Takes forecasted recipe demand (derived from SKU forecasts)
2. Takes mill capacity (available hours per mill per day)
3. **Proportionally allocates** mill capacity across recipes based on demand share
4. Creates daily production schedules with:
   - `planned_hours`: Hours allocated to each recipe
   - `status`: "planned" for future dates (after 2026-01-01)

## Is This Correct?

### ✅ YES - This is correct because:

1. **Planned Recipe Hours (Forecasted)**
   - Represents production hours that **should be scheduled** based on forecasted demand
   - Generated using proportional allocation algorithm
   - Accounts for recipe changeover times
   - Based on forecasted SKU demand → recipe demand → production schedule

2. **Available Mill Hours (Forecasted)**
   - Represents mill capacity (deterministic, not forecasted)
   - Generated for all dates including future
   - Accounts for maintenance and downtime

3. **The Comparison Makes Sense**
   - Shows planned production vs available capacity
   - Identifies capacity constraints and overloads
   - Standard production planning practice

## Is This Feasible?

### ✅ YES - This is feasible because:

1. **Standard Production Planning Approach**
   - Forecast demand → Calculate requirements → Schedule production → Compare with capacity
   - This is exactly how production planning works in real manufacturing

2. **Data Availability**
   - Forecasted SKU demand is generated via ML models
   - Recipe demand is calculated from SKU forecasts
   - Mill capacity is deterministic (known in advance)
   - Schedule is algorithmically generated

3. **Potential Issues & Solutions**

   **Issue 1: Forecasted data might not exist**
   - **Solution**: The system checks if forecasted data exists before displaying
   - If no forecasted data, chart shows only historical data

   **Issue 2: Schedule generation might be too simplistic**
   - **Current**: Proportional allocation based on demand share
   - **Reality**: More complex scheduling (optimization, constraints, etc.)
   - **Note**: This is a planning tool, not an optimization engine
   - **Feasible**: Yes, for planning purposes this is acceptable

   **Issue 3: Forecast accuracy**
   - **Reality**: Forecasts have uncertainty
   - **Current**: Shows point estimates
   - **Enhancement**: Could add confidence intervals or scenario analysis

## Recommendations

### Current Implementation: ✅ CORRECT & FEASIBLE

The current approach is:
- **Correct**: Shows planned production hours (based on forecasts) vs available capacity
- **Feasible**: Uses standard production planning methodology
- **Appropriate**: For executive/planning dashboards

### Potential Enhancements:

1. **Add Scenario Support**
   - Already implemented via `scenario` parameter (base/optimistic/pessimistic)
   - Could add scenario multipliers to forecasted demand

2. **Add Confidence Intervals**
   - Show uncertainty bands around forecasted planned hours
   - Help users understand forecast reliability

3. **Add Optimization**
   - Replace proportional allocation with optimization algorithm
   - Consider constraints, priorities, changeover costs
   - **Note**: This would be a significant enhancement, not a bug fix

4. **Add Validation**
   - Check if forecasted data exists before displaying
   - Show warning if forecasted data is stale
   - Suggest regenerating forecasts if needed

## Conclusion

**The forecasted Production Planning data is CORRECT and FEASIBLE.**

The system:
- ✅ Uses forecasted SKU demand to generate production schedules
- ✅ Compares planned production with available capacity
- ✅ Follows standard production planning practices
- ✅ Handles both historical and forecasted periods correctly

The only consideration is that the schedule generation uses proportional allocation rather than optimization, but this is appropriate for a planning dashboard and can be enhanced later if needed.
