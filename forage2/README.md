# OmniLearn AI — Real-Time Multimodal STEM Tutor & Accessibility Companion

OmniLearn AI is a real-time multimodal STEM tutoring workspace powered by LiveKit WebRTC, OpenAI GPT-4.1-mini, Deepgram Nova-3, and Cartesia Sonic-3.

---

## 🌟 Key Features

1. **Interactive Teacher Whiteboard with Real-Time AI Vision**:
   - Draw projectile motion curves, vector arrows, circuits, and physics problems on the canvas.
   - Click **"Ask AI to Solve Drawing"** or speak to have OmniLearn analyze your drawing and calculate velocity components ($u_x, u_y$), max height ($H_{max}$), flight time ($T$), and range ($R$).
   - The AI actively draws parabolic trajectories, velocity vectors, free-body force diagrams, and formula cards onto the board in real time.
2. **VS Code-Style Code Studio**:
   - Live syntax-highlighted code editor (Python, C++, JS) with simulated runtime terminal execution.
3. **Dedicated Live Lecture Notes Notebook**:
   - Automatically extracts formulas, key takeaways, and bullet points into structured markdown notes with one-click `.md` export.
4. **Accessible Low-Latency Voice & Chat**:
   - Real-time conversational speech with adjustable calm pacing, live subtitle stream, and text chat.

---

## 🛠️ Prerequisites

- **Python 3.10+** (or [uv](https://github.com/astral-sh/uv) package manager)
- **LiveKit Cloud credentials** (URL, API Key, API Secret)

Ensure your `.env` file exists in `forage2/.env` (or root directory):
```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
PORT=7860
```

---

## 🚀 How to Run the Project

### Option A: Using `uv` (Recommended)

1. **Start the Web Server** (serves frontend & WebRTC token API on port 7860):
   ```bash
   uv run python forage2/server.py
   ```

2. **Start the AI Voice Agent Worker** (in a second terminal):
   ```bash
   uv run python forage2/agent.py dev
   ```

3. **Open the Workspace**:
   Open **[http://localhost:7860](http://localhost:7860)** in your browser.

---

### Option B: Using Standard Python & `pip`

1. **Install Dependencies**:
   ```bash
   pip install livekit-agents livekit-api aiohttp python-dotenv
   ```

2. **Start the Web Server**:
   ```bash
   python forage2/server.py
   ```

3. **Start the Voice Agent**:
   ```bash
   python forage2/agent.py dev
   ```

4. **Access the App**:
   Navigate to **[http://localhost:7860](http://localhost:7860)**, click **Start Call**, and begin learning!
