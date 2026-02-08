"""
Setup Text2SQL database with MC4 schema
"""
import os
import sys
import json

# Add parent directory to path to find Text2SQL_V2
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Add Text2SQL_V2 to path
text2sql_path = os.path.join(parent_dir, "Text2SQL_V2")
if text2sql_path not in sys.path:
    sys.path.insert(0, text2sql_path)

# Now import from Text2SQL_V2 modules (they're in the path)
from core.db_builder import build_database, execute_sql
from core.schema_loader import SchemaLoader

# MC4 Schema for Text2SQL
# Get absolute paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
datasets_dir = os.path.join(backend_dir, "datasets")

MC4_SCHEMA = [
    {
        "table_name": "sku_forecast",
        "path": os.path.join(datasets_dir, "sku_forecast.csv"),
    },
    {
        "table_name": "sku_master",
        "path": os.path.join(datasets_dir, "sku_master.csv"),
    },
    {
        "table_name": "recipe_master",
        "path": os.path.join(datasets_dir, "recipe_master.csv"),
    },
    {
        "table_name": "recipe_time",
        "path": os.path.join(datasets_dir, "recipe_time.csv"),
    },
    {
        "table_name": "recipe_time_weekly",
        "path": os.path.join(datasets_dir, "recipe_time_weekly.csv"),
    },
    {
        "table_name": "recipe_time_monthly",
        "path": os.path.join(datasets_dir, "recipe_time_monthly.csv"),
    },
    {
        "table_name": "recipe_time_yearly",
        "path": os.path.join(datasets_dir, "recipe_time_yearly.csv"),
    },
    {
        "table_name": "mill_master",
        "path": os.path.join(datasets_dir, "mill_master.csv"),
    },
    {
        "table_name": "mill_load",
        "path": os.path.join(datasets_dir, "mill_load.csv"),
    },
    {
        "table_name": "mill_capacity",
        "path": os.path.join(datasets_dir, "mill_capacity.csv"),
    },
    {
        "table_name": "flour_demand",
        "path": os.path.join(datasets_dir, "flour_demand.csv"),
    },
    {
        "table_name": "recipe_allocation",
        "path": os.path.join(datasets_dir, "recipe_allocation.csv"),
    },
    {
        "table_name": "raw_material",
        "path": os.path.join(datasets_dir, "raw_material.csv"),
    },
    {
        "table_name": "time_dimension",
        "path": os.path.join(datasets_dir, "time_dimension.csv"),
    },
]

def setup_database():
    """Setup SQLite database for Text2SQL"""
    parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(parent_dir, "Text2SQL_V2", "chatbot.db")
    
    print("🔄 Building MC4 database for Text2SQL...")
    build_database(MC4_SCHEMA, db_path)
    
    print("✅ Database setup complete!")
    print(f"📁 Database location: {db_path}")
    
    # Load schema for metadata
    schema_loader = SchemaLoader(MC4_SCHEMA)
    loaded_schema = schema_loader.load()
    
    # SchemaLoader.load() returns a list, so just use MC4_SCHEMA for table names
    print(f"📊 Loaded {len(MC4_SCHEMA)} tables:")
    for table_info in MC4_SCHEMA:
        print(f"   - {table_info['table_name']}")

if __name__ == "__main__":
    setup_database()
