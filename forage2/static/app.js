/**
 * Nova Voice AI Web Client
 * LiveKit WebRTC Real-Time Voice Agent Controller
 */

class VoiceAIApp {
  constructor() {
    this.room = null;
    this.isConnected = false;
    this.isMicMuted = false;
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.animationFrameId = null;
    this.remoteAudioElement = null;

    // Room configs
    this.roomName = 'nova-voice-room';
    this.userName = 'User_' + Math.floor(Math.random() * 1000);
    this.serverUrl = '';

    // Cache DOM elements
    this.dom = {
      connectBtn: document.getElementById('connectBtn'),
      connectBtnText: document.getElementById('connectBtnText'),
      micToggleBtn: document.getElementById('micToggleBtn'),
      audioOutputBtn: document.getElementById('audioOutputBtn'),
      connectionStatus: document.getElementById('connectionStatus'),
      agentStateText: document.getElementById('agentStateText'),
      agentSubtext: document.getElementById('agentSubtext'),
      orbContainer: document.getElementById('orbContainer'),
      orbCore: document.getElementById('orbCore'),
      visualizerCanvas: document.getElementById('visualizerCanvas'),
      subtitleCard: document.getElementById('subtitleCard'),
      subtitleSpeaker: document.getElementById('subtitleSpeaker'),
      subtitleContent: document.getElementById('subtitleContent'),
      transcriptDrawer: document.getElementById('transcriptDrawer'),
      transcriptStream: document.getElementById('transcriptStream'),
      toggleTranscriptBtn: document.getElementById('toggleTranscriptBtn'),
      closeDrawerBtn: document.getElementById('closeDrawerBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      roomInput: document.getElementById('roomInput'),
      userNameInput: document.getElementById('userNameInput'),
      serverUrlDisplay: document.getElementById('serverUrlDisplay'),
      roomNameDisplay: document.getElementById('roomNameDisplay'),
      latencyDisplay: document.getElementById('latencyDisplay'),
      qualityDisplay: document.getElementById('qualityDisplay'),
      promptChips: document.querySelectorAll('.prompt-chip'),
      chatForm: document.getElementById('chatForm'),
      chatInput: document.getElementById('chatInput'),
      chatSendBtn: document.getElementById('chatSendBtn'),
    };

    this.canvasCtx = this.dom.visualizerCanvas.getContext('2d');
    this.init();
  }

  async init() {
    this.bindEvents();
    this.initCanvasVisualizer();
    await this.fetchServerStatus();
  }

  bindEvents() {
    this.dom.connectBtn.addEventListener('click', () => this.toggleConnection());
    this.dom.micToggleBtn.addEventListener('click', () => this.toggleMicrophone());
    this.dom.toggleTranscriptBtn.addEventListener('click', () => this.toggleTranscriptDrawer());
    this.dom.closeDrawerBtn.addEventListener('click', () => this.toggleTranscriptDrawer(false));
    
    // Chat form submit
    if (this.dom.chatForm) {
      this.dom.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.dom.chatInput.value.trim();
        if (text) {
          this.sendTextMessage(text);
          this.dom.chatInput.value = '';
        }
      });
    }

    // Settings modal
    this.dom.settingsBtn.addEventListener('click', () => this.dom.settingsModal.classList.add('open'));
    this.dom.closeSettingsBtn.addEventListener('click', () => this.dom.settingsModal.classList.remove('open'));
    this.dom.saveSettingsBtn.addEventListener('click', () => {
      this.roomName = this.dom.roomInput.value.trim() || 'nova-voice-room';
      this.userName = this.dom.userNameInput.value.trim() || 'User';
      this.dom.roomNameDisplay.textContent = this.roomName;
      this.dom.settingsModal.classList.remove('open');
    });

