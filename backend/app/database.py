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
    
    engine = None
    if is_postgres:
        try:
            logger.info("Attempting connection to primary PostgreSQL database...")
            # Try connecting to PostgreSQL with short timeout to detect availability
            test_engine = create_engine(
                primary_url,
                connect_args={"connect_timeout": 3},
                pool_pre_ping=True
            )
            with test_engine.connect() as conn:
                # Check for PostGIS or create extension if permitted
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
            logger.info("Falling back to local SQLite database with Shapely spatial engine.")
            sqlite_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "geoscd.db")
            sqlite_url = f"sqlite:///{sqlite_path}"
            engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    else:
        logger.info("Using SQLite database.")
        engine = create_engine(primary_url, connect_args={"check_same_thread": False})

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

def init_db():
    """Initializes all database tables."""
    from app.models import refinery, population, hotspot, suppression  # ensure all models registered
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

# Auto-initialize tables so they are always present
try:
    init_db()
except Exception as _e:
    logger.warning(f"Note on initial db setup: {_e}")
