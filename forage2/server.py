import logging
import os
import uuid
from pathlib import Path
from aiohttp import web
from dotenv import load_dotenv

from livekit import api

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("forage2-web-server")

# Load environment
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip()
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()
PORT = int(os.getenv("PORT", "7860"))

STATIC_DIR = Path(__file__).resolve().parent / "static"


async def get_token_handler(request: web.Request) -> web.Response:
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
        return web.json_response(
            {"error": "LiveKit API Key, Secret, or URL is not configured in .env"},
            status=500,
        )

    room_name = request.query.get("room", f"room-{uuid.uuid4().hex[:6]}")
    identity = request.query.get("identity", f"user-{uuid.uuid4().hex[:6]}")
    name = request.query.get("name", "User")

    try:
        token = (
            api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
            .with_identity(identity)
            .with_name(name)
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
            .to_jwt()
        )

        return web.json_response(
            {
                "serverUrl": LIVEKIT_URL,
                "token": token,
                "room": room_name,
                "identity": identity,
            }
        )
    except Exception as e:
        logger.error(f"Error generating token: {e}", exc_info=True)
        return web.json_response({"error": str(e)}, status=500)


async def status_handler(request: web.Request) -> web.Response:
    has_creds = bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET)
    return web.json_response(
        {
            "status": "ready" if has_creds else "missing_credentials",
            "serverUrl": LIVEKIT_URL,
            "hasCredentials": has_creds,
        }
    )


async def index_handler(request: web.Request) -> web.Response:
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return web.Response(text="Frontend index.html not found.", status=404)
    return web.FileResponse(index_file)


def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", index_handler)
    app.router.add_get("/api/token", get_token_handler)
    app.router.add_get("/api/status", status_handler)
    if STATIC_DIR.exists():
        app.router.add_static("/static/", STATIC_DIR, show_index=False)
    return app


if __name__ == "__main__":
    app = create_app()
    logger.info(f"✨ Forage 2 Voice AI Web Server starting at http://localhost:{PORT}")
    web.run_app(app, host="0.0.0.0", port=PORT)
