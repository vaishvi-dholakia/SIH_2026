import os
import sys
import uvicorn

# Ensure the backend directory is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import settings
from app.main import app

if __name__ == "__main__":
    print("=" * 70)
    print(f"Starting {settings.PROJECT_NAME}")
    print(f"Swagger API Docs: http://localhost:{settings.PORT}/docs")
    print(f"WebSocket Alert Stream: ws://localhost:{settings.PORT}/ws/alerts")
    print("=" * 70)
    app_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        reload_dirs=[app_dir]
    )
