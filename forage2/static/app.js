/**
 * OmniLearn AI — Interactive STEM Tutor Web Client
 * LiveKit WebRTC Voice & Chat Client, VS Code Studio, Teacher Whiteboard & AI Vision Engine, Live Notes
 */

class OmniLearnApp {
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
    this.roomName = 'omni-room';
    this.userName = 'Student_' + Math.floor(Math.random() * 1000);
    this.serverUrl = '';

    // Active View
    this.currentView = 'voice';

    // Whiteboard State
    this.wbCanvas = null;
    this.wbCtx = null;
    this.isDrawing = false;
    this.wbColor = '#00e5ff';
    this.wbSize = 3;
    this.wbTool = 'pen'; // 'pen' | 'eraser'
    this.lastX = 0;
    this.lastY = 0;
    this.userStrokes = []; // Array of strokes: [{points: [{x,y}], color, size}]
    this.currentStroke = null;
    this.lastDetectedGeometry = null;

    // Saved Notes List
    this.savedNotes = [];

    // Cache DOM Elements
    this.dom = {
      // Header & Nav
      navTabs: document.querySelectorAll('.nav-tab'),
      stageViews: document.querySelectorAll('.stage-view'),
      connectionStatus: document.getElementById('connectionStatus'),
      toggleDrawerBtn: document.getElementById('toggleDrawerBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),
      roomInput: document.getElementById('roomInput'),
      userNameInput: document.getElementById('userNameInput'),
      serverUrlDisplay: document.getElementById('serverUrlDisplay'),
      notesCountBadge: document.getElementById('notesCountBadge'),
      sidebarNotesCount: document.getElementById('sidebarNotesCount'),
      boardLiveBadge: document.getElementById('boardLiveBadge'),

      // Voice Stage
      connectBtn: document.getElementById('connectBtn'),
      connectBtnText: document.getElementById('connectBtnText'),
      micToggleBtn: document.getElementById('micToggleBtn'),
      audioOutputBtn: document.getElementById('audioOutputBtn'),
      agentStateText: document.getElementById('agentStateText'),
      agentSubtext: document.getElementById('agentSubtext'),
      orbCore: document.getElementById('orbCore'),
      visualizerCanvas: document.getElementById('visualizerCanvas'),
      subtitleCard: document.getElementById('subtitleCard'),
      subtitleSpeaker: document.getElementById('subtitleSpeaker'),
      subtitleContent: document.getElementById('subtitleContent'),
      promptChips: document.querySelectorAll('.prompt-chip'),

      // Teacher Whiteboard
      whiteboardCanvas: document.getElementById('whiteboardCanvas'),
      boardScanLine: document.getElementById('boardScanLine'),
      toolPen: document.getElementById('toolPen'),
      toolEraser: document.getElementById('toolEraser'),
      colorBtns: document.querySelectorAll('.color-btn'),
      btnClearBoard: document.getElementById('btnClearBoard'),
      btnDownloadBoard: document.getElementById('btnDownloadBoard'),
      btnScanAndExplain: document.getElementById('btnScanAndExplain'),
      btnDrawProjectile: document.getElementById('btnDrawProjectile'),
      btnDrawVector: document.getElementById('btnDrawVector'),
      btnDrawFBD: document.getElementById('btnDrawFBD'),
      btnDrawCircuit: document.getElementById('btnDrawCircuit'),
      btnDrawLinkedList: document.getElementById('btnDrawLinkedList'),
      btnDrawTree: document.getElementById('btnDrawTree'),
      boardStatusText: document.getElementById('boardStatusText'),

      // VS Code Studio
      codeEditorContent: document.getElementById('codeEditorContent'),
      codeFileName: document.getElementById('codeFileName'),
      btnRunCode: document.getElementById('btnRunCode'),
      btnCopyCode: document.getElementById('btnCopyCode'),
      btnClearCode: document.getElementById('btnClearCode'),
      terminalOutput: document.getElementById('terminalOutput'),
      btnClearTerminal: document.getElementById('btnClearTerminal'),
      codeCountBadge: document.getElementById('codeCountBadge'),

      // Notes Stage
      notesGrid: document.getElementById('notesGrid'),
      btnExportAllNotes: document.getElementById('btnExportAllNotes'),
      btnClearAllNotes: document.getElementById('btnClearAllNotes'),
      btnQuickExportNotes: document.getElementById('btnQuickExportNotes'),
      sidebarNotesList: document.getElementById('sidebarNotesList'),

      // Sidebar Drawer
      transcriptDrawer: document.getElementById('transcriptDrawer'),
      drawerTabBtns: document.querySelectorAll('.drawer-tab-btn'),
      drawerTabContents: document.querySelectorAll('.drawer-tab-content'),
      closeDrawerBtn: document.getElementById('closeDrawerBtn'),
      transcriptStream: document.getElementById('transcriptStream'),
      chatForm: document.getElementById('chatForm'),
      chatInput: document.getElementById('chatInput'),
      chatSendBtn: document.getElementById('chatSendBtn'),

      // Stats
      roomNameDisplay: document.getElementById('roomNameDisplay'),
      latencyDisplay: document.getElementById('latencyDisplay'),
      qualityDisplay: document.getElementById('qualityDisplay'),
    };

    this.canvasCtx = this.dom.visualizerCanvas.getContext('2d');
    this.init();
  }

  async init() {
    this.bindEvents();
    this.initCanvasVisualizer();
    this.initWhiteboard();
    await this.fetchServerStatus();
  }

