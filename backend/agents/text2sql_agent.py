# from utils.llm_factory import load_llm
# from langchain_core.prompts import PromptTemplate

# class Text2SQLAgent:
#     def __init__(self, db_path, schema, schema_metadata):
#         self.db_path = db_path
#         self.schema = schema
#         self.schema_metadata = schema_metadata or {}
#         self.llm = load_llm(temp=0)

#         schema_str = "\n".join(
#             [f"Table {t['table_name']}: {', '.join(t['columns'])}" for t in schema]
#         )

#         self.prompt = PromptTemplate.from_template(
#             """
# You are an expert SQL generator. You ALWAYS return only pure SQL without explanation.

# Database schema:
# {schema}

# Question: {question}

# SQL:
#             """
#         )

#         self.schema_text = schema_str

#     # ---- This is the actual SQL generator ----
#     def generate_sql(self, question: str):
#         p = self.prompt.format(schema=self.schema_text, question=question)
#         response = self.llm.invoke(p)

#         # Gemini returns .content, OpenAI returns string
#         sql = response.content if hasattr(response, "content") else str(response)

#         # Clean backticks / markdown formatting
#         sql = sql.replace("```sql", "").replace("```", "").strip()

#         return sql

#     def run(self, question: str):
#         """
#         Wrapper method used by app.py
#         """
#         return self.generate_sql(question)

from utils.llm_factory import load_llm
from langchain_core.prompts import PromptTemplate


class Text2SQLAgent:
    def __init__(self, db_path, schema, schema_metadata=None):
        self.db_path = db_path
        self.schema = schema
        self.schema_metadata = schema_metadata or {}
        self.llm = load_llm(temp=0)

        self.schema_text = self._build_schema_text()

#         self.prompt = PromptTemplate.from_template(
#             """
# You are an expert SQL generator.

# STRICT RULES:
# - Return ONLY valid SQLite SQL
# - NO explanations
# - NO markdown
# - NO comments

# CRITICAL FORECAST RULE:
# - NEVER filter forecasts directly on `timestamp`
# - ALWAYS compute forecasted time using:
#   datetime(timestamp, '+' || forecast_hour_offset || ' hours')
# - Any date range in the user question applies to the computed forecast time

# RULES:
# - If filtering on textual identifiers (store_id, dc_id, sku_id, city, location):
#   - Always convert the attribute to LOWER() for case-insensitive matching
#   - Use LIKE with wildcards unless the question specifies an exact ID
# - Assume user names (e.g. "dubai") may be partial or case-insensitive
# - Never guess numeric IDs
# - Always generate a unique "order_id" when inserting into order_log

# DATABASE SCHEMA WITH SEMANTICS:
# {schema}

# Question:
# {question}

