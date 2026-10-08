# Nova Voice AI — Forage 2

Next-generation Realtime Voice AI Assistant and interactive Web Application powered by LiveKit WebRTC.

## Architecture

- **`agent.py`**: LiveKit Voice Agent worker (STT with Deepgram Nova-3, LLM with OpenAI GPT-4.1-mini, TTS with Cartesia Sonic-3).
- **`server.py`**: Python `aiohttp` web server providing the token generation endpoint (`/api/token`) and serving the frontend.
- **`static/`**:
  - `index.html`: Responsive voice assistant interface.
  - `style.css`: Dark glassmorphism design system.
  - `app.js`: LiveKit WebRTC browser client with audio visualizer and real-time captions.

---

## How to Run

### 1. Start the Web Server (Frontend & Token Endpoint)
```bash
uv run python forage2/server.py
```
Open your browser at **http://localhost:7860**.

### 2. Start the Voice Agent Worker (in a separate terminal)
```bash
uv run python forage2/agent.py dev
```

### 3. Start Talking
In your browser at `http://localhost:7860`, click **Start Call**, allow microphone access, and speak directly with Nova!
