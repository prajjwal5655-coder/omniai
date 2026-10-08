import json
import os
import urllib.parse
import uuid
from http.server import BaseHTTPRequestHandler
from livekit import api


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip()
        LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
        LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()

        # 1. Status Check endpoint
        if path.endswith("/status") or "status" in path:
            has_creds = bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET)
            resp = {
                "status": "ready" if has_creds else "missing_credentials",
                "serverUrl": LIVEKIT_URL,
                "hasCredentials": has_creds,
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        # 2. Token generation endpoint
        if path.endswith("/token") or "token" in path:
            if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {"error": "LiveKit credentials not configured in environment"}
                    ).encode("utf-8")
                )
                return

            room_name = query.get("room", [f"room-{uuid.uuid4().hex[:6]}"])[0]
            identity = query.get("identity", [f"user-{uuid.uuid4().hex[:6]}"])[0]
            name = query.get("name", ["User"])[0]

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

                resp = {
                    "serverUrl": LIVEKIT_URL,
                    "token": token,
                    "room": room_name,
                    "identity": identity,
                }
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(resp).encode("utf-8"))
                return
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
                return

        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))
