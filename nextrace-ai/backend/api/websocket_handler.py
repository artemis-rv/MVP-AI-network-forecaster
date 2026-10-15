"""NEXTRACE AI — WebSocket Handler (per-user session routing)"""
from __future__ import annotations

import asyncio
import json
import re

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.session_manager import session_manager

router = APIRouter()

# Simple UUID4 pattern — reject obviously bad client_ids early
_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.I)


@router.websocket("/ws/live/{client_id}")
async def websocket_live(websocket: WebSocket, client_id: str) -> None:
    """
    Per-user live stream.  Each browser tab connects with its own UUID
    client_id so sessions are fully isolated.

    Message types: packet_event | temporal_state | session_status | forecast_update | new_alert | ping
    """
    if not _UUID_RE.match(client_id):
        await websocket.close(code=4400)
        return

    entry = await session_manager.acquire(client_id)
    if entry is None:
        await websocket.close(code=4503)
        return

    await websocket.accept()

    try:
        await websocket.send_text(json.dumps({
            "type": "session_status",
            "data": entry.session.get_status(),
        }))
    except Exception:
        pass

    queue = entry.session.register_client()
    try:
        send_task    = asyncio.create_task(_forward(queue, websocket))
        receive_task = asyncio.create_task(_receive(websocket))

        done, pending = await asyncio.wait(
            [send_task, receive_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        entry.session.unregister_client(queue)
        await session_manager.release(client_id)


@router.websocket("/ws/live")
async def websocket_live_legacy(websocket: WebSocket) -> None:
    """Legacy fallback — sends a redirect hint then closes."""
    await websocket.accept()
    await websocket.send_text(json.dumps({
        "type": "error",
        "code": "CLIENT_ID_REQUIRED",
        "detail": "Connect to /ws/live/{client_id} with your browser-generated UUID.",
    }))
    await websocket.close(code=4400)


async def _forward(queue: asyncio.Queue, websocket: WebSocket) -> None:
    """Drain the broadcast queue and forward messages to this WebSocket client."""
    while True:
        try:
            msg = await asyncio.wait_for(queue.get(), timeout=30)
            await websocket.send_text(msg)
        except asyncio.TimeoutError:
            try:
                await websocket.send_text('{"type":"ping"}')
            except Exception:
                break
        except Exception:
            break


async def _receive(websocket: WebSocket) -> None:
    """Consume incoming frames from the client (keep-alive / control messages)."""
    while True:
        try:
            await websocket.receive_text()
        except Exception:
            break
