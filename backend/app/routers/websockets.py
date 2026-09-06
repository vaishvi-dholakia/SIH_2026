import json
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.services.historical_backfill import HistoricalBackfillService

logger = logging.getLogger("geoscd.websockets")

router = APIRouter(tags=["Real-time Alerts & Admin"])

class ConnectionManager:
    """Manages active WebSocket connections for real-time alert broadcasts."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcasts JSON payload to all connected frontend clients."""
        text_data = json.dumps(message)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                dead_connections.append(connection)
        
        for dead in dead_connections:
            self.disconnect(dead)

ws_manager = ConnectionManager()

@router.websocket("/ws/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket channel pushing instantaneous emergency updates
    directly to connected Command Deck frontend clients.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep-alive receive loop
            data = await websocket.receive_text()
            # Respond to ping or client queries if needed
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "PONG"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(websocket)

async def _run_backfill_task(limit: int):
    """Background execution runner for backfill."""
    db = SessionLocal()
    try:
        res = await HistoricalBackfillService.run_backfill(db, limit=limit)
        logger.info(f"Background backfill finished: {res}")
        await ws_manager.broadcast({
            "type": "BACKFILL_COMPLETED",
            "details": res
        })
    except Exception as e:
        logger.error(f"Error running background backfill: {e}")
    finally:
        db.close()

@router.post("/api/admin/backfill")
async def trigger_historical_backfill(
    background_tasks: BackgroundTasks,
    limit: int = 200,
    db: Session = Depends(get_db)
):
    """
    Manually triggers authentic historical NASA FIRMS archive backfill.
    Runs asynchronously and updates ActiveHotspots and ML training baselines.
    """
    background_tasks.add_task(_run_backfill_task, limit)
    return {
        "status": "initiated",
        "message": f"Historical NASA FIRMS backfill initiated in background (limit: {limit} records)."
    }
