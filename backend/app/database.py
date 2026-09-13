import logging
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

logger = logging.getLogger("geoscd.database")

Base = declarative_base()

def get_engine_and_session():
    primary_url = settings.DATABASE_URL
    is_postgres = primary_url.startswith("postgresql")
    
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sqlite_path = os.path.join(backend_dir, "geoscd.db").replace("\\", "/")
    sqlite_url = f"sqlite:///{sqlite_path}"

    engine = None
    if is_postgres:
        try:
            logger.info("Attempting connection to primary PostgreSQL database...")
            test_engine = create_engine(
                primary_url,
                connect_args={"connect_timeout": 3},
                pool_pre_ping=True
            )
            with test_engine.connect() as conn:
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                    conn.commit()
                    logger.info("PostGIS extension verified on PostgreSQL.")
                except Exception:
                    conn.rollback()
                    logger.info("PostGIS extension not present; utilizing Shapely for spatial operations.")
            engine = test_engine
            logger.info("Successfully connected to PostgreSQL.")
        except Exception as e:
            logger.warning(f"PostgreSQL connection failed: {e}")
            logger.info(f"Falling back to local SQLite database: {sqlite_url}")
            engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    else:
        logger.info(f"Using SQLite database: {sqlite_url}")
        engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine, SessionLocal


engine, SessionLocal = get_engine_and_session()

def get_db():
    """FastAPI Dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sync_schema(target_engine):
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(target_engine)
        existing_tables = inspector.get_table_names()
        
        for table_name, table in Base.metadata.tables.items():
            if table_name in existing_tables:
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                with target_engine.connect() as conn:
                    for col in table.columns:
                        if col.name not in existing_columns:
                            col_type = col.type.compile(target_engine.dialect)
                            default_sql = ""
                            if col.default is not None and getattr(col.default, 'arg', None) is not None:
                                val = col.default.arg
                                if isinstance(val, (int, float)):
                                    default_sql = f" DEFAULT {val}"
                                elif isinstance(val, bool):
                                    default_sql = f" DEFAULT {'TRUE' if val else 'FALSE'}"
                                elif isinstance(val, str):
                                    default_sql = f" DEFAULT '{val}'"
                            elif col.nullable:
                                default_sql = " DEFAULT NULL"
                            else:
                                default_sql = " DEFAULT 0"
                                
                            try:
                                alter_stmt = text(f'ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_sql}')
                                conn.execute(alter_stmt)
                                conn.commit()
                                logger.info(f"Automatically added missing column '{col.name}' ({col_type}) to table '{table_name}'.")
                            except Exception as err:
                                conn.rollback()
                                logger.warning(f"Could not add missing column '{col.name}' to table '{table_name}': {err}")
    except Exception as e:
        logger.warning(f"Schema sync encountered non-fatal notice: {e}")

def init_db():
    """Initializes all database tables and syncs missing columns."""
    from app.models import (
        refinery, population, hotspot, suppression,
        forest, farmland, mine, landfill
    )  # ensure all models registered
    Base.metadata.create_all(bind=engine)
    sync_schema(engine)
    logger.info("Database tables initialized successfully.")

# Auto-initialize tables so they are always present
try:
    init_db()
except Exception as _e:
    logger.warning(f"Note on initial db setup: {_e}")