    // Quick prompts
    this.dom.promptChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-prompt');
        if (promptText) {
          this.sendTextMessage(promptText);
        }
      });
    });
  }

  async fetchServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.serverUrl) {
        this.serverUrl = data.serverUrl;
        this.dom.serverUrlDisplay.value = data.serverUrl;
      }
    } catch (err) {
      console.warn('Status fetch error:', err);
    }
  }

  toggleTranscriptDrawer(forceState) {
    if (forceState !== undefined) {
      this.dom.transcriptDrawer.classList.toggle('open', forceState);
    } else {
      this.dom.transcriptDrawer.classList.toggle('open');
    }
  }

  async sendTextMessage(text) {
    if (!text || !text.trim()) return;
    const msg = text.trim();

    // Auto-open transcript drawer if closed
    this.toggleTranscriptDrawer(true);

    // If not currently connected, auto-connect first
    if (!this.isConnected) {
      this.appendMessage('user', msg);
      this.setSubtitles('You', msg);
      this.appendMessage('system', 'Starting voice session to deliver your message...');
      await this.connect();
      // Wait for session and data channel to be ready
      await new Promise(r => setTimeout(r, 1200));
    } else {
      this.appendMessage('user', msg);
      this.setSubtitles('You', msg);
    }

    try {
      if (this.room && this.room.localParticipant) {
        // Send via chat text stream / sendChatMessage if supported
        if (typeof this.room.localParticipant.sendChatMessage === 'function') {
          await this.room.localParticipant.sendChatMessage(msg);
        }

        // Publish via reliable DataPacket on topic 'lk.chat'
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify({ message: msg, text: msg }));
        await this.room.localParticipant.publishData(payload, {
          reliable: true,
          topic: 'lk.chat',
        });
      }
    } catch (err) {
      console.warn('Error sending text message to agent:', err);
    }
  }

  async toggleConnection() {
    if (this.isConnected) {
      await this.disconnect();
    } else {
      await this.connect();
    }
  }

  async connect() {
    this.roomName = 'nova-' + Math.random().toString(36).substring(2, 8);
    this.setConnectionState('connecting', 'Connecting...');
    this.dom.agentStateText.textContent = 'Joining Room...';
    this.dom.agentSubtext.textContent = 'Connecting to LiveKit WebRTC gateway...';
    this.dom.connectBtn.disabled = true;

    try {
      // 1. Fetch access token from backend server
      const tokenUrl = `/api/token?room=${encodeURIComponent(this.roomName)}&identity=${encodeURIComponent(this.userName)}&name=${encodeURIComponent(this.userName)}`;
      const res = await fetch(tokenUrl);
      if (!res.ok) {
        throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
      }
      const data = await res.json();
      const { token, serverUrl } = data;

      // 2. Instantiate LiveKit Room
      this.room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.setupRoomListeners();

      // 3. Connect to room
      await this.room.connect(serverUrl, token);
      console.log('✨ Connected to LiveKit room:', this.room.name);

      // 4. Publish local microphone
      await this.room.localParticipant.setMicrophoneEnabled(true);
      this.setupAudioAnalysis(this.room.localParticipant);

      // Update state
      this.isConnected = true;
      this.dom.connectBtn.disabled = false;
      this.dom.micToggleBtn.disabled = false;
      this.dom.connectBtn.classList.add('connected');
      this.dom.connectBtnText.textContent = 'End Call';
      this.setConnectionState('connected', 'Live');
      this.dom.agentStateText.textContent = 'Nova is Listening';
      this.dom.agentSubtext.textContent = 'Speak naturally into your microphone';
      this.setOrbState('listening');

      this.appendSystemMessage(`Connected to room "${this.room.name}" as "${this.userName}".`);
      this.dom.roomNameDisplay.textContent = this.room.name;

    } catch (err) {
      console.error('Connection error:', err);
      this.setConnectionState('disconnected', 'Failed');
      this.dom.agentStateText.textContent = 'Connection Failed';
      this.dom.agentSubtext.textContent = err.message || 'Check LiveKit server URL and credentials';
      this.dom.connectBtn.disabled = false;
      this.setOrbState('idle');
      this.appendSystemMessage(`Connection error: ${err.message}`);
    }
  }

  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.remove();
      this.remoteAudioElement = null;
    }

    this.isConnected = false;
    this.dom.connectBtn.classList.remove('connected');
    this.dom.connectBtnText.textContent = 'Start Call';
    this.dom.micToggleBtn.disabled = true;
    this.dom.micToggleBtn.classList.remove('active');
    this.setConnectionState('disconnected', 'Disconnected');
    this.dom.agentStateText.textContent = 'Ready to Connect';
    this.dom.agentSubtext.textContent = 'Click start to begin conversational voice interaction';
    this.setOrbState('idle');
    this.setSubtitles('Nova', 'Call ended. Press Start Call to speak again.');
    this.appendSystemMessage('Call ended.');
  }

  async toggleMicrophone() {
    if (!this.room || !this.isConnected) return;
    this.isMicMuted = !this.isMicMuted;
    await this.room.localParticipant.setMicrophoneEnabled(!this.isMicMuted);
    
    if (this.isMicMuted) {
      this.dom.micToggleBtn.classList.add('active');
      this.dom.micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
      this.dom.agentStateText.textContent = 'Microphone Muted';
      this.setOrbState('idle');
    } else {
      this.dom.micToggleBtn.classList.remove('active');
      this.dom.micToggleBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
      this.dom.agentStateText.textContent = 'Nova is Listening';
      this.setOrbState('listening');
    }
  }

  setupRoomListeners() {
    // Participant connected
    this.room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant joined:', participant.identity);
      this.appendSystemMessage(`Agent / Participant "${participant.name || participant.identity}" joined.`);
      this.dom.agentStateText.textContent = 'Nova Connected';
    });

    // Participant disconnected
    this.room.on(LivekitClient.RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant left:', participant.identity);
      this.appendSystemMessage(`Participant "${participant.name || participant.identity}" left.`);
    });

    // Remote Track subscribed (Agent audio)
    this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === LivekitClient.Track.Kind.Audio) {
        console.log('Subscribed to remote audio track from:', participant.identity);
        this.remoteAudioElement = track.attach();
        document.body.appendChild(this.remoteAudioElement);
        this.setupAudioAnalysis(participant, track.mediaStream);
        this.setOrbState('speaking');
        this.dom.agentStateText.textContent = 'Nova is Speaking';
      }
    });

    this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    // Live transcription stream
    this.room.on(LivekitClient.RoomEvent.TranscriptionReceived, (transcriptions, participant) => {
      for (const t of transcriptions) {
        const isAgent = participant && (participant.identity.includes('agent') || participant.identity.includes('nova'));
        const speaker = isAgent ? 'Nova' : 'You';
        const text = t.text;
        
        if (text && text.trim()) {
          this.setSubtitles(speaker, text);
          if (t.final) {
            this.appendMessage(isAgent ? 'agent' : 'user', text);
          }
        }
      }
    });

    // Connection quality & telemetry
    this.room.on(LivekitClient.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant === this.room.localParticipant) {
        this.dom.qualityDisplay.textContent = quality || 'Good';
      }
    });

    // Ping / RTT
    setInterval(() => {
      if (this.room && this.room.engine && this.room.engine.client) {
        const rtt = this.room.engine.client.rtt;
        if (rtt !== undefined) {
          this.dom.latencyDisplay.textContent = `${Math.round(rtt)} ms`;
        }
      }
    }, 2000);

    // Disconnected
    this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
      this.disconnect();
    });
  }

  setupAudioAnalysis(participant, mediaStream) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      if (mediaStream) {
        const source = this.audioContext.createMediaStreamSource(mediaStream);
        source.connect(this.analyser);
      }
    } catch (e) {
      console.warn('Audio analysis setup error:', e);
    }
  }

  setConnectionState(stateClass, label) {
    this.dom.connectionStatus.className = `status-pill ${stateClass}`;
    this.dom.connectionStatus.querySelector('.status-text').textContent = label;
  }

  setOrbState(state) {
    this.dom.orbContainer.className = `orb-container ${state}`;
  }

  setSubtitles(speaker, text) {
    this.dom.subtitleSpeaker.innerHTML = speaker === 'Nova' 
      ? '<i class="fa-solid fa-sparkles"></i> <span>Nova</span>'
      : '<i class="fa-solid fa-user"></i> <span>You</span>';
    this.dom.subtitleContent.textContent = `"${text}"`;
  }

  appendMessage(type, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `message ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgEl.appendChild(bubble);
    msgEl.appendChild(meta);
    this.dom.transcriptStream.appendChild(msgEl);
    this.dom.transcriptStream.scrollTop = this.dom.transcriptStream.scrollHeight;
  }

  appendSystemMessage(text) {
    const msgEl = document.createElement('div');
    msgEl.className = 'message system-msg';
    msgEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${text}</span>`;
    this.dom.transcriptStream.appendChild(msgEl);
    this.dom.transcriptStream.scrollTop = this.dom.transcriptStream.scrollHeight;
  }

  initCanvasVisualizer() {
    const canvas = this.dom.visualizerCanvas;
    const ctx = this.canvasCtx;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    let angle = 0;

    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let avgVolume = 0;
      if (this.analyser && this.dataArray && this.isConnected) {
        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          sum += this.dataArray[i];
        }
        avgVolume = sum / this.dataArray.length;
      }

      // Dynamic waveform circle
      const radius = 100 + (avgVolume * 0.4);
      const bars = 48;
      angle += 0.01;

      for (let i = 0; i < bars; i++) {
        const rad = (i * Math.PI * 2) / bars + angle;
        const val = this.dataArray ? (this.dataArray[i % this.dataArray.length] || 0) : 0;
        const barHeight = Math.max(4, (val / 255) * 60 + Math.sin(angle * 3 + i) * 6);

        const x1 = centerX + Math.cos(rad) * radius;
        const y1 = centerY + Math.sin(rad) * radius;
        const x2 = centerX + Math.cos(rad) * (radius + barHeight);
        const y2 = centerY + Math.sin(rad) * (radius + barHeight);

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.9)');

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Dynamic scale of core orb based on volume
      if (avgVolume > 15) {
        const scale = 1 + (avgVolume / 255) * 0.25;
        this.dom.orbCore.style.transform = `scale(${scale})`;
      } else {
        this.dom.orbCore.style.transform = '';
      }
    };

    render();
  }
}

// Instantiate on load
document.addEventListener('DOMContentLoaded', () => {
  window.novaVoiceApp = new VoiceAIApp();
});