# SQL:
#             """
#         )

        self.prompt = PromptTemplate.from_template(
    """
You are an expert SQLite SQL generator for a flour milling and production planning database (MC4 domain).

CRITICAL ANTI-HALLUCINATION RULES (MUST FOLLOW):
- ONLY use tables and columns that are EXPLICITLY listed in the schema below
- NEVER invent, guess, or assume column names, table names, or values
- If a column or table is NOT in the schema, it DOES NOT EXIST - do not use it
- ONLY use sample values provided in the metadata - do not invent values
- If unsure about a column name, check the exact spelling in the schema
- If a user asks about data not in the schema, you must inform them it's not available (but still return valid SQL if possible)
- CRITICAL: ALWAYS use FULL table names (e.g., dim_sku, dim_flour_type, dim_country) - NEVER use "dim" as a shorthand or alias
- NEVER truncate table names - always use the complete table name as specified in the schema

STRICT OUTPUT RULES:
- Return ONLY valid, complete SQLite SQL statements
- The SQL must be syntactically complete - all parentheses, quotes, and clauses must be properly closed
- NO explanations
- NO markdown code blocks (no ```sql or ```)
- NO comments
- NO text before or after the SQL
- The SQL must start with SELECT and be a complete, executable statement
- Ensure all string literals are properly quoted with single quotes
- Ensure all parentheses are balanced
- Ensure all JOIN clauses are complete with ON conditions

WRITE PERMISSIONS:
- This database is READ-ONLY for all tables
- NEVER INSERT, UPDATE, or DELETE any table
- All tables are for querying only

DOMAIN CONTEXT (MC4 - Flour Milling):
- This database tracks flour production, mill operations, recipes, SKU demand forecasts, and raw material (wheat) supply
- Key entities: 
  * Mills (M1, M2, M3) - see dim_mill table
  * Recipes (R1, R2, R3, etc.) - see dim_recipe table
  * SKUs (SKU001, SKU002, etc.) - see dim_sku table
  * Flour Types (FT001, FT002, etc.) - see dim_flour_type table
  * Wheat Types (WT001, WT002, etc.) - see dim_wheat_type table
  * Countries (C001, C002, etc.) - see dim_country table
- Demand/forecasts are in TONS (demand_tons) and UNITS (demand_units), dates are in YYYY-MM-DD format
- Historical actuals are in fact_sku_forecast with date <= '2026-02-14' and confidence_pct=1.0
- Future forecasts are in fact_sku_forecast with date > '2026-02-14' and confidence_pct < 1.0
- Mill operations track scheduled hours, capacity, utilization, and production schedules

SCHEMA STRUCTURE:
- Dimension tables (dim_*): Master data for mills, recipes, SKUs, flour types, wheat types, countries
- Mapping tables (map_*): Relationships between dimensions (e.g., which recipes produce which flour types)
- Fact tables (fact_*): Transactional and time-series data (forecasts, requirements, schedules, KPIs)

FORECAST QUERIES:
- For fact_sku_forecast table: The date column represents the forecast/actual date directly
- Filter by date range using: WHERE date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'
- For "next N months" queries: Calculate from the cutoff date '2026-02-14' (actual data ends here, forecasts start after)
  Example: "next 2 months" from cutoff = date > '2026-02-14' AND date <= date('2026-02-14', '+2 months')
  SQLite date function: date('2026-02-14', '+2 months') correctly calculates 2 months forward
- Aggregate demand_tons using SUM() for totals
- Join with dim_sku to get sku_name, flour_type_id, pack_size_kg, region, channel details
- Join with dim_flour_type to get flour_name, protein specs, quality specs
- Historical actuals: WHERE date <= '2026-02-14' AND confidence_pct = 1.0
- Future forecasts: WHERE date > '2026-02-14' AND confidence_pct < 1.0
- IMPORTANT: If query asks for "forecasted" or "next N months", use date > '2026-02-14' to get forecast data

NATURAL LANGUAGE PRODUCT/ENTITY MAPPING:
- When user mentions "Wheat Flour" or just "Flour": This is a general term referring to ALL flour types. Since all flour in this database is made from wheat, do NOT filter by flour_name - return data for ALL flour types.
  IMPORTANT: If user says "Wheat Flour" or "Flour" without specifying a type, do NOT add a WHERE clause filtering flour_name. Just join the tables to get flour information but don't filter it out.
- When user mentions specific flour types by name (e.g., "Superior", "Brown", "Patent", "Bakery"): Map to flour_name in dim_flour_type table using case-insensitive LIKE matching
  Example: LOWER(dim_flour_type.flour_name) LIKE '%superior%' OR LOWER(dim_flour_type.flour_name) LIKE '%brown%'
  Available flour names: "Fortified Patent", "Fortified Bakery", "Premium Artisan", "Fortified Brown", "Superior Brown"
- When user mentions a country name (e.g., "Saudi Arabia") in demand/forecast queries: 
  * Since all SKU forecasts in this database are for the Saudi Arabia market, you can typically ignore country filters for demand queries
  * However, if the query specifically requires country filtering, note that fact_sku_forecast doesn't have a direct country column
  * For wheat sourcing/supply queries: Join through map_wheat_country -> dim_country and filter by country_name
  * Use: LOWER(dim_country.country_name) LIKE '%saudi%' OR LOWER(dim_country.country_name) LIKE '%arabia%'
- When user mentions flour types by name: Always join fact_sku_forecast -> dim_sku -> dim_flour_type and filter on flour_name

FILTERING RULES:
- For mill_id: Use exact match (M1, M2, M3) - case sensitive
- For recipe_id: Use exact match (R1, R2, R3, etc.) - case sensitive
- For sku_id: Use exact match (SKU001, SKU002, etc.) - case sensitive, or use LOWER() for case-insensitive if user provides partial match
- For flour_type_id: Use exact match (FT001, FT002, etc.) - case sensitive
- For wheat_type_id: Use exact match (WT001, WT002, etc.) - case sensitive
- For country_id: Use exact match (C001, C002, etc.) - case sensitive
- For flour_name: Use case-insensitive partial match: LOWER(flour_name) LIKE '%value%'
- For country_name: Use case-insensitive partial match: LOWER(country_name) LIKE '%value%'
- For dates: Use 'YYYY-MM-DD' format, e.g., '2020-01-01'
- For periods: Use 'YYYY-MM-DD' or 'YYYY-MM' format as stored in the period column

VALUE VALIDATION:
- Use ONLY the example_values and allowed_values provided in the schema metadata
- For mill_id: Use format 'M1', 'M2', 'M3' (exact match)
- For recipe_id: Use format 'R1', 'R2', 'R3', etc. (exact match)
- For sku_id: Use format 'SKU001', 'SKU002', etc. (exact match preferred, or case-insensitive if needed)
- For flour_type_id: Use format 'FT001', 'FT002', etc. (exact match)
- For wheat_type_id: Use format 'WT001', 'WT002', etc. (exact match)
- For country_id: Use format 'C001', 'C002', etc. (exact match)
- For scenario_id: Typically 'base' (exact match)

JOIN PATTERNS:
- fact_sku_forecast.sku_id -> dim_sku.sku_id (to get SKU details)
- dim_sku.flour_type_id -> dim_flour_type.flour_type_id (to get flour type details)
- fact_bulk_flour_requirement.flour_type_id -> dim_flour_type.flour_type_id
- fact_recipe_demand.recipe_id -> dim_recipe.recipe_id
- fact_mill_recipe_plan.mill_id -> dim_mill.mill_id AND fact_mill_recipe_plan.recipe_id -> dim_recipe.recipe_id
- fact_mill_schedule_daily.mill_id -> dim_mill.mill_id AND fact_mill_schedule_daily.recipe_id -> dim_recipe.recipe_id
- map_flour_recipe.flour_type_id -> dim_flour_type.flour_type_id AND map_flour_recipe.recipe_id -> dim_recipe.recipe_id
- map_recipe_mill.recipe_id -> dim_recipe.recipe_id AND map_recipe_mill.mill_id -> dim_mill.mill_id
- map_sku_flour.sku_id -> dim_sku.sku_id AND map_sku_flour.flour_type_id -> dim_flour_type.flour_type_id
- map_recipe_wheat.recipe_id -> dim_recipe.recipe_id AND map_recipe_wheat.wheat_type_id -> dim_wheat_type.wheat_type_id
- map_wheat_country.wheat_type_id -> dim_wheat_type.wheat_type_id AND map_wheat_country.country_id -> dim_country.country_id
- fact_wheat_requirement.wheat_type_id -> dim_wheat_type.wheat_type_id
- fact_waste_metrics.mill_id -> dim_mill.mill_id AND fact_waste_metrics.recipe_id -> dim_recipe.recipe_id

EXAMPLE QUERIES FOR COMPLEX FILTERING:
- Query: "Forecasted demand for Wheat Flour next 2 months in Saudi Arabia"
  SQL pattern (Wheat Flour = ALL flour types, no flour_name filter):
    SELECT f.date, SUM(f.demand_tons) as total_demand_tons
    FROM fact_sku_forecast f
    JOIN dim_sku ds ON f.sku_id = ds.sku_id
    JOIN dim_flour_type dft ON ds.flour_type_id = dft.flour_type_id
    WHERE f.date > '2026-02-14' 
      AND f.date <= date('2026-02-14', '+2 months')
      AND f.confidence_pct < 1.0
    GROUP BY f.date
    ORDER BY f.date
  Note: "Wheat Flour" means ALL flour types - do NOT filter by flour_name. "in Saudi Arabia" is ignored since all forecasts are for Saudi market.
  CRITICAL: Ensure the SQL is complete - all clauses must be properly closed, all quotes balanced, all parentheses matched.

- Query: "Forecasted demand for Superior flour next 2 months"
  SQL pattern (specific flour type - filter by flour_name):
    SELECT f.date, SUM(f.demand_tons) as total_demand_tons
    FROM fact_sku_forecast f
    JOIN dim_sku ds ON f.sku_id = ds.sku_id
    JOIN dim_flour_type dft ON ds.flour_type_id = dft.flour_type_id
    WHERE f.date > '2026-02-14' 
      AND f.date <= date('2026-02-14', '+2 months')
      AND LOWER(dft.flour_name) LIKE '%superior%'
      AND f.confidence_pct < 1.0
    GROUP BY f.date
    ORDER BY f.date
  CRITICAL: Ensure the SQL is complete - all clauses must be properly closed, all quotes balanced, all parentheses matched.

- Always use full table names: fact_sku_forecast, dim_sku, dim_flour_type, dim_country (never "dim" alone)
- Always specify table aliases explicitly: FROM fact_sku_forecast f, JOIN dim_sku ds, JOIN dim_flour_type dft
- Never use table name "dim" - it does not exist. Always use complete names like dim_sku, dim_flour_type, etc.

AGGREGATION GUIDELINES:
- Use SUM() for tons, hours, quantities, units that should be totaled (demand_tons, demand_units, required_tons, planned_hours, etc.)
- Use AVG() for rates, percentages, or when averaging across records (utilization_pct, waste_pct, avg_cost, etc.)
- Use COUNT() for counting records
- Group by appropriate dimensions (date, period, mill_id, recipe_id, sku_id, flour_type_id, wheat_type_id, scenario_id, etc.)

KPI QUERIES:
- Use fact_kpi_snapshot table for pre-calculated KPIs
- Filter by kpi_name (e.g., 'total_demand_tons', 'recipe_time_utilization', 'capacity_violations', 'avg_cost_per_ton', 'waste_rate', 'vision_2030_index')
- Filter by period and scenario_id as needed

DATABASE SCHEMA WITH COMPLETE METADATA:
{schema}

Question:
{question}

SQL:
"""
)


    # ---------------------------------------------
    # Build schema with column descriptions
    # ---------------------------------------------
    def _build_schema_text(self):
        blocks = []

        # ---------------------------------------------
        # Global rules (very important for LLM behavior)
        # ---------------------------------------------
        global_rules = self.schema_metadata.get("global_rules", {})

        if global_rules:
            rules_block = ["GLOBAL SQL & FORECAST RULES:"]

            for k, v in global_rules.items():
                if isinstance(v, list):
                    rules_block.append(f"- {k}:")
                    for item in v:
                        rules_block.append(f"    - {item}")
                else:
                    rules_block.append(f"- {k}: {v}")

            blocks.append("\n".join(rules_block))

        # ---------------------------------------------
        # Table-level schema
        # ---------------------------------------------
        tables_meta = self.schema_metadata.get("tables", {})

        for table in self.schema:
            tname = table["table_name"]
            cols = table["columns"]

            meta = tables_meta.get(tname, {})
            table_desc = meta.get("description", "")
            forecast_semantics = meta.get("forecast_semantics", {})

            col_lines = []
            col_meta = meta.get("columns", {})

            for c in cols:
                c_info = col_meta.get(c, {})

                line = f"- {c}"

                if isinstance(c_info, dict):
                    parts = []

                    if c_info.get("description"):
                        parts.append(f"Description: {c_info['description']}")

                    if c_info.get("type"):
                        parts.append(f"Type: {c_info['type']}")

                    if c_info.get("semantic_role"):
                        parts.append(f"Semantic role: {c_info['semantic_role']}")

                    if c_info.get("matching_rule"):
                        parts.append(f"SQL matching rule: {c_info['matching_rule']}")

                    if c_info.get("sql_rule_sqlite"):
                        parts.append(f"SQLite SQL rule: {c_info['sql_rule_sqlite']}")

                    if c_info.get("aggregation_rule"):
                        parts.append(f"Aggregation rule: {c_info['aggregation_rule']}")

                    if c_info.get("location_encoding"):
                        parts.append(f"Location encoding: {c_info['location_encoding']}")

                    # Include example values to prevent hallucination
                    if c_info.get("example_values"):
                        examples = ", ".join([str(v) for v in c_info["example_values"][:5]])
                        parts.append(f"Example values: {examples}")

                    if c_info.get("distinct_values_sample"):
                        values = ", ".join([str(v) for v in c_info["distinct_values_sample"][:10]])
                        parts.append(f"Valid values (sample): {values}")

                    if c_info.get("allowed_values"):
                        allowed = ", ".join([str(v) for v in c_info["allowed_values"]])
                        parts.append(f"Allowed values: {allowed}")

                    if c_info.get("distinct_values"):
                        values = ", ".join([str(v) for v in c_info["distinct_values"][:10]])
                        parts.append(f"Valid values (examples): {values}")

                    if c_info.get("semantic_hints"):
                        hints = " | ".join(c_info["semantic_hints"])
                        parts.append(f"Semantic hints: {hints}")

                    if parts:
                        line += "\n    " + "\n    ".join(parts)

                col_lines.append(line)

            # ---------------------------------------------
            # Forecast semantics (critical!)
            # ---------------------------------------------
            forecast_block = ""
            if forecast_semantics:
                forecast_block = (
                    "\nForecast semantics:\n"
                    f"- Definition: {forecast_semantics.get('definition', '')}\n"
                    f"- SQLite expression: {forecast_semantics.get('sql_expression_sqlite', '')}"
                )

            block = (
                f"Table: {tname}\n"
                f"Description: {table_desc}\n"
                f"{forecast_block}\n"
                f"Columns:\n" +
                "\n".join(col_lines)
            )

            blocks.append(block.strip())

        return "\n\n".join(blocks)



    # ---------------------------------------------
    # SQL generation
    # ---------------------------------------------
    def generate_sql(self, question: str):
        prompt = self.prompt.format(
            schema=self.schema_text,
            question=question
        )

        response = self.llm.invoke(prompt)
        sql = response.content if hasattr(response, "content") else str(response)

        # Cleanup and extract SQL
        sql = self._extract_sql(sql)
        
        return sql
    
    def _extract_sql(self, text: str) -> str:
        """
        Extract SQL from LLM response, handling markdown code blocks and incomplete statements.
        """
        import re
        
        # Remove markdown code blocks
        sql = text.replace("```sql", "").replace("```", "").strip()
        
        # Find the SELECT statement - look for SELECT and capture until end of statement
        # Use a more robust approach: find SELECT and continue until we have balanced structure
        lines = sql.split('\n')
        sql_lines = []
        in_sql = False
        paren_count = 0
        quote_char = None
        
        for line in lines:
            line_stripped = line.strip()
            
            # Start capturing when we see SELECT
            if line_stripped.upper().startswith('SELECT'):
                in_sql = True
                sql_lines.append(line)
                # Count parentheses and quotes in this line
                for char in line:
                    if char == '(':
                        paren_count += 1
                    elif char == ')':
                        paren_count -= 1
                    elif char in ("'", '"') and quote_char is None:
                        quote_char = char
                    elif char == quote_char:
                        quote_char = None
                continue
            
            if in_sql:
                # Continue capturing SQL lines
                sql_lines.append(line)
                
                # Track parentheses and quotes
                for char in line:
                    if char == '(':
                        paren_count += 1
                    elif char == ')':
                        paren_count -= 1
                    elif char in ("'", '"') and quote_char is None:
                        quote_char = char
                    elif char == quote_char:
                        quote_char = None
                
                # Stop if we hit another statement type (but allow continuation if in quotes or parens)
                if not line_stripped:
                    # Empty line might be end of SQL, but only if balanced
                    if paren_count == 0 and quote_char is None:
                        # Check if next non-empty line is not SQL continuation
                        continue
                elif line_stripped.upper().startswith(('INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER')):
                    if paren_count == 0 and quote_char is None:
                        # Remove the last line (it's a new statement)
                        sql_lines.pop()
                        break
        
        if sql_lines:
            sql = '\n'.join(sql_lines).strip()
        else:
            # Fallback: try regex match
            sql_match = re.search(r'(SELECT\s+.*)', sql, re.IGNORECASE | re.DOTALL)
            if sql_match:
                sql = sql_match.group(1).strip()
        
        # Remove trailing semicolon if present (SQLite doesn't require it for single statements)
        sql = sql.rstrip(';').strip()
        
        # Validate basic structure
        if not sql.upper().startswith('SELECT'):
            raise ValueError(f"Generated SQL does not start with SELECT: {sql[:100]}")
        
        # Basic validation: check for balanced parentheses (rough check)
        if sql.count('(') != sql.count(')'):
            # Try to fix common issues - but this is risky, so log a warning
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"SQL has unbalanced parentheses: {sql[:200]}")
        
        return sql
    
    def _normalize_like_patterns(self, sql: str) -> str:
        import re

        def repl(match):
            col = match.group(1)
            val = match.group(2)
            tokens = val.lower().split()
            pattern = "%" + "%".join(tokens) + "%"
            return f"LOWER({col}) LIKE '{pattern}'"

        sql = re.sub(
            r"LOWER\((store_id|dc_id)\)\s+LIKE\s+'%([^']+)%'",
            repl,
            sql,
            flags=re.IGNORECASE
        )
        return sql


    def _apply_forecast_time(self, sql: str) -> str:
        if "forecast_hour_offset" in sql and "timestamp BETWEEN" in sql:
            sql = sql.replace(
                "timestamp BETWEEN",
                "datetime(timestamp, '+' || forecast_hour_offset || ' hours') BETWEEN"
            )
        return sql


    def run(self, question: str):
        sql = self.generate_sql(question)
        sql = sql.replace("ILIKE", "LIKE")  # SQLite safety
        sql = self._normalize_like_patterns(sql)
        sql = self._apply_forecast_time(sql)
        
        # Final validation - ensure SQL is not empty and looks complete
        sql = sql.strip()
        if not sql:
            raise ValueError("Generated SQL is empty")
        
        # Log the SQL for debugging (optional, can be removed in production)
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Generated SQL: {sql[:200]}...")
        
        return sql

