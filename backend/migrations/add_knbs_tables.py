"""
Add KNBS Economic Data Tables
Migration for KNBS integration - Population, GDP, Economic Indicators, Poverty Indices

Run this migration with:
    python backend/migrations/add_knbs_tables.py
"""

CREATE_POPULATION_DATA_TABLE = """
CREATE TABLE IF NOT EXISTS population_data (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    total_population BIGINT NOT NULL,
    male_population BIGINT,
    female_population BIGINT,
    urban_population BIGINT,
    rural_population BIGINT,
    population_density NUMERIC(10, 2),
    source_document_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_population_entity_year ON population_data(entity_id, year);
CREATE INDEX IF NOT EXISTS idx_population_year ON population_data(year);

COMMENT ON TABLE population_data IS 'Population data from KNBS publications';
COMMENT ON COLUMN population_data.entity_id IS 'NULL for national data, county_id for county-level';
COMMENT ON COLUMN population_data.population_density IS 'People per square kilometer';
"""

CREATE_GDP_DATA_TABLE = """
CREATE TABLE IF NOT EXISTS gdp_data (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    quarter VARCHAR(2),
    gdp_value NUMERIC(20, 2) NOT NULL,
    gdp_growth_rate NUMERIC(5, 2),
    currency VARCHAR(3) NOT NULL DEFAULT 'KES',
    source_document_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gdp_entity_year ON gdp_data(entity_id, year);
CREATE INDEX IF NOT EXISTS idx_gdp_year_quarter ON gdp_data(year, quarter);
CREATE INDEX IF NOT EXISTS idx_gdp_quarter ON gdp_data(quarter);

COMMENT ON TABLE gdp_data IS 'GDP and Gross County Product data from KNBS';
COMMENT ON COLUMN gdp_data.entity_id IS 'NULL for national GDP, county_id for Gross County Product';
COMMENT ON COLUMN gdp_data.quarter IS 'Q1, Q2, Q3, or Q4. NULL for annual data';
COMMENT ON COLUMN gdp_data.gdp_value IS 'GDP value in KES';
COMMENT ON COLUMN gdp_data.gdp_growth_rate IS 'GDP growth rate as percentage';
"""

CREATE_ECONOMIC_INDICATORS_TABLE = """
CREATE TABLE IF NOT EXISTS economic_indicators (
    id SERIAL PRIMARY KEY,
    indicator_type VARCHAR(50) NOT NULL,
    indicator_date TIMESTAMP NOT NULL,
    value NUMERIC(10, 2) NOT NULL,
    entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
    unit VARCHAR(20),
    source_document_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_indicators_type_date ON economic_indicators(indicator_type, indicator_date);
CREATE INDEX IF NOT EXISTS idx_indicators_date ON economic_indicators(indicator_date);
CREATE INDEX IF NOT EXISTS idx_indicators_entity ON economic_indicators(entity_id);

COMMENT ON TABLE economic_indicators IS 'Economic indicators from KNBS (CPI, PPI, inflation, unemployment, etc.)';
COMMENT ON COLUMN economic_indicators.indicator_type IS 'CPI, PPI, inflation_rate, unemployment_rate, etc.';
COMMENT ON COLUMN economic_indicators.entity_id IS 'NULL for national indicators, county_id for county-level';
COMMENT ON COLUMN economic_indicators.unit IS 'percent, index, etc.';
"""

CREATE_POVERTY_INDICES_TABLE = """
CREATE TABLE IF NOT EXISTS poverty_indices (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
    year INTEGER NOT NULL,
    poverty_headcount_rate NUMERIC(5, 2),
    extreme_poverty_rate NUMERIC(5, 2),
    gini_coefficient NUMERIC(4, 3),
    source_document_id INTEGER REFERENCES source_documents(id) ON DELETE SET NULL,
    source_page INTEGER,
    confidence NUMERIC(3, 2) DEFAULT 1.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poverty_entity_year ON poverty_indices(entity_id, year);
CREATE INDEX IF NOT EXISTS idx_poverty_year ON poverty_indices(year);

COMMENT ON TABLE poverty_indices IS 'Poverty indices from KNBS publications';
COMMENT ON COLUMN poverty_indices.entity_id IS 'NULL for national data, county_id for county-level';
COMMENT ON COLUMN poverty_indices.poverty_headcount_rate IS 'Percentage of population below poverty line';
COMMENT ON COLUMN poverty_indices.extreme_poverty_rate IS 'Percentage of population below extreme poverty line';
COMMENT ON COLUMN poverty_indices.gini_coefficient IS 'Income inequality measure (0-1 scale)';
"""

DROP_TABLES = """
DROP TABLE IF EXISTS poverty_indices CASCADE;
DROP TABLE IF EXISTS economic_indicators CASCADE;
DROP TABLE IF EXISTS gdp_data CASCADE;
DROP TABLE IF EXISTS population_data CASCADE;
"""


def run_migration(db_connection):
    """Run the migration to create KNBS tables."""
    import logging

    logger = logging.getLogger(__name__)
    logger.info("🔄 Running KNBS tables migration...")

    cursor = db_connection.cursor()

    try:
        # Create tables
        logger.info("Creating population_data table...")
        cursor.execute(CREATE_POPULATION_DATA_TABLE)

        logger.info("Creating gdp_data table...")
        cursor.execute(CREATE_GDP_DATA_TABLE)

        logger.info("Creating economic_indicators table...")
        cursor.execute(CREATE_ECONOMIC_INDICATORS_TABLE)

        logger.info("Creating poverty_indices table...")
        cursor.execute(CREATE_POVERTY_INDICES_TABLE)

        db_connection.commit()
        logger.info("✅ KNBS tables created successfully!")

    except Exception as e:
        db_connection.rollback()
        logger.error(f"❌ Migration failed: {str(e)}")
        raise
    finally:
        cursor.close()


def rollback_migration(db_connection):
    """Rollback the migration (drop KNBS tables)."""
    import logging

    logger = logging.getLogger(__name__)
    logger.warning("⚠️ Rolling back KNBS tables migration...")

    cursor = db_connection.cursor()

    try:
        cursor.execute(DROP_TABLES)
        db_connection.commit()
        logger.info("✅ KNBS tables dropped successfully")

    except Exception as e:
        db_connection.rollback()
        logger.error(f"❌ Rollback failed: {str(e)}")
        raise
    finally:
        cursor.close()


if __name__ == "__main__":
    import logging
    import os
    import sys

    import psycopg2
    from dotenv import load_dotenv

    # Load environment variables from backend/.env
    load_dotenv("backend/.env")

    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)

    # Get database connection from environment or use defaults
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "audit_db")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_SSLMODE = os.getenv("DB_SSLMODE", "prefer")

    try:
        # Connect to database
        logger.info(f"Connecting to database: {DB_NAME}@{DB_HOST}:{DB_PORT}")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            sslmode=DB_SSLMODE,
        )

        # Check command line argument
        if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
            rollback_migration(conn)
        else:
            run_migration(conn)

        conn.close()
        logger.info("✅ Migration complete!")

    except psycopg2.OperationalError as e:
        logger.error(f"❌ Database connection failed: {str(e)}")
        logger.info("Note: Make sure PostgreSQL is running and database exists")
        logger.info("You can create the database with: createdb audit_db")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        sys.exit(1)
