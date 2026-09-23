"""NEXTRACE AI — WebSocket Handler"""
from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.services.live_session import live_session

router = APIRouter()


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    """
    Stream live demo traffic events to connected clients.
    Message types: packet_event | temporal_state | session_status
    """
    await websocket.accept()

    # Register this client to receive broadcasts
    queue = live_session.register_client()

    # Immediately send current session status so client is in sync
    try:
        await websocket.send_text(json.dumps({
            "type": "session_status",
            "data": live_session.get_status(),
        }))
    except Exception:
        pass

    try:
        # Two concurrent tasks:
        # 1. Forward queue messages to the WebSocket client
        # 2. Receive keep-alive / ping messages from client
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
        live_session.unregister_client(queue)


async def _forward(queue: asyncio.Queue, websocket: WebSocket) -> None:
    """Drain the broadcast queue and forward messages to this WebSocket client."""
    while True:
        try:
            msg = await asyncio.wait_for(queue.get(), timeout=30)
            await websocket.send_text(msg)
        except asyncio.TimeoutError:
            # Send a ping to keep the connection alive
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