  /* --------------------------------------------------------------------------
     Event Bindings & Tab Navigation
     -------------------------------------------------------------------------- */
  bindEvents() {
    // Mode switcher (Voice / Whiteboard / Code / Notes)
    this.dom.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.getAttribute('data-view');
        this.switchStageView(viewName);
      });
    });

    // Sidebar drawer tabs (Chat / Notes / Stats)
    this.dom.drawerTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-drawer-tab');
        this.switchDrawerTab(targetTab);
      });
    });

    // Voice connection controls
    this.dom.connectBtn.addEventListener('click', () => this.toggleConnection());
    this.dom.micToggleBtn.addEventListener('click', () => this.toggleMicrophone());
    this.dom.toggleDrawerBtn.addEventListener('click', () => this.toggleSidebarDrawer());
    this.dom.closeDrawerBtn.addEventListener('click', () => this.toggleSidebarDrawer(false));

    // Chat form submission
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

    // Quick prompt chips
    this.dom.promptChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const promptText = chip.getAttribute('data-prompt');
        if (promptText) {
          this.sendTextMessage(promptText);
        }
      });
    });

    // Settings Modal
    this.dom.settingsBtn.addEventListener('click', () => this.dom.settingsModal.classList.add('open'));
    this.dom.closeSettingsBtn.addEventListener('click', () => this.dom.settingsModal.classList.remove('open'));
    this.dom.saveSettingsBtn.addEventListener('click', () => {
      this.roomName = this.dom.roomInput.value.trim() || 'omni-room';
      this.userName = this.dom.userNameInput.value.trim() || 'Student';
      this.dom.roomNameDisplay.textContent = this.roomName;
      this.dom.settingsModal.classList.remove('open');
    });

    // Code Studio Controls
    this.dom.btnCopyCode.addEventListener('click', () => this.copyCode());
    this.dom.btnRunCode.addEventListener('click', () => this.simulateCodeRun());
    this.dom.btnClearCode.addEventListener('click', () => this.clearCodeEditor());
    this.dom.btnClearTerminal.addEventListener('click', () => {
      this.dom.terminalOutput.innerHTML = '<p class="term-line info">[Terminal Cleared]</p>';
    });

    // Notes Controls
    this.dom.btnExportAllNotes.addEventListener('click', () => this.exportNotesAsFile());
    this.dom.btnQuickExportNotes.addEventListener('click', () => this.exportNotesAsFile());
    this.dom.btnClearAllNotes.addEventListener('click', () => this.clearAllNotes());
  }

  switchStageView(viewName) {
    this.currentView = viewName;
    this.dom.navTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-view') === viewName));
    this.dom.stageViews.forEach(v => {
      v.classList.toggle('active', v.id === `view${viewName.charAt(0).toUpperCase() + viewName.slice(1)}`);
    });

    if (viewName === 'whiteboard') {
      setTimeout(() => this.resizeWhiteboard(), 100);
    }
  }

  switchDrawerTab(tabName) {
    this.dom.drawerTabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-drawer-tab') === tabName));
    this.dom.drawerTabContents.forEach(c => {
      c.classList.toggle('active', c.id === `drawerContent${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    });
  }

  toggleSidebarDrawer(forceState) {
    if (forceState !== undefined) {
      this.dom.transcriptDrawer.classList.toggle('open', forceState);
    } else {
      this.dom.transcriptDrawer.classList.toggle('open');
    }
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

  /* --------------------------------------------------------------------------
     LiveKit WebRTC Real-Time Connection
     -------------------------------------------------------------------------- */
  async toggleConnection() {
    if (this.isConnected) {
      await this.disconnect();
    } else {
      await this.connect();
    }
  }

  async connect() {
    this.roomName = 'omni-' + Math.random().toString(36).substring(2, 8);
    this.setConnectionState('connecting', 'Connecting...');
    this.dom.agentStateText.textContent = 'Joining Room...';
    this.dom.agentSubtext.textContent = 'Connecting to OmniLearn LiveKit gateway...';
    this.dom.connectBtn.disabled = true;

    try {
      // 1. Fetch token from server
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
      this.dom.micToggleBtn.disabled = false;
      this.dom.roomNameDisplay.textContent = this.room.name;

      this.isConnected = true;
      this.setConnectionState('connected', 'Live Session');
      this.dom.connectBtnText.textContent = 'End Call';
      this.dom.connectBtn.classList.add('connected');
      this.dom.connectBtn.disabled = false;
      this.dom.agentStateText.textContent = 'OmniLearn is Listening';
      this.dom.agentSubtext.textContent = 'Speak into your microphone, type, or use the Whiteboard';

    } catch (err) {
      console.error('Connection error:', err);
      this.setConnectionState('disconnected', 'Failed');
      this.dom.agentStateText.textContent = 'Connection Error';
      this.dom.agentSubtext.textContent = err.message || 'Check network or credentials in .env';
      this.dom.connectBtn.disabled = false;
    }
  }

  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isConnected = false;
    this.setConnectionState('disconnected', 'Disconnected');
    this.dom.connectBtnText.textContent = 'Start Call';
    this.dom.connectBtn.classList.remove('connected');
    this.dom.micToggleBtn.disabled = true;
    this.dom.agentStateText.textContent = 'Ready to Learn';
    this.dom.agentSubtext.textContent = 'Click start to begin conversational STEM tutoring';
  }

  async toggleMicrophone() {
    if (!this.room || !this.room.localParticipant) return;
    this.isMicMuted = !this.isMicMuted;
    await this.room.localParticipant.setMicrophoneEnabled(!this.isMicMuted);
    this.dom.micToggleBtn.classList.toggle('active', this.isMicMuted);
    const icon = this.dom.micToggleBtn.querySelector('i');
    icon.className = this.isMicMuted ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone';
  }

  setConnectionState(state, text) {
    this.dom.connectionStatus.className = `status-pill ${state}`;
    this.dom.connectionStatus.querySelector('.status-text').textContent = text;
  }

  setupRoomListeners() {
    // Audio track received
    this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === LivekitClient.Track.Kind.Audio) {
        console.log('🔊 Subscribed to AI Audio Track');
        this.remoteAudioElement = track.attach();
        this.setupAudioVisualizer(this.remoteAudioElement);
        this.dom.agentStateText.textContent = 'OmniLearn Speaking';
        this.dom.agentSubtext.textContent = 'Explaining concept & drawing on board...';
      }
    });

    this.room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    // Data Channel & Whiteboard Draw Commands
    this.room.on(LivekitClient.RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      try {
        const textDecoder = new TextDecoder();
        const str = textDecoder.decode(payload);
        const data = JSON.parse(str);

        // Handle AI Whiteboard Drawing & Writing Commands
        if (data.action === 'draw' || data.action === 'write' || data.action === 'clear' || topic === 'lk.board') {
          console.log('🎨 Received AI Whiteboard Command:', data);
          this.executeAIWhiteboardDraw(data);
          return;
        }

        if (data.message || data.text) {
          this.handleIncomingAgentResponse(data.message || data.text);
        }
      } catch {
        const textDecoder = new TextDecoder();
        this.handleIncomingAgentResponse(textDecoder.decode(payload));
      }
    });

    // Room Transcription Event
    this.room.on(LivekitClient.RoomEvent.TranscriptionReceived, (transcriptions, participant) => {
      transcriptions.forEach(tr => {
        const isSelf = participant?.identity === this.room?.localParticipant?.identity;
        const speaker = isSelf ? 'You' : 'OmniLearn';
        if (tr.text && tr.text.trim()) {
          this.setSubtitles(speaker, tr.text);
          if (tr.final) {
            this.handleIncomingAgentResponse(tr.text, isSelf ? 'user' : 'agent');
          }
        }
      });
    });

    this.room.on(LivekitClient.RoomEvent.Disconnected, () => {
      this.disconnect();
    });
  }

  /* --------------------------------------------------------------------------
     Chat & Smart Content Processing (Code & Notes Extraction)
     -------------------------------------------------------------------------- */
  async sendTextMessage(text) {
    if (!text || !text.trim()) return;
    const msg = text.trim();

    this.toggleSidebarDrawer(true);

    if (!this.isConnected) {
      this.appendMessage('user', msg);
      this.setSubtitles('You', msg);
      this.appendMessage('system', 'Starting live tutoring session to deliver your question...');
      await this.connect();
      await new Promise(r => setTimeout(r, 1200));
    } else {
      this.appendMessage('user', msg);
      this.setSubtitles('You', msg);
    }

    try {
      if (this.room && this.room.localParticipant) {
        if (typeof this.room.localParticipant.sendChatMessage === 'function') {
          await this.room.localParticipant.sendChatMessage(msg);
        }

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

  handleIncomingAgentResponse(text, sender = 'agent') {
    if (!text || !text.trim()) return;
    this.appendMessage(sender, text);
    this.setSubtitles(sender === 'user' ? 'You' : 'OmniLearn AI', text);

    if (sender === 'agent') {
      // 1. Check for Code Blocks and update VS Code Studio
      this.extractAndUpdateCode(text);

      // 2. Check for Lecture Notes & Formulas and save to Notebook
      this.extractAndSaveNotes(text);

      // 3. Trigger Whiteboard auto-drawing if diagrams/equations are detected in speech
      this.autoDrawOnWhiteboard(text);
    }
  }

  appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let formattedHtml = text;
    if (sender === 'agent' && typeof marked !== 'undefined') {
      try {
        formattedHtml = marked.parse(text);
      } catch {
        formattedHtml = text.replace(/\n/g, '<br>');
      }
    } else {
      formattedHtml = text.replace(/\n/g, '<br>');
    }

    msgDiv.innerHTML = `
      <div class="msg-bubble">${formattedHtml}</div>
      <span class="msg-meta">${sender === 'user' ? 'You' : 'OmniLearn'} • ${timeStr}</span>
    `;

    if (typeof hljs !== 'undefined') {
      msgDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    this.dom.transcriptStream.appendChild(msgDiv);
    this.dom.transcriptStream.scrollTop = this.dom.transcriptStream.scrollHeight;
  }

  setSubtitles(speaker, text) {
    this.dom.subtitleSpeaker.innerHTML = `<i class="fa-solid fa-sparkles"></i> <span>${speaker}</span>`;
    this.dom.subtitleContent.textContent = `"${text}"`;
  }

  /* --------------------------------------------------------------------------
     VS Code Studio Engine
     -------------------------------------------------------------------------- */
  extractAndUpdateCode(text) {
    const codeMatch = text.match(/```(?:python|cpp|c|javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      const codeSnippet = codeMatch[1].trim();
      this.updateCodeEditor(codeSnippet);
      this.showCodeNotification();
    } else if (text.includes('class ') || text.includes('def ') || text.includes('import ')) {
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      if (lines.length >= 3) {
        this.updateCodeEditor(text);
        this.showCodeNotification();
      }
    }
  }

  updateCodeEditor(code) {
    this.dom.codeEditorContent.textContent = code;
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(this.dom.codeEditorContent);
    }

    this.dom.terminalOutput.innerHTML = `
      <p class="term-line info">[Loaded into VS Code Studio]</p>
      <p class="term-line success">&gt; python solution.py</p>
      <p class="term-line text">Ready for execution simulation</p>
    `;
  }

  showCodeNotification() {
    if (this.dom.codeCountBadge) {
      this.dom.codeCountBadge.textContent = 'Code Updated';
      this.dom.codeCountBadge.classList.add('live-pulse');
    }
  }

  copyCode() {
    const code = this.dom.codeEditorContent.textContent;
    navigator.clipboard.writeText(code).then(() => {
      this.dom.btnCopyCode.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
      setTimeout(() => {
        this.dom.btnCopyCode.innerHTML = '<i class="fa-solid fa-copy"></i> <span>Copy</span>';
      }, 2000);
    });
  }

  simulateCodeRun() {
    this.dom.terminalOutput.innerHTML = `
      <p class="term-line info">[Executing in Python 3.12 Runtime...]</p>
      <p class="term-line success">&gt; python solution.py</p>
      <p class="term-line text">10 -&gt; 20 -&gt; 30 -&gt; None</p>
      <p class="term-line info">[Process completed successfully with exit code 0]</p>
    `;
  }

  clearCodeEditor() {
    this.dom.codeEditorContent.textContent = '# VS Code Studio Editor Cleared\n';
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(this.dom.codeEditorContent);
    }
  }

  /* --------------------------------------------------------------------------
     Live Notes Notebook Engine
     -------------------------------------------------------------------------- */
  extractAndSaveNotes(text) {
    if (text.includes('•') || text.includes('Formula:') || text.includes('Key Takeaway') || text.includes('Step-by-Step')) {
      const titleMatch = text.match(/^([A-Z][^\n•:]+)/);
      const title = titleMatch ? titleMatch[1].trim() : 'Lecture Concept';
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const note = {
        id: 'note_' + Date.now(),
        title: title.slice(0, 45),
        content: text,
        time: timeStr,
        tag: text.includes('Formula:') ? 'math' : (text.includes('class') || text.includes('def')) ? 'code' : 'concept',
      };

      this.savedNotes.unshift(note);
      this.renderNotes();
    }
  }

  renderNotes() {
    const count = this.savedNotes.length;
    this.dom.notesCountBadge.textContent = count;
    this.dom.sidebarNotesCount.textContent = count;

    let gridHtml = '';
    this.savedNotes.forEach(n => {
      let formattedBody = n.content.replace(/\n/g, '<br>');
      if (typeof marked !== 'undefined') {
        try { formattedBody = marked.parse(n.content); } catch {}
      }

      gridHtml += `
        <div class="note-card" id="${n.id}">
          <div class="note-card-header">
            <span class="note-tag ${n.tag}">${n.tag.toUpperCase()}</span>
            <span class="note-time">${n.time}</span>
          </div>
          <h4>${n.title}</h4>
          <div class="note-body">${formattedBody}</div>
        </div>
      `;
    });

    this.dom.notesGrid.innerHTML = gridHtml || `
      <div class="empty-notes-placeholder">
        <i class="fa-regular fa-clipboard"></i>
        <p>No notes saved yet. Notes will automatically appear here as OmniLearn teaches.</p>
      </div>
    `;

    let sideHtml = '';
    this.savedNotes.forEach(n => {
      sideHtml += `
        <div class="note-card" style="padding: 0.85rem;">
          <div class="note-card-header">
            <span class="note-tag ${n.tag}">${n.tag}</span>
            <span class="note-time">${n.time}</span>
          </div>
          <h4 style="font-size: 0.9rem; margin-top: 0.3rem;">${n.title}</h4>
        </div>
      `;
    });

    this.dom.sidebarNotesList.innerHTML = sideHtml || `
      <div class="empty-notes-placeholder">
        <i class="fa-regular fa-clipboard"></i>
        <p>Notes will automatically appear here as OmniLearn teaches key concepts.</p>
      </div>
    `;
  }

  exportNotesAsFile() {
    if (this.savedNotes.length === 0) {
      alert('No lecture notes recorded yet.');
      return;
    }

    let mdContent = `# OmniLearn AI — Lecture Study Notes\nGenerated: ${new Date().toLocaleString()}\n\n---\n\n`;
    this.savedNotes.forEach((n, idx) => {
      mdContent += `## ${idx + 1}. ${n.title} (${n.time})\n\n${n.content}\n\n---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmniLearn_Lecture_Notes_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  clearAllNotes() {
    this.savedNotes = [];
    this.renderNotes();
  }

  /* --------------------------------------------------------------------------
     Teacher Whiteboard Drawing, Stroke Tracking & AI Vision Engine
     -------------------------------------------------------------------------- */
  initWhiteboard() {
    this.wbCanvas = this.dom.whiteboardCanvas;
    this.wbCtx = this.wbCanvas.getContext('2d');

    this.resizeWhiteboard();
    window.addEventListener('resize', () => this.resizeWhiteboard());

    // Mouse Events
    this.wbCanvas.addEventListener('mousedown', (e) => this.startDraw(e));
    this.wbCanvas.addEventListener('mousemove', (e) => this.draw(e));
    this.wbCanvas.addEventListener('mouseup', () => this.stopDraw());
    this.wbCanvas.addEventListener('mouseleave', () => this.stopDraw());

    // Touch Events
    this.wbCanvas.addEventListener('touchstart', (e) => this.startDrawTouch(e));
    this.wbCanvas.addEventListener('touchmove', (e) => this.drawTouch(e));
    this.wbCanvas.addEventListener('touchend', () => this.stopDraw());

    // Whiteboard Toolbar Controls
    this.dom.toolPen.addEventListener('click', () => {
      this.wbTool = 'pen';
      this.dom.toolPen.classList.add('active');
      this.dom.toolEraser.classList.remove('active');
    });

    this.dom.toolEraser.addEventListener('click', () => {
      this.wbTool = 'eraser';
      this.dom.toolEraser.classList.add('active');
      this.dom.toolPen.classList.remove('active');
    });

    this.dom.colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.wbColor = btn.getAttribute('data-color');
        this.wbTool = 'pen';
        this.dom.toolPen.classList.add('active');
        this.dom.toolEraser.classList.remove('active');
      });
    });

    this.dom.btnClearBoard.addEventListener('click', () => this.clearWhiteboard());
    this.dom.btnDownloadBoard.addEventListener('click', () => this.downloadWhiteboard());

    // AI Vision Scan & Solve Button
    if (this.dom.btnScanAndExplain) {
      this.dom.btnScanAndExplain.addEventListener('click', () => this.scanAndSolveWhiteboard());
    }

    // STEM Preset Diagram Buttons
    if (this.dom.btnDrawProjectile) {
      this.dom.btnDrawProjectile.addEventListener('click', () => this.drawProjectileMotionPreset({ velocity: 25, angle: 45 }));
    }
    if (this.dom.btnDrawVector) {
      this.dom.btnDrawVector.addEventListener('click', () => this.drawVectorAdditionPreset());
    }
    if (this.dom.btnDrawFBD) {
      this.dom.btnDrawFBD.addEventListener('click', () => this.drawFreeBodyDiagramPreset());
    }
    if (this.dom.btnDrawLinkedList) {
      this.dom.btnDrawLinkedList.addEventListener('click', () => this.drawLinkedListPreset());
    }
    if (this.dom.btnDrawCircuit) {
      this.dom.btnDrawCircuit.addEventListener('click', () => this.drawCircuitPreset());
    }
    if (this.dom.btnDrawTree) {
      this.dom.btnDrawTree.addEventListener('click', () => this.drawBinaryTreePreset());
    }

    // Initial Board Demonstration
    this.drawProjectileMotionPreset({ velocity: 25, angle: 45 });
  }

  resizeWhiteboard() {
    if (!this.wbCanvas) return;
    const rect = this.wbCanvas.parentElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Preserve existing canvas drawings during resize
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.wbCanvas.width;
      tempCanvas.height = this.wbCanvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (this.wbCanvas.width > 0 && this.wbCanvas.height > 0) {
        tempCtx.drawImage(this.wbCanvas, 0, 0);
      }

      this.wbCanvas.width = rect.width;
      this.wbCanvas.height = rect.height;

      if (tempCanvas.width > 0 && tempCanvas.height > 0) {
        this.wbCtx.drawImage(tempCanvas, 0, 0);
      }
    }
  }

  getCanvasCoords(e) {
    const rect = this.wbCanvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  startDraw(e) {
    this.isDrawing = true;
    const coords = this.getCanvasCoords(e);
    this.lastX = coords.x;
    this.lastY = coords.y;

    this.currentStroke = {
      tool: this.wbTool,
      color: this.wbColor,
      size: this.wbSize,
      points: [{ x: coords.x, y: coords.y }],
    };
    this.userStrokes.push(this.currentStroke);
  }

  draw(e) {
    if (!this.isDrawing) return;
    const coords = this.getCanvasCoords(e);

    this.wbCtx.beginPath();
    this.wbCtx.moveTo(this.lastX, this.lastY);
    this.wbCtx.lineTo(coords.x, coords.y);
    this.wbCtx.strokeStyle = this.wbTool === 'eraser' ? '#111522' : this.wbColor;
    this.wbCtx.lineWidth = this.wbTool === 'eraser' ? 28 : this.wbSize;
    this.wbCtx.lineCap = 'round';
    this.wbCtx.lineJoin = 'round';
    this.wbCtx.stroke();

    if (this.currentStroke) {
      this.currentStroke.points.push({ x: coords.x, y: coords.y });
    }

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  startDrawTouch(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.startDraw(e.touches[0]);
    }
  }

  drawTouch(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      this.draw(e.touches[0]);
    }
  }

  stopDraw() {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.analyzeDrawingRealtime();
    }
  }

  /**
   * Real-time geometric feature detection on user whiteboard strokes
   */
  analyzeDrawingRealtime() {
    if (this.userStrokes.length === 0) return;

    const allPoints = [];
    this.userStrokes.forEach(s => {
      if (s.points && s.points.length > 0) {
        allPoints.push(...s.points);
      }
    });

    if (allPoints.length < 5) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allPoints.forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    // Detect Parabolic curvature / Projectile Trajectory
    // In projectile motion, curve starts low (high Y in canvas), reaches apex (low Y), and descends (high Y)
    let isParabolic = false;
    let estimatedAngle = 45;

    for (const stroke of this.userStrokes) {
      const pts = stroke.points;
      if (pts.length >= 10) {
        const startPt = pts[0];
        const endPt = pts[pts.length - 1];
        let lowestY = startPt.y;
        let apexIdx = 0;

        pts.forEach((p, idx) => {
          if (p.y < lowestY) {
            lowestY = p.y;
            apexIdx = idx;
          }
        });

        const isApexMiddle = apexIdx > pts.length * 0.2 && apexIdx < pts.length * 0.8;
        const heightDrop = Math.max(startPt.y, endPt.y) - lowestY;

        if (isApexMiddle && heightDrop > 30) {
          isParabolic = true;
          // Estimate tangent launch angle from first 5 points
          const dx = pts[4].x - pts[0].x;
          const dy = -(pts[4].y - pts[0].y); // invert canvas Y
          if (dx !== 0) {
            const angleDeg = Math.round(Math.abs(Math.atan2(dy, dx) * (180 / Math.PI)));
            if (angleDeg > 10 && angleDeg < 85) {
              estimatedAngle = angleDeg;
            }
          }
          break;
        }
      }
    }

    if (isParabolic) {
      this.lastDetectedGeometry = {
        type: 'projectile_motion',
        angle: estimatedAngle,
        velocity: 25,
        width: Math.round(width),
        height: Math.round(height),
      };
      this.dom.boardStatusText.textContent = `✨ AI Vision Detected: Projectile Motion Trajectory (Launch θ ≈ ${estimatedAngle}°, Span: ${Math.round(width)}px). Click "Ask AI to Solve Drawing" or speak!`;
    } else if (width > 60 || height > 60) {
      this.lastDetectedGeometry = {
        type: 'vector_resolution',
        angle: Math.round(Math.atan2(height, width) * (180 / Math.PI)),
        velocity: 20,
      };
      this.dom.boardStatusText.textContent = `✨ AI Vision Detected: Vector / Physics Diagram (Angle ≈ ${this.lastDetectedGeometry.angle}°). Ask OmniLearn to resolve!`;
    }
  }

  clearWhiteboard() {
    this.userStrokes = [];
    this.lastDetectedGeometry = null;
    this.wbCtx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);
    this.dom.boardStatusText.textContent = 'Whiteboard Cleared. Draw any diagram or ask OmniLearn AI to illustrate.';
  }

  downloadWhiteboard() {
    const link = document.createElement('a');
    link.download = `OmniLearn_Whiteboard_${Date.now()}.png`;
    link.href = this.wbCanvas.toDataURL('image/png');
    link.click();
  }

  /* --------------------------------------------------------------------------
     AI Vision Scan & Multimodal Whiteboard Resolution
     -------------------------------------------------------------------------- */
  async scanAndSolveWhiteboard() {
    // 1. Trigger laser scanning animation
    this.dom.boardScanLine.classList.add('scanning');
    this.dom.boardStatusText.textContent = '🔍 AI Vision scanning whiteboard strokes & vector trajectory...';

    // 2. Extract detected geometry or use default projectile motion
    const geom = this.lastDetectedGeometry || {
      type: 'projectile_motion',
      angle: 45,
      velocity: 25,
    };

    const diagramType = geom.type || 'projectile_motion';
    const angle = geom.angle || 45;
    const velocity = geom.velocity || 25;

    const prompt = `I have drawn a ${diagramType.replace('_', ' ')} on the teacher whiteboard with launch angle approximately ~${angle}° and speed ~${velocity} m/s. Please analyze the diagram, resolve horizontal/vertical velocity components (u_x = u·cosθ, u_y = u·sinθ), calculate max height H_max, total flight time T, and Range R, explain step-by-step, and draw the solved diagram on the whiteboard!`;

    // 3. Send over LiveKit DataChannel
    if (this.room && this.room.localParticipant) {
      try {
        const encoder = new TextEncoder();
        const payload = encoder.encode(JSON.stringify({
          action: "analyze_board",
          diagram_type: diagramType,
          estimated_angle: angle,
          estimated_velocity: velocity,
          query: prompt,
        }));
        await this.room.localParticipant.publishData(payload, {
          topic: "lk.board_analysis",
          reliable: true,
        });
      } catch (err) {
        console.warn('Board analysis send error:', err);
      }
    }

    // 4. Send in chat stream
    this.sendTextMessage(prompt);

    setTimeout(() => {
      this.dom.boardScanLine.classList.remove('scanning');
      this.dom.boardStatusText.textContent = `OmniLearn AI analyzed drawing (θ ≈ ${angle}°). Solving and drawing vector trajectory on whiteboard...`;
      // Auto-render step-by-step physics vector breakdown on board
      this.drawProjectileMotionPreset({ velocity, angle });
    }, 1800);
  }

  /**
   * Execute drawing commands sent by OmniLearn AI agent
   */
  executeAIWhiteboardDraw(data) {
    // Switch to whiteboard view so the student sees the illustration
    this.switchStageView('whiteboard');

    if (this.dom.boardLiveBadge) {
      this.dom.boardLiveBadge.textContent = 'AI Drawing...';
      setTimeout(() => {
        if (this.dom.boardLiveBadge) this.dom.boardLiveBadge.textContent = 'Live';
      }, 3000);
    }

    if (data.action === 'clear') {
      this.clearWhiteboard();
      return;
    }

    if (data.diagram === 'projectile_motion') {
      this.drawProjectileMotionPreset(data);
      this.dom.boardStatusText.textContent = `OmniLearn AI drew: Projectile Motion (u=${data.velocity || 25}m/s, θ=${data.angle || 45}°) with vector components and formula card.`;
    } else if (data.diagram === 'vector_addition') {
      this.drawVectorAdditionPreset(data);
      this.dom.boardStatusText.textContent = 'OmniLearn AI drew: 2D Vector Resolution & Resultant R = A + B.';
    } else if (data.diagram === 'free_body') {
      this.drawFreeBodyDiagramPreset(data);
      this.dom.boardStatusText.textContent = 'OmniLearn AI drew: Free Body Force Diagram on Inclined Plane.';
    } else if (data.diagram === 'circuit') {
      this.drawCircuitPreset(data);
      this.dom.boardStatusText.textContent = "OmniLearn AI drew: Ohm's Law Circuit Analysis.";
    } else if (data.diagram === 'linked_list') {
      this.drawLinkedListPreset(data);
      this.dom.boardStatusText.textContent = 'OmniLearn AI drew: Singly Linked List Data Structure.';
    } else if (data.diagram === 'binary_tree') {
      this.drawBinaryTreePreset(data);
      this.dom.boardStatusText.textContent = 'OmniLearn AI drew: Binary Search Tree Structure.';
    } else if (data.action === 'write' || data.diagram === 'custom_lecture') {
      this.drawCustomLectureNotes(data);
      this.dom.boardStatusText.textContent = `OmniLearn AI wrote lecture notes: ${data.title || 'Equations'}`;
    }
  }

  autoDrawOnWhiteboard(text) {
    const lower = text.toLowerCase();
    if (lower.includes('projectile') || lower.includes('trajectory') || lower.includes('launch angle') || lower.includes('parabola')) {
      this.drawProjectileMotionPreset({ velocity: 25, angle: 45 });
      this.dom.boardStatusText.textContent = 'AI Teacher drew: Projectile Motion & Vector Components (u_x, u_y)';
    } else if (lower.includes('vector') || lower.includes('resultant') || lower.includes('magnitude') || lower.includes('direction')) {
      this.drawVectorAdditionPreset();
      this.dom.boardStatusText.textContent = 'AI Teacher drew: Vector Resolution & Resultant Vector R (A + B)';
    } else if (lower.includes('free body') || lower.includes('friction') || lower.includes('normal force') || lower.includes('incline')) {
      this.drawFreeBodyDiagramPreset();
      this.dom.boardStatusText.textContent = 'AI Teacher drew: Free Body Force Diagram (FBD)';
    } else if (lower.includes('linked list') || lower.includes('node')) {
      this.drawLinkedListPreset();
      this.dom.boardStatusText.textContent = 'AI Teacher drew: Singly Linked List Data Structure';
    } else if (lower.includes('ohm') || lower.includes('circuit') || lower.includes('voltage')) {
      this.drawCircuitPreset();
      this.dom.boardStatusText.textContent = "AI Teacher drew: Ohm's Law Circuit (V = I × R)";
    } else if (lower.includes('tree') || lower.includes('binary search')) {
      this.drawBinaryTreePreset();
      this.dom.boardStatusText.textContent = 'AI Teacher drew: Binary Search Tree Hierarchy';
    }
  }

  /* --------------------------------------------------------------------------
     PRESET STEM DIAGRAMS: Projectile Motion, Vectors, FBD, Circuit, Trees
     -------------------------------------------------------------------------- */

  drawProjectileMotionPreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    const u = opts.velocity || 25;
    const angle = opts.angle || 45;
    const g = opts.gravity || 9.8;
    const rad = (angle * Math.PI) / 180;
    const ux = (u * Math.cos(rad)).toFixed(2);
    const uy = (u * Math.sin(rad)).toFixed(2);
    const hmax = ((u * Math.sin(rad)) ** 2 / (2 * g)).toFixed(2);
    const range = ((u ** 2 * Math.sin(2 * rad)) / g).toFixed(2);
    const tflight = ((2 * u * Math.sin(rad)) / g).toFixed(2);

    // Title Header
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('PROJECTILE MOTION & VECTOR RESOLUTION', 40, 45);

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Initial Speed u = ${u} m/s | Launch Angle θ = ${angle}° | Gravity g = ${g} m/s²`, 40, 70);

    const originX = 90;
    const originY = 380;
    const scaleX = 4.8;
    const scaleY = 7.5;

    // 1. Draw Coordinate Axes (X and Y)
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX - 20, originY);
    ctx.lineTo(originX + 460, originY); // Ground X
    ctx.moveTo(originX, originY + 20);
    ctx.lineTo(originX, originY - 240); // Vertical Y
    ctx.stroke();

    ctx.font = 'bold 13px Fira Code';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('X (Range)', originX + 440, originY + 20);
    ctx.fillText('Y (Height)', originX - 30, originY - 230);

    // 2. Parabolic Trajectory Curve with Neon Glow
    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0, 229, 255, 0.7)';
    ctx.shadowBlur = 14;

    const totalSteps = 60;
    for (let i = 0; i <= totalSteps; i++) {
      const xVal = (range / totalSteps) * i;
      const yVal = xVal * Math.tan(rad) - (g * xVal * xVal) / (2 * u * u * Math.cos(rad) * Math.cos(rad));
      const px = originX + xVal * scaleX;
      const py = originY - Math.max(0, yVal) * scaleY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset glow

    // 3. Velocity Vector u (Neon Emerald Arrow)
    const arrowLen = 95;
    const arrowEndX = originX + arrowLen * Math.cos(rad);
    const arrowEndY = originY - arrowLen * Math.sin(rad);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(arrowEndX, arrowEndY);
    ctx.stroke();

    this.drawArrowhead(ctx, originX, originY, arrowEndX, arrowEndY, 12, '#10b981');

    ctx.font = 'bold 15px Fira Code';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`u = ${u} m/s`, arrowEndX + 8, arrowEndY - 6);

    // 4. Resolved Components: Horizontal ux and Vertical uy
    // ux (Cyan Arrow along X)
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + arrowLen * Math.cos(rad), originY);
    ctx.stroke();
    this.drawArrowhead(ctx, originX, originY, originX + arrowLen * Math.cos(rad), originY, 10, '#06b6d4');
    ctx.fillStyle = '#06b6d4';
    ctx.fillText(`u_x = ${ux} m/s (u·cosθ)`, originX + 20, originY + 22);

    // uy (Purple Arrow along Y)
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX, arrowEndY);
    ctx.stroke();
    this.drawArrowhead(ctx, originX, originY, originX, arrowEndY, 10, '#a855f7');
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`u_y = ${uy} m/s`, originX - 95, arrowEndY + 20);

    // Angle θ Arc
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(originX, originY, 35, -rad, 0);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`θ=${angle}°`, originX + 42, originY - 12);

    // 5. Peak Point (H_max) & Velocity at Apex
    const apexX = originX + (range / 2) * scaleX;
    const apexY = originY - hmax * scaleY;

    // Peak marker dot
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(apexX, apexY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal velocity at apex
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX + 55, apexY);
    ctx.stroke();
    this.drawArrowhead(ctx, apexX, apexY, apexX + 55, apexY, 9, '#06b6d4');
    ctx.fillStyle = '#06b6d4';
    ctx.font = '12px Fira Code';
    ctx.fillText(`v = u_x (v_y = 0)`, apexX - 25, apexY - 14);

    // Gravity vector g at peak
    ctx.strokeStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX, apexY + 40);
    ctx.stroke();
    this.drawArrowhead(ctx, apexX, apexY, apexX, apexY + 40, 8, '#f43f5e');
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('g ↓', apexX + 8, apexY + 28);

    // Dimension lines: H_max dashed line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(apexX, apexY);
    ctx.lineTo(apexX, originY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`H_max = ${hmax} m`, apexX - 45, (apexY + originY) / 2);

    // Range Marker
    const endGroundX = originX + range * scaleX;
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`Range R = ${range} m`, (originX + endGroundX) / 2 - 40, originY + 40);

    // 6. Step-by-Step Formulas Card on Right
    const cardX = 580;
    const cardY = 90;
    ctx.fillStyle = 'rgba(18, 22, 36, 0.92)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 330, 255, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillText('STEP-BY-STEP FORMULAS', cardX + 20, cardY + 30);

    ctx.font = '12px Fira Code, monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`• u_x = u·cos(θ) = ${ux} m/s`, cardX + 20, cardY + 65);
    ctx.fillText(`• u_y = u·sin(θ) = ${uy} m/s`, cardX + 20, cardY + 95);
    ctx.fillText(`• H_max = (u_y)² / (2g) = ${hmax} m`, cardX + 20, cardY + 125);
    ctx.fillText(`• T = 2·u_y / g = ${tflight} s`, cardX + 20, cardY + 155);
    ctx.fillText(`• R = u_x · T = ${range} m`, cardX + 20, cardY + 185);

    ctx.fillStyle = '#10b981';
    ctx.fillText(`Trajectory: y = x·tan(θ) - gx²/(2u_x²)`, cardX + 20, cardY + 225);
  }

  drawVectorAdditionPreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.fillText('2D VECTOR RESOLUTION & ADDITION (R = A + B)', 40, 45);

    const originX = 220;
    const originY = 260;

    // Coordinate Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, originY);
    ctx.lineTo(originX + 260, originY); // X
    ctx.moveTo(originX, 60);
    ctx.lineTo(originX, originY + 140); // Y
    ctx.stroke();

    ctx.font = 'bold 12px Fira Code';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('+X', originX + 245, originY - 8);
    ctx.fillText('+Y', originX + 8, 75);

    // Vector A (Cyan, 30 deg, mag 130)
    const radA = Math.PI / 6;
    const lenA = 130;
    const ax = originX + lenA * Math.cos(radA);
    const ay = originY - lenA * Math.sin(radA);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    this.drawArrowhead(ctx, originX, originY, ax, ay, 12, '#06b6d4');
    ctx.fillStyle = '#06b6d4';
    ctx.fillText('Vector A (12u @ 30°)', ax + 10, ay - 5);

    // Vector B (Purple, 80 deg, mag 110)
    const radB = (80 * Math.PI) / 180;
    const lenB = 110;
    const bx = originX + lenB * Math.cos(radB);
    const by = originY - lenB * Math.sin(radB);

    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(bx, by);
    ctx.stroke();
    this.drawArrowhead(ctx, originX, originY, bx, by, 12, '#a855f7');
    ctx.fillStyle = '#a855f7';
    ctx.fillText('Vector B (16u @ 80°)', bx - 80, by - 12);

    // Resultant R = A + B (Neon Gold)
    const rx = ax + (bx - originX);
    const ry = ay + (by - originY);

    // Parallelogram dashed lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(rx, ry);
    ctx.moveTo(bx, by);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    ctx.setLineDash([]);

    // Resultant Vector R Arrow
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.6)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(rx, ry);
    ctx.stroke();
    this.drawArrowhead(ctx, originX, originY, rx, ry, 14, '#f59e0b');
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px Fira Code';
    ctx.fillText('Resultant R = A + B', rx + 12, ry - 8);

    // Formula Card
    const cardX = 540;
    const cardY = 90;
    ctx.fillStyle = 'rgba(18, 22, 36, 0.92)';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 340, 230, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillText('VECTOR ADDITION FORMULAS', cardX + 20, cardY + 30);

    ctx.font = '12px Fira Code, monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('• A_x = A·cos(θ_A), A_y = A·sin(θ_A)', cardX + 20, cardY + 65);
    ctx.fillText('• B_x = B·cos(θ_B), B_y = B·sin(θ_B)', cardX + 20, cardY + 95);
    ctx.fillText('• R_x = A_x + B_x,  R_y = A_y + B_y', cardX + 20, cardY + 125);
    ctx.fillText('• Magnitude |R| = √(R_x² + R_y²)', cardX + 20, cardY + 155);
    ctx.fillText('• Direction θ_R = arctan(R_y / R_x)', cardX + 20, cardY + 185);
  }

  drawFreeBodyDiagramPreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText('FREE BODY FORCE DIAGRAM (FBD): INCLINED PLANE', 40, 45);

    const inclineX = 80;
    const inclineY = 340;
    const inclineW = 380;
    const inclineH = 180;

    // Incline Wedge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(inclineX, inclineY);
    ctx.lineTo(inclineX + inclineW, inclineY);
    ctx.lineTo(inclineX + inclineW, inclineY - inclineH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Mass Block
    const blockX = 240;
    const blockY = 240;
    ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(blockX, blockY, 70, 50, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Fira Code';
    ctx.fillText('m=10kg', blockX + 10, blockY + 30);

    // Gravity Vector mg ↓
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(blockX + 35, blockY + 25);
    ctx.lineTo(blockX + 35, blockY + 120);
    ctx.stroke();
    this.drawArrowhead(ctx, blockX + 35, blockY + 25, blockX + 35, blockY + 120, 10, '#f43f5e');
    ctx.fillStyle = '#f43f5e';
    ctx.fillText('W = mg ↓ (98 N)', blockX + 42, blockY + 115);

    // Normal Force N ↖
    ctx.strokeStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(blockX + 35, blockY + 25);
    ctx.lineTo(blockX - 10, blockY - 50);
    ctx.stroke();
    this.drawArrowhead(ctx, blockX + 35, blockY + 25, blockX - 10, blockY - 50, 10, '#00e5ff');
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('N (Normal Force)', blockX - 85, blockY - 45);

    // Friction Force f ↗
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(blockX + 35, blockY + 25);
    ctx.lineTo(blockX + 90, blockY - 10);
    ctx.stroke();
    this.drawArrowhead(ctx, blockX + 35, blockY + 25, blockX + 90, blockY - 10, 10, '#f59e0b');
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('f_k (Friction)', blockX + 70, blockY - 18);

    // Formula Card
    const cardX = 520;
    const cardY = 90;
    ctx.fillStyle = 'rgba(18, 22, 36, 0.92)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 350, 220, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillText('FORCE RESOLUTION EQUATIONS', cardX + 20, cardY + 30);

    ctx.font = '12px Fira Code, monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('• Normal Force N = mg·cos(θ) = 84.87 N', cardX + 20, cardY + 65);
    ctx.fillText('• Downhill Force F_g = mg·sin(θ) = 49.00 N', cardX + 20, cardY + 95);
    ctx.fillText('• Friction Force f = μ·N = 16.97 N', cardX + 20, cardY + 125);
    ctx.fillText('• Net Acceleration a = (F_g - f)/m = 3.20 m/s²', cardX + 20, cardY + 155);
  }

  drawLinkedListPreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('SINGLY LINKED LIST DATA STRUCTURE', 40, 50);

    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Head Pointer -> Node(Data, Next Pointer) -> NULL', 40, 78);

    const nodes = [
      { data: '10', addr: '0x1A0' },
      { data: '20', addr: '0x2B4' },
      { data: '30', addr: '0x3C8' },
    ];

    let startX = 60;
    const startY = 160;
    const nodeWidth = 120;
    const nodeHeight = 60;

    nodes.forEach((node, i) => {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(startX, startY, nodeWidth, nodeHeight, 8);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX + 70, startY);
      ctx.lineTo(startX + 70, startY + nodeHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Fira Code, monospace';
      ctx.fillText(node.data, startX + 25, startY + 36);

      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(startX + 95, startY + 30, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px Fira Code, monospace';
      ctx.fillText(`[${node.addr}]`, startX + 20, startY - 10);

      if (i < nodes.length - 1) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startX + 95, startY + 30);
        ctx.lineTo(startX + nodeWidth + 40, startY + 30);
        ctx.stroke();
        this.drawArrowhead(ctx, startX + 95, startY + 30, startX + nodeWidth + 40, startY + 30, 10, '#00e5ff');
      } else {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startX + 95, startY + 30);
        ctx.lineTo(startX + nodeWidth + 40, startY + 30);
        ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 14px Fira Code, monospace';
        ctx.fillText('NULL', startX + nodeWidth + 48, startY + 35);
      }

      startX += nodeWidth + 70;
    });
  }

  drawCircuitPreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    const v = opts.voltage || 12;
    const r = opts.resistance || 4;
    const i = (v / r).toFixed(2);
    const p = (v * i).toFixed(2);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText("OHM'S LAW CIRCUIT ANALYSIS (V = I × R)", 40, 50);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(100, 120, 300, 200);
    ctx.stroke();

    ctx.fillStyle = '#111522';
    ctx.fillRect(80, 190, 40, 60);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px Fira Code';
    ctx.fillText(`+ ${v}V -`, 75, 225);

    ctx.fillStyle = '#111522';
    ctx.fillRect(220, 100, 70, 40);
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`R = ${r}Ω`, 225, 126);

    ctx.fillStyle = '#10b981';
    ctx.fillText(`→ Current (I) = V / R = ${i} A`, 140, 350);

    // Formula card
    const cardX = 480;
    const cardY = 110;
    ctx.fillStyle = 'rgba(18, 22, 36, 0.92)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 340, 200, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px Outfit, sans-serif';
    ctx.fillText('CIRCUIT CALCULATIONS', cardX + 20, cardY + 30);

    ctx.font = '12px Fira Code, monospace';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`• Voltage (V): ${v} Volts`, cardX + 20, cardY + 65);
    ctx.fillText(`• Resistance (R): ${r} Ohms (Ω)`, cardX + 20, cardY + 95);
    ctx.fillText(`• Current I = V / R: ${i} Amperes`, cardX + 20, cardY + 125);
    ctx.fillText(`• Power P = V × I: ${p} Watts`, cardX + 20, cardY + 155);
  }

  drawBinaryTreePreset(opts = {}) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.fillText('BINARY SEARCH TREE HIERARCHY', 40, 50);

    const drawNode = (val, x, y) => {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Fira Code';
      ctx.textAlign = 'center';
      ctx.fillText(val, x, y + 5);
      ctx.textAlign = 'left';
    };

    const drawLine = (x1, y1, x2, y2) => {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    drawLine(280, 120, 180, 200);
    drawLine(280, 120, 380, 200);
    drawNode('50', 280, 120);

    drawLine(180, 200, 120, 280);
    drawLine(180, 200, 230, 280);
    drawLine(380, 200, 330, 280);
    drawLine(380, 200, 430, 280);

    drawNode('30', 180, 200);
    drawNode('70', 380, 200);

    drawNode('20', 120, 280);
    drawNode('40', 230, 280);
    drawNode('60', 330, 280);
    drawNode('80', 430, 280);
  }

  drawCustomLectureNotes(data) {
    const ctx = this.wbCtx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    const title = data.title || 'LECTURE PROBLEM & DERIVATION';
    const formula = data.formula || '';
    const steps = data.steps || '';
    const color = data.color || '#00e5ff';

    // Title Header
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(title.toUpperCase(), 40, 50);

    // Formula Banner Card
    if (formula) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(40, 75, 620, 55, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Fira Code, monospace';
      ctx.fillText(`Formula: ${formula}`, 60, 110);
    }

    // Step-by-step Notes
    if (steps) {
      const stepLines = steps.split('\n').filter(l => l.trim().length > 0);
      let currentY = formula ? 165 : 95;

      stepLines.forEach((line, idx) => {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText(`• ${line}`, 50, currentY);
        currentY += 32;
      });
    }
  }

  drawArrowhead(ctx, fromX, fromY, toX, toY, headLength, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  /* --------------------------------------------------------------------------
     Canvas Audio Waveform Visualizer
     -------------------------------------------------------------------------- */
  initCanvasVisualizer() {
    this.canvasCtx.clearRect(0, 0, 480, 480);
  }

  setupAudioVisualizer(audioEl) {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    try {
      const source = this.audioContext.createMediaElementSource(audioEl);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.renderVisualizer();
    } catch (err) {
      console.warn('Audio Visualizer setup error:', err);
    }
  }

  renderVisualizer() {
    this.animationFrameId = requestAnimationFrame(() => this.renderVisualizer());
    if (!this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    const canvas = this.dom.visualizerCanvas;
    const ctx = this.canvasCtx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    const bars = 48;
    const step = (Math.PI * 2) / bars;

    let avgVolume = 0;
    for (let i = 0; i < bars; i++) {
      avgVolume += this.dataArray[i];
    }
    avgVolume = avgVolume / bars;

    const scaleFactor = 1 + (avgVolume / 255) * 0.45;
    this.dom.orbCore.style.transform = `scale(${scaleFactor})`;

    for (let i = 0; i < bars; i++) {
      const value = this.dataArray[i] || 0;
      const barHeight = Math.max(4, (value / 255) * 75);
      const angle = i * step;

      const x1 = centerX + Math.cos(angle) * (radius + 5);
      const y1 = centerY + Math.sin(angle) * (radius + 5);
      const x2 = centerX + Math.cos(angle) * (radius + 5 + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + 5 + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsl(${220 + (i / bars) * 60}, 100%, 65%)`;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
}

// Instantiate on load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new OmniLearnApp();
});
