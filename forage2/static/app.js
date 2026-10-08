/**
 * OmniLearn AI — Interactive STEM Tutor Web Client
 * LiveKit WebRTC Voice & Chat Client, VS Code Studio, Teacher Whiteboard, & Live Notes
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
      toolPen: document.getElementById('toolPen'),
      toolEraser: document.getElementById('toolEraser'),
      colorBtns: document.querySelectorAll('.color-btn'),
      btnClearBoard: document.getElementById('btnClearBoard'),
      btnDownloadBoard: document.getElementById('btnDownloadBoard'),
      btnDrawLinkedList: document.getElementById('btnDrawLinkedList'),
      btnDrawCircuit: document.getElementById('btnDrawCircuit'),
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
      this.dom.agentSubtext.textContent = 'Speak into your microphone or type in chat';

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
    // Participant subscribed audio track
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

    // Data Channel & Transcripts
    this.room.on(LivekitClient.RoomEvent.DataReceived, (payload, participant, kind, topic) => {
      try {
        const textDecoder = new TextDecoder();
        const str = textDecoder.decode(payload);
        const data = JSON.parse(str);
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

      // 3. Trigger Whiteboard auto-drawing if diagrams/equations are detected
      this.autoDrawOnWhiteboard(text);
    }
  }

  appendMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Format content with Marked.js if agent, else plain text
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

    // Syntax highlight any inline code blocks in the chat bubble
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
    // Look for standard markdown code blocks (```python ... ```) or class/def patterns
    const codeMatch = text.match(/```(?:python|cpp|c|javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      const codeSnippet = codeMatch[1].trim();
      this.updateCodeEditor(codeSnippet);
      this.showCodeNotification();
    } else if (text.includes('class ') || text.includes('def ') || text.includes('import ')) {
      // Direct raw code pattern
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

    // Auto-update terminal output
    this.dom.terminalOutput.innerHTML = `
      <p class="term-line info">[Loaded into VS Code Studio]</p>
      <p class="term-line success">&gt; python solution.py</p>
      <p class="term-line text">Ready for execution simulation</p>
    `;
  }

  showCodeNotification() {
    this.dom.codeCountBadge.textContent = 'Code Updated';
    this.dom.codeCountBadge.classList.add('live-pulse');
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
    // Check if text has structured notes, formula, or bullet points
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
    // Update badge counts
    const count = this.savedNotes.length;
    this.dom.notesCountBadge.textContent = count;
    this.dom.sidebarNotesCount.textContent = count;

    // Render in dedicated Notes Grid
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

    // Render in Sidebar Notes list
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
     Teacher Whiteboard Drawing Engine
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

    // Touch Events for Tablets/Mobiles
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

    // Preset Diagrams
    this.dom.btnDrawLinkedList.addEventListener('click', () => this.drawLinkedListPreset());
    this.dom.btnDrawCircuit.addEventListener('click', () => this.drawCircuitPreset());
    this.dom.btnDrawTree.addEventListener('click', () => this.drawBinaryTreePreset());

    // Draw initial sample board
    this.drawLinkedListPreset();
  }

  resizeWhiteboard() {
    if (!this.wbCanvas) return;
    const rect = this.wbCanvas.parentElement.getBoundingClientRect();
    this.wbCanvas.width = rect.width;
    this.wbCanvas.height = rect.height;
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
  }

  draw(e) {
    if (!this.isDrawing) return;
    const coords = this.getCanvasCoords(e);

    this.wbCtx.beginPath();
    this.wbCtx.moveTo(this.lastX, this.lastY);
    this.wbCtx.lineTo(coords.x, coords.y);
    this.wbCtx.strokeStyle = this.wbTool === 'eraser' ? '#111522' : this.wbColor;
    this.wbCtx.lineWidth = this.wbTool === 'eraser' ? 24 : this.wbSize;
    this.wbCtx.lineCap = 'round';
    this.wbCtx.lineJoin = 'round';
    this.wbCtx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  startDrawTouch(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.startDraw(touch);
    }
  }

  drawTouch(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      this.draw(touch);
    }
  }

  stopDraw() {
    this.isDrawing = false;
  }

  clearWhiteboard() {
    this.wbCtx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);
    this.dom.boardStatusText.textContent = 'Whiteboard Cleared.';
  }

  downloadWhiteboard() {
    const link = document.createElement('a');
    link.download = `OmniLearn_Whiteboard_${Date.now()}.png`;
    link.href = this.wbCanvas.toDataURL('image/png');
    link.click();
  }

  autoDrawOnWhiteboard(text) {
    const lower = text.toLowerCase();
    if (lower.includes('linked list') || lower.includes('node')) {
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

  /* Preset Teacher Drawings */
  drawLinkedListPreset() {
    const ctx = this.wbCtx;
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
      // Node Box Outer
      ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(startX, startY, nodeWidth, nodeHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Divider inside node (Data | Next)
      ctx.beginPath();
      ctx.moveTo(startX + 70, startY);
      ctx.lineTo(startX + 70, startY + nodeHeight);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // Data Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Fira Code, monospace';
      ctx.fillText(node.data, startX + 25, startY + 36);

      // Pointer Dot
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(startX + 95, startY + 30, 5, 0, Math.PI * 2);
      ctx.fill();

      // Memory Address label above
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Fira Code, monospace';
      ctx.fillText(`[${node.addr}]`, startX + 20, startY - 10);

      // Draw Arrow to next node
      if (i < nodes.length - 1) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(startX + 95, startY + 30);
        ctx.lineTo(startX + nodeWidth + 40, startY + 30);
        ctx.stroke();

        // Arrow Head
        ctx.beginPath();
        ctx.moveTo(startX + nodeWidth + 40, startY + 30);
        ctx.lineTo(startX + nodeWidth + 30, startY + 24);
        ctx.lineTo(startX + nodeWidth + 30, startY + 36);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();
      } else {
        // Null arrow
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

  drawCircuitPreset() {
    const ctx = this.wbCtx;
    ctx.clearRect(0, 0, this.wbCanvas.width, this.wbCanvas.height);

    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText("OHM'S LAW CIRCUIT ANALYSIS (V = I × R)", 40, 50);

    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(100, 120, 300, 200);
    ctx.stroke();

    // Voltage source
    ctx.fillStyle = '#111522';
    ctx.fillRect(80, 190, 40, 60);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 16px Fira Code';
    ctx.fillText('+ V -', 82, 225);

    // Resistor
    ctx.fillStyle = '#111522';
    ctx.fillRect(220, 100, 70, 40);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('R (Ω)', 230, 126);

    // Current Arrow
    ctx.fillStyle = '#10b981';
    ctx.fillText('→ Current (I) = V / R', 160, 350);
  }

  drawBinaryTreePreset() {
    const ctx = this.wbCtx;
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

    // Root: 50
    drawLine(280, 120, 180, 200);
    drawLine(280, 120, 380, 200);
    drawNode('50', 280, 120);

    // Children: 30 & 70
    drawLine(180, 200, 120, 280);
    drawLine(180, 200, 230, 280);
    drawLine(380, 200, 330, 280);
    drawLine(380, 200, 430, 280);

    drawNode('30', 180, 200);
    drawNode('70', 380, 200);

    // Leaves
    drawNode('20', 120, 280);
    drawNode('40', 230, 280);
    drawNode('60', 330, 280);
    drawNode('80', 430, 280);
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

    // Scale Orb core with volume
    const scaleFactor = 1 + (avgVolume / 255) * 0.45;
    this.dom.orbCore.style.transform = `scale(${scaleFactor})`;

    // Draw circular audio bars
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
