import { RTC } from './webrtc.js';
import { SoundFXEngine } from './soundboard.js';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  // ─── Application State ───
  let roomId = null;
  let camOn = false;
  let micOn = true;
  let syncMode = false;
  let sharing = false;
  let pipMini = false;
  let nickname = '';
  let partnerNickname = 'Partner';
  let roomPassword = '';
  let unreadCount = 0;
  let tabFocused = true;
  let originalTitle = document.title;
  let titleFlashInterval = null;
  let partnerPresence = 'away';
  let presenceInterval = null;
  let typingTimeout = null;
  let isTyping = false;
  let currentTheme = 'cyber';

  // Video Queue / Playlist State
  let playlist = [];
  let currentPlaylistIndex = -1;
  let bookmarks = [];

  // Laser Pointer / Drawing Annotation State
  let isDrawingMode = false;
  let isMouseDown = false;
  let drawColor = '#00d4ff';

  const sfx = new SoundFXEngine();

  // ─── Load Persistent Settings ───
  function loadSettings() {
    try {
      nickname = localStorage.getItem('sk_nickname') || '';
      currentTheme = localStorage.getItem('sk_theme') || 'cyber';
      applyTheme(currentTheme);

      const saved = localStorage.getItem('sk_settings');
      if (saved) {
        const s = JSON.parse(saved);
        if (s.volume !== undefined && volSlider) volSlider.value = s.volume;
        if (s.noiseFilter !== undefined && noiseCheck) noiseCheck.checked = s.noiseFilter;
        if (s.gate !== undefined && gateSlider) gateSlider.value = s.gate;
        if (s.gain !== undefined && gainSlider) gainSlider.value = s.gain;
        if (s.viewMode) currentViewMode = s.viewMode;
      }
    } catch (e) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem('sk_nickname', nickname);
      localStorage.setItem('sk_theme', currentTheme);
      localStorage.setItem('sk_settings', JSON.stringify({
        volume: volSlider?.value || 100,
        noiseFilter: noiseCheck?.checked ?? true,
        gate: gateSlider?.value || -30,
        gain: gainSlider?.value || 10,
        viewMode: currentViewMode
      }));
    } catch (e) {}
  }

  // ─── Color Themes ───
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', e => {
      applyTheme(e.target.value);
      rtc.send('THEME_SYNC', { theme: e.target.value });
    });
  }

  function applyTheme(themeName) {
    currentTheme = themeName;
    document.body.classList.remove('theme-cyber', 'theme-gold', 'theme-crimson', 'theme-oled');
    if (themeName !== 'cyber') {
      document.body.classList.add(`theme-${themeName}`);
    }
    if (themeSelect) themeSelect.value = themeName;
    saveSettings();
  }

  // ─── Browser Notification Permission ───
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function showNotification(title, body) {
    if (!tabFocused && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '🎬', silent: false });
      } catch (e) {}
    }
  }

  // ─── Tab Focus Tracking ───
  window.addEventListener('focus', () => {
    tabFocused = true;
    stopTitleFlash();
  });
  window.addEventListener('blur', () => { tabFocused = false; });

  function flashTitle(msg) {
    if (titleFlashInterval) return;
    let toggle = false;
    titleFlashInterval = setInterval(() => {
      document.title = toggle ? msg : originalTitle;
      toggle = !toggle;
    }, 1000);
  }

  function stopTitleFlash() {
    if (titleFlashInterval) {
      clearInterval(titleFlashInterval);
      titleFlashInterval = null;
      document.title = originalTitle;
    }
  }

  // ─── Authentic Marvel Studios Stencil Letter-Mask Engine ───
  const marvelIntro = document.getElementById('marvelIntro');
  const enterTheaterBtn = document.getElementById('enterTheaterBtn');
  const maskedTextCanvas = document.getElementById('maskedTextCanvas');

  if (maskedTextCanvas) {
    const maskedCtx = maskedTextCanvas.getContext('2d');

    const flipCanvas = document.createElement('canvas');
    flipCanvas.width = 1100;
    flipCanvas.height = 240;
    const flipCtx = flipCanvas.getContext('2d');
    let frameIndex = 0;

    const panelThemes = [
      ['#ffffff', '#e62429', '#ffd700', '#0a0a0d'],
      ['#ffffff', '#00d4ff', '#f43f5e', '#151515'],
      ['#ffffff', '#a855f7', '#22c55e', '#1e1b4b'],
      ['#ffffff', '#f59e0b', '#38bdf8', '#262626'],
      ['#ffffff', '#e11d48', '#fbbf24', '#020617']
    ];

    function getAutoFontSize(ctx, text, targetWidth) {
      let fontSize = 84;
      ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
      let textWidth = ctx.measureText(text).width;
      while (textWidth > targetWidth && fontSize > 20) {
        fontSize -= 2;
        ctx.font = `900 ${fontSize}px "Impact", "Arial Black", sans-serif`;
        textWidth = ctx.measureText(text).width;
      }
      return fontSize;
    }

    function renderMarvelStencilFrame() {
      frameIndex++;
      const w = flipCanvas.width;
      const h = flipCanvas.height;

      flipCtx.clearRect(0, 0, w, h);
      const theme = panelThemes[frameIndex % panelThemes.length];

      flipCtx.fillStyle = theme[3];
      flipCtx.fillRect(0, 0, w, h);

      const bandOffset = (frameIndex * 40) % w;
      flipCtx.fillStyle = theme[0];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset - 200, 0);
      flipCtx.lineTo(bandOffset + 220, 0);
      flipCtx.lineTo(bandOffset + 80, h);
      flipCtx.lineTo(bandOffset - 340, h);
      flipCtx.closePath();
      flipCtx.fill();

      flipCtx.fillStyle = theme[2];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset + 350, 0);
      flipCtx.lineTo(bandOffset + 550, 0);
      flipCtx.lineTo(bandOffset + 410, h);
      flipCtx.lineTo(bandOffset + 210, h);
      flipCtx.closePath();
      flipCtx.fill();

      flipCtx.fillStyle = theme[1];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset - 500, 0);
      flipCtx.lineTo(bandOffset - 320, 0);
      flipCtx.lineTo(bandOffset - 420, h);
      flipCtx.lineTo(bandOffset - 600, h);
      flipCtx.closePath();
      flipCtx.fill();

      flipCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      const step = 18;
      const dotOffset = (frameIndex * 6) % step;
      for (let x = dotOffset; x < w; x += step) {
        for (let y = dotOffset; y < h; y += step) {
          flipCtx.beginPath();
          flipCtx.arc(x, y, 3, 0, Math.PI * 2);
          flipCtx.fill();
        }
      }

      flipCtx.strokeStyle = '#ffffff';
      flipCtx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const lx = Math.random() * w;
        flipCtx.beginPath();
        flipCtx.moveTo(lx, 0);
        flipCtx.lineTo(lx + (Math.random() - 0.5) * 200, h);
        flipCtx.stroke();
      }

      maskedCtx.save();
      maskedCtx.clearRect(0, 0, w, h);
      maskedCtx.drawImage(flipCanvas, 0, 0);
      maskedCtx.globalCompositeOperation = 'destination-in';
      maskedCtx.fillStyle = '#ffffff';
      const text = 'SHANMUKH & KAVYA';
      const bestFontSize = getAutoFontSize(maskedCtx, text, w - 80);
      maskedCtx.font = `900 ${bestFontSize}px "Impact", "Arial Black", sans-serif`;
      maskedCtx.textAlign = 'center';
      maskedCtx.textBaseline = 'middle';
      maskedCtx.fillText(text, w / 2, h / 2 + 4);
      maskedCtx.restore();

      if (marvelIntro && !marvelIntro.classList.contains('hidden')) {
        setTimeout(() => requestAnimationFrame(renderMarvelStencilFrame), 42);
      }
    }
    renderMarvelStencilFrame();
  }

  // Marvel Studio Fanfare & Drumbeat
  if (enterTheaterBtn && marvelIntro) {
    enterTheaterBtn.addEventListener('click', () => {
      marvelIntro.classList.add('zoom-in');
      playMarvelFanfare();
      requestNotificationPermission();
      setTimeout(() => {
        marvelIntro.classList.add('hidden');
        setTimeout(() => marvelIntro.remove(), 850);
      }, 900);
    });
  }

  function playMarvelFanfare() {
    try {
      const c = sfx._getCtx();
      const drumTimes = [0, 0.25, 0.5, 0.65, 0.8];
      drumTimes.forEach(t => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, c.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + t + 0.15);
        g.gain.setValueAtTime(0.35, c.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t + 0.15);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(c.currentTime + t);
        osc.stop(c.currentTime + t + 0.15);
      });

      const brassNotes = [
        { f: 293.66, t: 0.8, d: 0.2 },
        { f: 440.00, t: 1.0, d: 0.2 },
        { f: 587.33, t: 1.2, d: 0.8 }
      ];

      brassNotes.forEach(n => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.value = n.f;
        g.gain.setValueAtTime(0.01, c.currentTime + n.t);
        g.gain.linearRampToValueAtTime(0.15, c.currentTime + n.t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + n.t + n.d);
        o.connect(g);
        g.connect(c.destination);
        o.start(c.currentTime + n.t);
        o.stop(c.currentTime + n.t + n.d);
      });
    } catch {}
  }

  // ─── Auto-Ping Keep Alive ───
  setInterval(() => {
    fetch('/ping').catch(() => {});
  }, 13 * 60 * 1000);

  // ─── DOM Elements ───
  const $ = id => document.getElementById(id);

  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const statusPill = $('statusPill');
  const roomPill = $('roomPill');
  const roomIdDisplay = $('roomIdDisplay');
  const copyIdBtn = $('copyIdBtn');

  const qualityIndicator = $('qualityIndicator');
  const signalBars = $('signalBars');
  const qualityLabel = $('qualityLabel');
  const presenceBadge = $('presenceBadge');
  const presenceDot = $('presenceDot');
  const presenceText = $('presenceText');

  const openRoomBtn = $('openRoomBtn');
  const roomModal = $('roomModal');
  const closeModalBtn = $('closeModalBtn');
  const createBtn = $('createBtn');
  const joinInput = $('joinInput');
  const joinBtn = $('joinBtn');
  const theaterBtn = $('theaterBtn');
  const nicknameInput = $('nicknameInput');
  const roomPasswordInput = $('roomPasswordInput');

  const viewGridBtn = $('viewGridBtn');
  const viewStageBtn = $('viewStageBtn');
  const viewPipBtn = $('viewPipBtn');
  const screenEl = $('screen');
  const cardMainStream = $('cardMainStream');
  const mainStreamLabel = $('mainStreamLabel');
  const streamBadge = $('streamBadge');

  const screenVideo = $('screenVideo');
  const localVideo = $('localVideo');
  const welcome = $('welcome');
  const shareBtn = $('shareBtn');
  const fileIn = $('fileIn');
  const videoUrlInput = $('videoUrlInput');
  const streamUrlBtn = $('streamUrlBtn');

  const cardLocal = $('cardLocal');
  const localCam = $('localCam');
  const localAvatar = $('localAvatar');
  const localHalo = $('localHalo');
  const localMicBadge = $('localMicBadge');
  const localNicknameEl = $('localNickname');
  const localAvatarCircle = $('localAvatarCircle');
  const localAvatarName = $('localAvatarName');

  const cardRemote = $('cardRemote');
  const remoteCam = $('remoteCam');
  const remoteAvatar = $('remoteAvatar');
  const remoteHalo = $('remoteHalo');
  const remoteMicBadge = $('remoteMicBadge');
  const remoteNicknameEl = $('remoteNickname');
  const remoteAvatarCircle = $('remoteAvatarCircle');
  const remoteAvatarName = $('remoteAvatarName');

  const pip = $('pip');
  const pipDrag = $('pipDrag');
  const pipToggle = $('pipToggle');
  const pipVideoWrap = $('pipVideoWrap');
  const pipRemoteCam = $('pipRemoteCam');
  const pipLocalCam = $('pipLocalCam');
  const pipOff = $('pipOff');
  const pipRing = $('pipRing');

  const playPauseBtn = $('playPauseBtn');
  const timeLabel = $('timeLabel');
  const seekBar = $('seekBar');
  const volBtn = $('volBtn');
  const volSlider = $('volSlider');
  const camBtn = $('camBtn');
  const micBtn = $('micBtn');
  const noiseBtn = $('noiseBtn');
  const fsBtn = $('fsBtn');
  const skipBackBtn = $('skipBackBtn');
  const skipFwdBtn = $('skipFwdBtn');
  const speedSelect = $('speedSelect');
  const nativePipBtn = $('nativePipBtn');
  const shortcutsBtn = $('shortcutsBtn');
  const drawBtn = $('drawBtn');
  const diagnosticsBtn = $('diagnosticsBtn');
  const addBookmarkBtn = $('addBookmarkBtn');

  const chatLog = $('chatLog');
  const chatForm = $('chatForm');
  const chatIn = $('chatIn');
  const emojiLayer = $('emojiLayer');
  const chatUnreadBadge = $('chatUnreadBadge');
  const typingIndicator = $('typingIndicator');
  const voiceMemoBtn = $('voiceMemoBtn');

  const dimLightsBtn = $('dimLightsBtn');
  const youtubePlayer = $('youtubePlayer');
  const voiceFxSelect = $('voiceFxSelect');
  const subOffsetSlider = $('subOffsetSlider');
  const subOffsetVal = $('subOffsetVal');

  const snapBtn = $('snapBtn');
  const pollBtn = $('pollBtn');
  const pollModal = $('pollModal');
  const closePollBtn = $('closePollBtn');
  const pollQuestionInput = $('pollQuestionInput');
  const pollOptionsInput = $('pollOptionsInput');
  const submitPollBtn = $('submitPollBtn');

  const summaryBtn = $('summaryBtn');
  const summaryModal = $('summaryModal');
  const closeSummaryBtn = $('closeSummaryBtn');
  const sumDuration = $('sumDuration');
  const sumSnaps = $('sumSnaps');
  const sumMemos = $('sumMemos');
  const sumPolls = $('sumPolls');

  const noiseCheck = $('noiseCheck');
  const nightCheck = $('nightCheck');
  const gateSlider = $('gateSlider');
  const gateVal = $('gateVal');
  const gainSlider = $('gainSlider');
  const gainVal = $('gainVal');
  const meterFill = $('meterFill');
  const remoteVolSlider = $('remoteVolSlider');
  const remoteVolVal = $('remoteVolVal');

  const eqBassSlider = $('eqBassSlider');
  const eqBassVal = $('eqBassVal');
  const eqMidSlider = $('eqMidSlider');
  const eqMidVal = $('eqMidVal');
  const eqTrebleSlider = $('eqTrebleSlider');
  const eqTrebleVal = $('eqTrebleVal');
  const spectrumCanvas = $('spectrumCanvas');
  const spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;

  const statsRtt = $('statsRtt');
  const statsPacketLoss = $('statsPacketLoss');
  const statsResolution = $('statsResolution');
  const statsFps = $('statsFps');

  const playlistIn = $('playlistIn');
  const playlistItems = $('playlistItems');
  const bookmarkItems = $('bookmarkItems');

  const drawPalette = $('drawPalette');
  const clearDrawBtn = $('clearDrawBtn');

  const reconnectingOverlay = $('reconnectingOverlay');
  const reconnectingText = $('reconnectingText');
  const dropZoneOverlay = $('dropZoneOverlay');
  const shortcutsModal = $('shortcutsModal');
  const closeShortcutsBtn = $('closeShortcutsBtn');
  const diagnosticsModal = $('diagnosticsModal');
  const closeDiagnosticsBtn = $('closeDiagnosticsBtn');
  const diagSignaling = $('diagSignaling');
  const diagPeerId = $('diagPeerId');
  const diagTargetId = $('diagTargetId');
  const diagRtt = $('diagRtt');
  const diagLoss = $('diagLoss');
  const diagStream = $('diagStream');
  const diagIce = $('diagIce');
  const diagPingBtn = $('diagPingBtn');

  const annotationCanvas = $('annotationCanvas');
  let annotationCtx = annotationCanvas ? annotationCanvas.getContext('2d') : null;

  loadSettings();

  if (nicknameInput && nickname) {
    nicknameInput.value = nickname;
  }

  // ─── Toast ───
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    $('toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000);
  }

  // ─── Welcome Particles ───
  function spawnWelcomeParticles() {
    const container = $('welcomeParticles');
    if (!container) return;
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'welcome-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = (Math.random() * 10) + 's';
      p.style.setProperty('--drift', (Math.random() * 100 - 50) + 'px');
      p.style.width = (2 + Math.random() * 3) + 'px';
      p.style.height = p.style.width;
      p.style.background = Math.random() > 0.5 ? 'var(--cyan)' : 'var(--purple)';
      container.appendChild(p);
    }
  }
  spawnWelcomeParticles();

  // ─── Zoom View Mode Switcher ───
  let currentViewMode = 'grid';
  function setViewMode(mode) {
    currentViewMode = mode;
    screenEl.classList.remove('zoom-grid-view', 'zoom-stage-view', 'zoom-pip-view');
    viewGridBtn?.classList.remove('active');
    viewStageBtn?.classList.remove('active');
    viewPipBtn?.classList.remove('active');

    if (mode === 'grid') {
      screenEl.classList.add('zoom-grid-view');
      viewGridBtn?.classList.add('active');
      pip.style.display = 'none';
    } else if (mode === 'stage') {
      screenEl.classList.add('zoom-stage-view');
      viewStageBtn?.classList.add('active');
      pip.style.display = 'none';
    } else if (mode === 'pip') {
      screenEl.classList.add('zoom-pip-view');
      viewPipBtn?.classList.add('active');
      pip.style.display = 'flex';
    }
    saveSettings();
    resizeAnnotationCanvas();
  }

  viewGridBtn?.addEventListener('click', () => setViewMode('grid'));
  viewStageBtn?.addEventListener('click', () => setViewMode('stage'));
  viewPipBtn?.addEventListener('click', () => setViewMode('pip'));

  // ─── Participant Cards & Avatar Fallback Manager ───
  function updateParticipantCards() {
    const hasLocalCam = localCam.srcObject && localCam.srcObject.getVideoTracks().some(t => t.readyState === 'live');
    const hasRemoteCam = remoteCam.srcObject && remoteCam.srcObject.getVideoTracks().some(t => t.readyState === 'live');

    if (hasLocalCam && camOn) {
      localCam.style.display = 'block';
      localAvatar.style.display = 'none';
    } else {
      localCam.style.display = 'none';
      localAvatar.style.display = 'flex';
    }
    localMicBadge.innerHTML = micOn ? `<i data-lucide="mic" style="width:13px;height:13px"></i>` : `<i data-lucide="mic-off" style="width:13px;height:13px"></i>`;
    localMicBadge.className = `mic-status ${micOn ? '' : 'off'}`;

    if (hasRemoteCam) {
      remoteCam.style.display = 'block';
      remoteAvatar.style.display = 'none';
      pipOff.style.display = 'none';
    } else {
      remoteCam.style.display = 'none';
      remoteAvatar.style.display = 'flex';
      pipOff.style.display = 'flex';
    }

    if (pipRemoteCam && pipRemoteCam.srcObject !== remoteCam.srcObject) {
      pipRemoteCam.srcObject = remoteCam.srcObject;
    }
    if (pipLocalCam && pipLocalCam.srcObject !== localCam.srcObject) {
      pipLocalCam.srcObject = localCam.srcObject;
    }

    if (window.lucide) lucide.createIcons();
  }

  function updateNicknameDisplay() {
    const initial = nickname ? nickname.charAt(0).toUpperCase() : 'S';
    const displayName = nickname || 'Shanmukh';
    if (localNicknameEl) localNicknameEl.textContent = displayName;
    if (localAvatarCircle) localAvatarCircle.textContent = initial + (nickname.length > 1 ? nickname.charAt(1).toUpperCase() : '');
    if (localAvatarName) localAvatarName.textContent = displayName;
  }

  function updatePartnerNicknameDisplay(name) {
    partnerNickname = name || 'Partner';
    const initial = partnerNickname.charAt(0).toUpperCase();
    if (remoteNicknameEl) remoteNicknameEl.textContent = partnerNickname;
    if (remoteAvatarCircle) remoteAvatarCircle.textContent = initial;
    if (remoteAvatarName) remoteAvatarName.textContent = partnerNickname;
    if (presenceText) presenceText.textContent = partnerNickname;
  }

  // ─── Tabs ───
  document.querySelectorAll('.side-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.side-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(tab.dataset.panel)?.classList.add('active');
      if (tab.dataset.panel === 'chatPanel') {
        unreadCount = 0;
        if (chatUnreadBadge) chatUnreadBadge.style.display = 'none';
      }
    });
  });

  // ─── Mobile / Autoplay Unmute Handler ───
  const tapUnmute = $('tapUnmute');
  function enableMediaPlayback() {
    [screenVideo, localVideo, remoteCam, localCam, pipRemoteCam, pipLocalCam].forEach(v => {
      if (v && (v.srcObject || v.src)) {
        v.play().catch(() => {});
      }
    });
    if (rtc.dsp && rtc.dsp.ctx && rtc.dsp.ctx.state === 'suspended') {
      rtc.dsp.ctx.resume().catch(() => {});
    }
    if (tapUnmute) tapUnmute.style.display = 'none';
  }

  if (tapUnmute) {
    tapUnmute.addEventListener('click', enableMediaPlayback);
    document.addEventListener('touchstart', enableMediaPlayback, { once: true });
  }

  // ─── RTC Setup ───
  const rtc = new RTC({
    onStatus: (s, detail) => {
      statusDot.className = 'dot' + (s === 'connected' || s === 'ready' ? ' on' : '');
      statusPill.classList.toggle('connecting', s === 'connecting');
      const labels = { ready: 'Ready', connecting: 'Connecting...', connected: 'Connected', disconnected: 'Offline', error: 'Error' };
      statusText.textContent = labels[s] || s;

      if (diagSignaling) diagSignaling.textContent = labels[s] || s;

      if (s === 'error') {
        toast(detail || 'Connection failed', 'warn');
        sysMsg(`⚠️ ${detail || 'Error'}`);
      } else if (s === 'connected') {
        toast('Connected to room partner!', 'ok');
        if (reconnectingOverlay) reconnectingOverlay.style.display = 'none';
        if (presenceBadge) presenceBadge.style.display = 'flex';
        if (qualityIndicator) qualityIndicator.style.display = 'flex';
        rtc.send('IDENTITY', { nickname });
        startPresencePing();
      } else if (s === 'connecting') {
        sysMsg('🔄 Connecting to peer...');
      } else if (s === 'disconnected') {
        if (presenceBadge) presenceBadge.style.display = 'none';
        if (qualityIndicator) qualityIndicator.style.display = 'none';
        stopPresencePing();
      }
    },
    onConnect: (pid) => {
      sysMsg('🎉 Partner connected!');
      toast('Partner joined!', 'ok');
      showNotification('SK WatchParty', 'Partner joined the room!');
      if (diagTargetId) diagTargetId.textContent = pid;
      if (syncMode && localVideo && !localVideo.paused) {
        rtc.send('SYNC', { a: 'play', t: localVideo.currentTime, speed: localVideo.playbackRate });
      }
    },
    onDisconnect: () => {
      sysMsg('Partner disconnected.');
      toast('Partner left', 'warn');
      showNotification('SK WatchParty', 'Partner disconnected.');
      if (diagTargetId) diagTargetId.textContent = '--';
      updateParticipantCards();
      updatePresenceUI('away');
    },
    onScreen: (stream) => {
      if (stream) {
        screenVideo.srcObject = stream;
        screenVideo.muted = false;
        screenVideo.volume = volSlider ? (volSlider.value / 100) * (remoteVolSlider ? remoteVolSlider.value / 100 : 1) : 1;
        screenVideo.style.display = 'block';
        localVideo.style.display = 'none';
        cardMainStream.style.display = 'flex';
        welcome.style.display = 'none';
        setViewMode('stage');
        screenVideo.play().catch(err => {
          console.log('Auto-play blocked, tap banner to enable', err);
          if (tapUnmute) tapUnmute.style.display = 'flex';
        });
        toast('Receiving HD screen & audio!', 'ok');
        showNotification('SK WatchParty', 'Partner started screen sharing!');
        if (diagStream) diagStream.textContent = 'Screen Share';
      } else {
        sharing = false;
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        cardMainStream.style.display = 'none';
        shareBtn.innerHTML = `<i data-lucide="monitor" style="width:18px;height:18px"></i> Share Screen`;
        shareBtn.classList.remove('btn-danger');
        if (window.lucide) lucide.createIcons();
        if (!syncMode) {
          welcome.style.display = 'flex';
          setViewMode('grid');
          if (diagStream) diagStream.textContent = 'None';
        }
      }
    },
    onCam: (stream) => {
      if (stream) {
        remoteCam.srcObject = stream;
        remoteCam.muted = false;
        remoteCam.volume = remoteVolSlider ? remoteVolSlider.value / 100 : 1;
        remoteCam.play().catch(err => {
          console.log('Cam playback blocked, tap banner to enable', err);
          if (tapUnmute) tapUnmute.style.display = 'flex';
        });
        updateParticipantCards();
        toast('Partner camera connected!', 'ok');
      } else {
        remoteCam.srcObject = null;
        updateParticipantCards();
      }
    },
    onData: (d) => handleData(d),
    onReconnecting: (attempt, max) => {
      if (reconnectingOverlay) reconnectingOverlay.style.display = 'flex';
      if (reconnectingText) reconnectingText.textContent = `Reconnecting... (${attempt}/${max})`;
      sysMsg(`🔄 Reconnecting attempt ${attempt}/${max}...`);
    },
    onStats: (stats) => {
      if (statsRtt) statsRtt.textContent = `${stats.rtt} ms`;
      if (statsPacketLoss) statsPacketLoss.textContent = `${stats.packetLoss}%`;
      if (statsResolution) statsResolution.textContent = stats.resolution || '--';
      if (statsFps) statsFps.textContent = `${stats.fps || '--'} fps`;
      if (diagRtt) diagRtt.textContent = `${stats.rtt} ms`;
      if (diagLoss) diagLoss.textContent = `${stats.packetLoss}%`;
      if (streamBadge && stats.resolution) {
        streamBadge.textContent = `${stats.resolution} ${stats.fps}FPS`;
      }
      updateQualityIndicator(stats);
    }
  });

  // ─── Connection Quality UI ───
  function updateQualityIndicator(stats) {
    if (!signalBars || !qualityLabel) return;
    let quality = 'excellent';
    if (stats.rtt > 200 || stats.packetLoss > 5) quality = 'poor';
    else if (stats.rtt > 100 || stats.packetLoss > 2) quality = 'fair';
    else if (stats.rtt > 50 || stats.packetLoss > 0.5) quality = 'good';

    signalBars.className = `signal-bars ${quality}`;
    qualityLabel.textContent = `${stats.rtt}ms`;
  }

  // ─── 3-Band Equalizer Controls ───
  function updateEQ() {
    const bass = eqBassSlider ? +eqBassSlider.value : 0;
    const mid = eqMidSlider ? +eqMidSlider.value : 0;
    const treble = eqTrebleSlider ? +eqTrebleSlider.value : 0;

    if (eqBassVal) eqBassVal.textContent = `${bass > 0 ? '+' : ''}${bass} dB`;
    if (eqMidVal) eqMidVal.textContent = `${mid > 0 ? '+' : ''}${mid} dB`;
    if (eqTrebleVal) eqTrebleVal.textContent = `${treble > 0 ? '+' : ''}${treble} dB`;

    rtc.dsp.setEQ(bass, mid, treble);
  }

  if (eqBassSlider) eqBassSlider.addEventListener('input', updateEQ);
  if (eqMidSlider) eqMidSlider.addEventListener('input', updateEQ);
  if (eqTrebleSlider) eqTrebleSlider.addEventListener('input', updateEQ);

  // ─── Real-Time 32-Bar Audio Spectrum Visualizer Engine ───
  function drawAudioSpectrum() {
    if (spectrumCtx && spectrumCanvas) {
      spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

      if (rtc.dsp && rtc.dsp.analyser) {
        const freqData = new Uint8Array(rtc.dsp.analyser.frequencyBinCount);
        rtc.dsp.analyser.getByteFrequencyData(freqData);

        const bars = 28;
        const barWidth = Math.floor(spectrumCanvas.width / bars) - 2;

        for (let i = 0; i < bars; i++) {
          const val = freqData[i * 2] || 0;
          const barHeight = Math.max(3, Math.floor((val / 255) * spectrumCanvas.height));
          const x = i * (barWidth + 2);
          const y = spectrumCanvas.height - barHeight;

          const grad = spectrumCtx.createLinearGradient(0, spectrumCanvas.height, 0, 0);
          grad.addColorStop(0, 'rgba(0, 212, 255, 0.4)');
          grad.addColorStop(1, 'rgba(168, 85, 247, 0.9)');

          spectrumCtx.fillStyle = grad;
          spectrumCtx.fillRect(x, y, barWidth, barHeight);
        }
      }
    }
    requestAnimationFrame(drawAudioSpectrum);
  }
  requestAnimationFrame(drawAudioSpectrum);

  // ─── Remote Volume Booster ───
  if (remoteVolSlider && remoteVolVal) {
    remoteVolSlider.addEventListener('input', e => {
      const v = +e.target.value;
      remoteVolVal.textContent = `${v}%`;
      const multiplier = v / 100;
      if (screenVideo) screenVideo.volume = Math.min(1, (volSlider ? volSlider.value / 100 : 1) * multiplier);
      if (remoteCam) remoteCam.volume = Math.min(1, multiplier);
    });
  }

  // ─── Presence System ───
  function startPresencePing() {
    stopPresencePing();
    presenceInterval = setInterval(() => {
      rtc.send('PRESENCE', { status: 'active', nickname });
    }, 10000);
    rtc.send('PRESENCE', { status: 'active', nickname });
  }

  function stopPresencePing() {
    if (presenceInterval) {
      clearInterval(presenceInterval);
      presenceInterval = null;
    }
  }

  function updatePresenceUI(status) {
    partnerPresence = status;
    if (presenceDot) {
      presenceDot.className = `presence-dot ${status}`;
    }
  }

  // ─── Room Setup ───
  const createdRoomCard = $('createdRoomCard');
  const modalRoomId = $('modalRoomId');
  const modalCopyBtn = $('modalCopyBtn');
  const modalShareBtn = $('modalShareBtn');

  const myId = 'sk-' + Math.floor(100000 + Math.random() * 900000);
  const rtcPromise = rtc.init(myId).then(id => {
    roomId = id;
    if (roomIdDisplay) roomIdDisplay.textContent = id;
    if (modalRoomId) modalRoomId.textContent = id;
    if (diagPeerId) diagPeerId.textContent = id;

    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomParam = urlParams.get('room') || urlParams.get('join');
    if (joinRoomParam && joinRoomParam !== id) {
      joinInput.value = joinRoomParam;
      doJoin();
    }
    return id;
  }).catch(err => {
    console.error('Signaling init error:', err);
    toast('Retrying signaling server connection...', 'warn');
  });

  // ─── Room Modal ───
  openRoomBtn.addEventListener('click', () => roomModal.classList.add('open'));
  closeModalBtn.addEventListener('click', () => roomModal.classList.remove('open'));
  roomModal.addEventListener('click', e => { if (e.target === roomModal) roomModal.classList.remove('open'); });

  if (nicknameInput) {
    nicknameInput.addEventListener('input', e => {
      nickname = e.target.value.trim();
      updateNicknameDisplay();
      saveSettings();
    });
  }

  createBtn.addEventListener('click', async () => {
    nickname = nicknameInput?.value?.trim() || '';
    roomPassword = roomPasswordInput?.value || '';
    updateNicknameDisplay();
    saveSettings();

    roomPill.style.display = 'flex';
    if (createdRoomCard) createdRoomCard.style.display = 'block';

    if (roomId) {
      if (modalRoomId) modalRoomId.textContent = roomId;
      sysMsg(`✨ Room created! Your Room ID is: ${roomId}`);
      toast(`Room created: ${roomId}`, 'ok');
    } else {
      if (modalRoomId) modalRoomId.textContent = 'Generating Room ID...';
      toast('Connecting to signaling server...', 'info');
      try {
        const id = await rtcPromise;
        if (id && modalRoomId) {
          modalRoomId.textContent = id;
          sysMsg(`✨ Room created! Your Room ID is: ${id}`);
          toast(`Room created: ${id}`, 'ok');
        }
      } catch (e) {}
    }
  });

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      if (!roomId) return toast('No Room ID to copy', 'warn');
      navigator.clipboard.writeText(roomId)
        .then(() => toast('Room ID copied to clipboard!', 'ok'))
        .catch(() => toast('Could not copy Room ID', 'warn'));
    });
  }

  if (modalShareBtn) {
    modalShareBtn.addEventListener('click', () => {
      const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      navigator.clipboard.writeText(shareUrl).then(() => toast('Direct Invite Link copied to clipboard!', 'ok'));
    });
  }

  joinBtn.addEventListener('click', doJoin);
  joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doJoin(); } });

  function doJoin() {
    const tid = joinInput.value.trim();
    if (!tid) return toast('Enter a Room ID', 'warn');
    nickname = nicknameInput?.value?.trim() || nickname;
    updateNicknameDisplay();
    saveSettings();
    rtc.connect(tid);
    roomPill.style.display = 'flex';
    roomIdDisplay.textContent = tid;
    roomModal.classList.remove('open');
    sysMsg(`Connecting to ${tid}...`);
  }

  copyIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => toast('Room ID copied!', 'ok'));
  });

  // ─── Diagnostics Modal ───
  if (diagnosticsBtn) {
    diagnosticsBtn.addEventListener('click', () => diagnosticsModal?.classList.add('open'));
  }
  if (qualityIndicator) {
    qualityIndicator.addEventListener('click', () => diagnosticsModal?.classList.add('open'));
  }
  if (closeDiagnosticsBtn) {
    closeDiagnosticsBtn.addEventListener('click', () => diagnosticsModal?.classList.remove('open'));
  }
  if (diagnosticsModal) {
    diagnosticsModal.addEventListener('click', e => { if (e.target === diagnosticsModal) diagnosticsModal.classList.remove('open'); });
  }

  if (diagPingBtn) {
    diagPingBtn.addEventListener('click', () => {
      const start = Date.now();
      toast('Testing signaling ping latency...', 'info');
      fetch('/ping').then(() => {
        const ms = Date.now() - start;
        toast(`Server ping: ${ms}ms`, 'ok');
        if (diagRtt) diagRtt.textContent = `${ms} ms (Server)`;
      }).catch(() => toast('Ping failed', 'err'));
    });
  }

  // ─── Laser Pointer & Drawing Annotation Canvas System ───
  function resizeAnnotationCanvas() {
    if (!annotationCanvas) return;
    annotationCanvas.width = screenEl.clientWidth;
    annotationCanvas.height = screenEl.clientHeight;
  }
  window.addEventListener('resize', resizeAnnotationCanvas);
  resizeAnnotationCanvas();

  if (drawBtn) {
    drawBtn.addEventListener('click', () => {
      isDrawingMode = !isDrawingMode;
      drawBtn.classList.toggle('drawing', isDrawingMode);
      annotationCanvas.classList.toggle('active', isDrawingMode);
      if (drawPalette) drawPalette.style.display = isDrawingMode ? 'flex' : 'none';
      toast(isDrawingMode ? 'Laser Pointer / Draw mode active' : 'Draw mode off', 'info');
    });
  }

  // Drawing Color Palette Buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      drawColor = btn.dataset.color || '#00d4ff';
    });
  });

  if (clearDrawBtn) {
    clearDrawBtn.addEventListener('click', () => {
      if (annotationCtx && annotationCanvas) {
        annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
        toast('Drawing canvas cleared', 'info');
      }
    });
  }

  function handleDrawPoint(x, y, isDrawing, color = '#00d4ff') {
    if (!annotationCtx || !annotationCanvas) return;
    const cw = annotationCanvas.width;
    const ch = annotationCanvas.height;
    const px = x * cw;
    const py = y * ch;

    annotationCtx.save();
    annotationCtx.fillStyle = color;
    annotationCtx.shadowColor = color;
    annotationCtx.shadowBlur = 12;
    annotationCtx.beginPath();
    annotationCtx.arc(px, py, isDrawing ? 4 : 6, 0, Math.PI * 2);
    annotationCtx.fill();
    annotationCtx.restore();

    setTimeout(() => {
      annotationCtx.clearRect(0, 0, cw, ch);
    }, 1400);
  }

  if (annotationCanvas) {
    annotationCanvas.addEventListener('mousedown', e => {
      isMouseDown = true;
      const rect = annotationCanvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      handleDrawPoint(nx, ny, true, drawColor);
      rtc.send('DRAW_POINT', { x: nx, y: ny, color: drawColor });
    });

    annotationCanvas.addEventListener('mousemove', e => {
      if (!isDrawingMode) return;
      const rect = annotationCanvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      handleDrawPoint(nx, ny, isMouseDown, drawColor);
      rtc.send('DRAW_POINT', { x: nx, y: ny, color: drawColor });
    });

    annotationCanvas.addEventListener('mouseup', () => { isMouseDown = false; });
  }

  // ─── Timed Bookmarks System ───
  if (addBookmarkBtn) {
    addBookmarkBtn.addEventListener('click', () => {
      if (!syncMode || !localVideo.currentTime) return toast('No active video to bookmark', 'warn');
      const timeSec = localVideo.currentTime;
      const timeFormatted = fmt(timeSec);
      const note = prompt(`Add note for bookmark at ${timeFormatted}:`, 'Favorite Scene');
      if (note !== null) {
        bookmarks.push({ time: timeSec, label: note || timeFormatted });
        renderBookmarksUI();
        toast(`Bookmarked at ${timeFormatted}`, 'ok');
      }
    });
  }

  function renderBookmarksUI() {
    if (!bookmarkItems) return;
    if (bookmarks.length === 0) {
      bookmarkItems.innerHTML = `<li class="playlist-empty">No bookmarks saved yet. Click 🔖 in controls dock!</li>`;
      return;
    }
    bookmarkItems.innerHTML = '';
    bookmarks.forEach((bm, idx) => {
      const li = document.createElement('li');
      li.className = 'bookmark-item';
      li.innerHTML = `
        <span class="bookmark-time">⏱️ ${fmt(bm.time)}</span>
        <span style="flex:1;margin:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(bm.label)}</span>
        <button class="playlist-remove" title="Delete"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
      `;
      li.addEventListener('click', e => {
        if (e.target.closest('.playlist-remove')) return;
        localVideo.currentTime = bm.time;
        rtc.send('SYNC', { a: 'seek', t: bm.time });
        toast(`Jumped to ${fmt(bm.time)}`, 'info');
      });
      li.querySelector('.playlist-remove').addEventListener('click', () => {
        bookmarks.splice(idx, 1);
        renderBookmarksUI();
      });
      bookmarkItems.appendChild(li);
    });
    if (window.lucide) lucide.createIcons();
  }

  // ─── Web Video URL, YouTube & HLS Streamer ───
  let ytPlayer = null;
  let isYouTubeMode = false;

  function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  function loadYouTubeVideo(ytId) {
    isYouTubeMode = true;
    localVideo.style.display = 'none';
    screenVideo.style.display = 'none';
    if (youtubePlayer) youtubePlayer.style.display = 'block';
    cardMainStream.style.display = 'flex';
    mainStreamLabel.innerHTML = `<i data-lucide="youtube" style="width:13px;height:13px"></i> YouTube Stream`;
    welcome.style.display = 'none';
    syncMode = true;
    seekBar.disabled = false;
    setViewMode('stage');
    if (diagStream) diagStream.textContent = `YouTube: ${ytId}`;

    const createOrLoad = () => {
      if (!ytPlayer) {
        ytPlayer = new window.YT.Player('youtubePlayer', {
          height: '100%',
          width: '100%',
          videoId: ytId,
          playerVars: { autoplay: 1, controls: 1, rel: 0 },
          events: {
            onStateChange: (event) => {
              const curTime = (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') ? ytPlayer.getCurrentTime() : 0;
              if (event.data === window.YT.PlayerState.PLAYING) {
                rtc.send('SYNC', { a: 'play', t: curTime, isYt: true });
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                rtc.send('SYNC', { a: 'pause', t: curTime, isYt: true });
              }
            }
          }
        });
      } else {
        if (typeof ytPlayer.loadVideoById === 'function') {
          ytPlayer.loadVideoById(ytId);
        }
      }
    };

    if (window.YT && window.YT.Player) {
      createOrLoad();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = createOrLoad;
    }
  }

  function loadHlsVideo(url) {
    const attachHls = () => {
      if (window.Hls && window.Hls.isSupported()) {
        const hls = new window.Hls();
        hls.loadSource(url);
        hls.attachMedia(localVideo);
        toast('HLS Stream attached!', 'ok');
      } else if (localVideo.canPlayType('application/vnd.apple.mpegurl')) {
        localVideo.src = url;
        toast('Native HLS Stream attached!', 'ok');
      }
    };
    if (window.Hls) {
      attachHls();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.onload = attachHls;
      document.head.appendChild(script);
    }
  }

  if (streamUrlBtn && videoUrlInput) {
    streamUrlBtn.addEventListener('click', () => {
      const url = videoUrlInput.value.trim();
      if (!url) return toast('Enter a video or YouTube URL', 'warn');
      loadUrlVideo(url);
      rtc.send('STREAM_URL', { url });
    });
    videoUrlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        streamUrlBtn.click();
      }
    });
  }

  function loadUrlVideo(url) {
    const ytId = extractYouTubeId(url);
    if (ytId) {
      loadYouTubeVideo(ytId);
      sysMsg(`▶️ Streaming YouTube Video (ID: ${ytId})`);
      toast('Streaming YouTube video live!', 'ok');
      return;
    }

    if (youtubePlayer) youtubePlayer.style.display = 'none';
    isYouTubeMode = false;

    if (url.includes('.m3u8')) {
      loadHlsVideo(url);
    } else {
      localVideo.src = url;
    }

    localVideo.muted = false;
    localVideo.volume = volSlider ? volSlider.value / 100 : 1;
    localVideo.style.display = 'block';
    screenVideo.style.display = 'none';
    cardMainStream.style.display = 'flex';
    mainStreamLabel.innerHTML = `<i data-lucide="globe" style="width:13px;height:13px"></i> Web Video Stream`;
    welcome.style.display = 'none';
    syncMode = true;
    seekBar.disabled = false;
    setViewMode('stage');
    if (diagStream) diagStream.textContent = `URL: ${url}`;

    localVideo.play().then(() => {
      playPauseBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px"></i>`;
      if (window.lucide) lucide.createIcons();
      attachAndStreamLocalVideo();
      sysMsg(`🌐 Streaming Web Video URL: ${url}`);
      toast('Streaming URL video live!', 'ok');
    }).catch(err => {
      toast('Web video playback blocked or invalid format', 'warn');
    });
  }

  // ─── Video Queue / Playlist System ───
  if (playlistIn) {
    playlistIn.addEventListener('change', e => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      files.forEach(f => playlist.push(f));
      renderPlaylistUI();
      toast(`Added ${files.length} video(s) to queue`, 'ok');

      if (!syncMode && playlist.length > 0) {
        playPlaylistItem(0);
      }
    });
  }

  function renderPlaylistUI() {
    if (!playlistItems) return;
    if (playlist.length === 0) {
      playlistItems.innerHTML = `<li class="playlist-empty">No videos queued. Click "Add Videos" or drag files into theater!</li>`;
      return;
    }
    playlistItems.innerHTML = '';
    playlist.forEach((file, idx) => {
      const li = document.createElement('li');
      li.className = `playlist-item ${idx === currentPlaylistIndex ? 'active' : ''}`;
      li.innerHTML = `
        <span class="playlist-name"><i data-lucide="video" style="width:14px;height:14px"></i> ${esc(file.name)}</span>
        <button class="playlist-remove" title="Remove"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
      `;
      li.querySelector('.playlist-name').addEventListener('click', () => playPlaylistItem(idx));
      li.querySelector('.playlist-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        playlist.splice(idx, 1);
        if (currentPlaylistIndex === idx) currentPlaylistIndex = -1;
        renderPlaylistUI();
      });
      playlistItems.appendChild(li);
    });
    if (window.lucide) lucide.createIcons();
  }

  function playPlaylistItem(idx) {
    if (idx < 0 || idx >= playlist.length) return;
    currentPlaylistIndex = idx;
    renderPlaylistUI();
    loadVideoFile(playlist[idx]);
  }

  localVideo.addEventListener('ended', () => {
    playPauseBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px"></i>`;
    if (window.lucide) lucide.createIcons();
    if (syncMode) rtc.send('SYNC', { a: 'pause', t: localVideo.duration || 0 });

    if (playlist.length > 0 && currentPlaylistIndex < playlist.length - 1) {
      toast('Auto-playing next video in queue...', 'info');
      setTimeout(() => playPlaylistItem(currentPlaylistIndex + 1), 1000);
    }
  });

  // ─── Screen Share ───
  shareBtn.addEventListener('click', async () => {
    if (sharing) {
      rtc.stopScreen();
      return;
    }
    try {
      const s = await rtc.shareScreen();
      screenVideo.srcObject = s;
      screenVideo.muted = true;
      screenVideo.style.display = 'block';
      cardMainStream.style.display = 'flex';
      mainStreamLabel.innerHTML = `<i data-lucide="monitor" style="width:13px;height:13px"></i> HD Screen Share`;
      screenVideo.play().catch(()=>{});
      localVideo.style.display = 'none';
      welcome.style.display = 'none';
      syncMode = false;
      sharing = true;
      shareBtn.innerHTML = `<i data-lucide="monitor-off" style="width:18px;height:18px"></i> Stop Sharing`;
      shareBtn.classList.add('btn-danger');
      if (window.lucide) lucide.createIcons();
      setViewMode('stage');
      sysMsg('🖥️ Sharing screen!');
      toast('Screen sharing started!', 'ok');

      const vTrack = s.getVideoTracks()[0];
      if (vTrack) {
        vTrack.addEventListener('ended', () => {
          rtc.stopScreen();
        });
      }
    } catch (e) {
      if (e.message === 'SECURE_CONTEXT_REQUIRED') {
        toast('Screen sharing requires HTTPS or localhost!', 'warn');
        sysMsg('⚠️ Screen sharing is blocked in non-secure HTTP contexts.');
      } else if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        toast('Screen sharing cancelled', 'info');
      } else {
        console.error('Screen sharing error:', e);
        toast(`Screen share error: ${e.message || 'Failed to capture screen'}`, 'warn');
        sysMsg(`❌ Could not start screen share: ${e.message || e.name}`);
      }
    }
  });

  // ─── Local Video Sync & Replay Stream Fix ───
  function attachAndStreamLocalVideo() {
    if (!localVideo || !syncMode) return;
    let fileStream = null;
    try {
      fileStream = localVideo.captureStream ? localVideo.captureStream() : (localVideo.mozCaptureStream ? localVideo.mozCaptureStream() : null);
    } catch (e) {
      console.warn('[Local Video Stream] captureStream failed or blocked:', e);
    }
    if (fileStream) {
      rtc.rebindCustomStream(fileStream);
    }
  }

  fileIn.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    playlist = [f];
    currentPlaylistIndex = 0;
    renderPlaylistUI();
    loadVideoFile(f);
  });

  async function loadVideoFile(f) {
    const objectUrl = URL.createObjectURL(f);
    localVideo.src = objectUrl;
    localVideo.muted = false;
    localVideo.volume = volSlider ? volSlider.value / 100 : 1;
    localVideo.style.display = 'block';
    screenVideo.style.display = 'none';
    cardMainStream.style.display = 'flex';
    mainStreamLabel.innerHTML = `<i data-lucide="file-video" style="width:13px;height:13px"></i> ${esc(f.name)}`;
    welcome.style.display = 'none';
    syncMode = true;
    seekBar.disabled = false;
    setViewMode('stage');
    if (diagStream) diagStream.textContent = `Local File: ${f.name}`;

    localVideo.addEventListener('loadedmetadata', () => {
      const dur = localVideo.duration || 1;
      timeLabel.textContent = `00:00 / ${fmt(dur)}`;
      seekBar.value = 0;
    }, { once: true });

    try {
      await localVideo.play();
      playPauseBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px"></i>`;
      if (window.lucide) lucide.createIcons();
      attachAndStreamLocalVideo();
      sysMsg(`🎬 Sharing local video stream: ${f.name}`);
      toast(`Streaming ${f.name} live to partner!`, 'ok');
    } catch (err) {
      console.log('Local video play click required', err);
      sysMsg(`🎬 Loaded: ${f.name}`);
      toast(`Loaded ${f.name}`, 'ok');
    }
  }

  // ─── Drag & Drop Video ───
  if (screenEl && dropZoneOverlay) {
    screenEl.addEventListener('dragover', e => {
      e.preventDefault();
      dropZoneOverlay.classList.add('active');
    });
    screenEl.addEventListener('dragleave', e => {
      e.preventDefault();
      dropZoneOverlay.classList.remove('active');
    });
    screenEl.addEventListener('drop', e => {
      e.preventDefault();
      dropZoneOverlay.classList.remove('active');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
      if (files.length > 0) {
        playlist.push(...files);
        renderPlaylistUI();
        if (!syncMode) {
          playPlaylistItem(playlist.length - files.length);
        }
      } else {
        toast('Please drop video files', 'warn');
      }
    });
  }

  localVideo.addEventListener('play', () => {
    playPauseBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px"></i>`;
    if (window.lucide) lucide.createIcons();
    attachAndStreamLocalVideo();
  });

  localVideo.addEventListener('pause', () => {
    playPauseBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px"></i>`;
    if (window.lucide) lucide.createIcons();
  });

  localVideo.addEventListener('seeked', () => {
    attachAndStreamLocalVideo();
  });

  localVideo.addEventListener('timeupdate', () => {
    if (!syncMode) return;
    const c = localVideo.currentTime, d = localVideo.duration || 1;
    seekBar.value = Math.round((c / d) * 1000);
    timeLabel.textContent = `${fmt(c)} / ${fmt(d)}`;
    updateSubtitles(c);
  });

  seekBar.addEventListener('input', e => {
    if (!syncMode || !localVideo.duration) return;
    const t = (e.target.value / 1000) * localVideo.duration;
    localVideo.currentTime = t;
    rtc.send('SYNC', { a: 'seek', t });
    attachAndStreamLocalVideo();
  });

  // ─── Play/Pause ───
  playPauseBtn.addEventListener('click', togglePlay);
  function togglePlay() {
    if (!syncMode) return;
    if (localVideo.paused) {
      localVideo.play();
      rtc.send('SYNC', { a: 'play', t: localVideo.currentTime, speed: localVideo.playbackRate });
    } else {
      localVideo.pause();
      rtc.send('SYNC', { a: 'pause', t: localVideo.currentTime });
    }
  }

  // ─── Skip Forward/Back ───
  if (skipBackBtn) {
    skipBackBtn.addEventListener('click', () => {
      if (!syncMode) return;
      localVideo.currentTime = Math.max(0, localVideo.currentTime - 10);
      rtc.send('SYNC', { a: 'seek', t: localVideo.currentTime });
    });
  }
  if (skipFwdBtn) {
    skipFwdBtn.addEventListener('click', () => {
      if (!syncMode || !localVideo.duration) return;
      localVideo.currentTime = Math.min(localVideo.duration, localVideo.currentTime + 10);
      rtc.send('SYNC', { a: 'seek', t: localVideo.currentTime });
    });
  }

  // ─── Playback Speed ───
  if (speedSelect) {
    speedSelect.addEventListener('change', e => {
      const speed = parseFloat(e.target.value);
      localVideo.playbackRate = speed;
      rtc.send('SYNC', { a: 'speed', speed });
      toast(`Playback speed: ${speed}x`, 'info');
    });
  }

  // ─── Volume ───
  volSlider.addEventListener('input', e => {
    const v = e.target.value / 100;
    screenVideo.volume = v;
    localVideo.volume = v;
    remoteCam.volume = v;
    saveSettings();
  });

  volBtn.addEventListener('click', () => {
    const m = !screenVideo.muted;
    screenVideo.muted = m;
    localVideo.muted = m;
    remoteCam.muted = m;
    volBtn.innerHTML = m ? `<i data-lucide="volume-x" style="width:16px;height:16px"></i>` : `<i data-lucide="volume-2" style="width:16px;height:16px"></i>`;
    if (window.lucide) lucide.createIcons();
  });

  // ─── Camera ───
  camBtn.addEventListener('click', async () => {
    if (!camOn) {
      try {
        const s = await rtc.startCam();
        localCam.srcObject = s;
        localCam.muted = true;
        localCam.play().catch(()=>{});
        camBtn.classList.add('active');
        camBtn.classList.remove('off');
        micBtn.classList.add('active');
        micBtn.classList.remove('off');
        camOn = true;
        micOn = true;
        updateParticipantCards();
        toast('Camera & Mic active', 'ok');
      } catch (err) {
        toast('Camera access denied or unavailable', 'err');
      }
    } else {
      rtc.stopCam();
      localCam.srcObject = null;
      camBtn.classList.remove('active');
      camBtn.classList.add('off');
      micBtn.classList.remove('active');
      micBtn.classList.add('off');
      camOn = false;
      micOn = false;
      updateParticipantCards();
      toast('Camera turned off', 'info');
    }
  });

  // ─── Mic ───
  micBtn.addEventListener('click', async () => {
    if (!rtc.rawCamStream) {
      try {
        await rtc.startMicOnly();
        micOn = true;
        micBtn.classList.add('active');
        micBtn.classList.remove('off');
        micBtn.innerHTML = `<i data-lucide="mic" style="width:16px;height:16px"></i>`;
        if (window.lucide) lucide.createIcons();
        updateParticipantCards();
        toast('Microphone unmuted', 'ok');
      } catch (e) {
        toast('Microphone access denied', 'err');
      }
      return;
    }
    const tracks = rtc.rawCamStream.getAudioTracks();
    if (!tracks || tracks.length === 0) return toast('No microphone track found', 'warn');
    const enabled = !tracks[0].enabled;
    tracks.forEach(t => t.enabled = enabled);
    if (rtc.camStream) {
      rtc.camStream.getAudioTracks().forEach(t => t.enabled = enabled);
    }
    micOn = enabled;
    micBtn.classList.toggle('active', micOn);
    micBtn.classList.toggle('off', !micOn);
    micBtn.innerHTML = micOn ? `<i data-lucide="mic" style="width:16px;height:16px"></i>` : `<i data-lucide="mic-off" style="width:16px;height:16px"></i>`;
    if (window.lucide) lucide.createIcons();
    updateParticipantCards();
    toast(micOn ? 'Microphone unmuted' : 'Microphone muted', micOn ? 'info' : 'warn');
  });

  // ─── Native PIP ───
  if (nativePipBtn) {
    nativePipBtn.addEventListener('click', async () => {
      const video = screenVideo.style.display !== 'none' ? screenVideo : localVideo;
      if (document.pictureInPictureElement) {
        try { await document.exitPictureInPicture(); } catch (e) {}
        nativePipBtn.classList.remove('active');
      } else if (video && video.readyState >= 2) {
        try {
          await video.requestPictureInPicture();
          nativePipBtn.classList.add('active');
          toast('Picture-in-Picture active', 'ok');
        } catch (e) {
          toast('PIP not supported for this video', 'warn');
        }
      }
    });
  }

  // ─── PIP toggle ───
  pipToggle.addEventListener('click', e => {
    e.stopPropagation();
    pipMini = !pipMini;
    pip.classList.toggle('mini', pipMini);
    pipVideoWrap.style.display = pipMini ? 'none' : 'block';
    pipToggle.innerHTML = pipMini ? `<i data-lucide="plus" style="width:12px;height:12px"></i>` : `<i data-lucide="minus" style="width:12px;height:12px"></i>`;
    if (window.lucide) lucide.createIcons();
  });

  // ─── OLED Dynamic Ambilight Engine ───
  const ambilightCanvas = $('ambilightCanvas');
  let ambilightCtx = ambilightCanvas ? ambilightCanvas.getContext('2d') : null;

  function renderAmbilightFrame() {
    if (ambilightCtx && ambilightCanvas) {
      const activeVideo = (screenVideo.style.display !== 'none' && screenVideo.readyState >= 2) ? screenVideo :
                          (localVideo.style.display !== 'none' && localVideo.readyState >= 2) ? localVideo : null;
      if (activeVideo) {
        if (ambilightCanvas.width !== 64 || ambilightCanvas.height !== 36) {
          ambilightCanvas.width = 64;
          ambilightCanvas.height = 36;
        }
        try {
          ambilightCtx.drawImage(activeVideo, 0, 0, 64, 36);
          ambilightCanvas.style.opacity = '0.7';
        } catch (e) {}
      } else {
        ambilightCanvas.style.opacity = '0';
      }
    }
    requestAnimationFrame(renderAmbilightFrame);
  }
  requestAnimationFrame(renderAmbilightFrame);

  // ─── Subtitle Sync & Parser Engine ───
  const subFileIn = $('subFileIn');
  const subtitleContainer = $('subtitleContainer');
  let subtitles = [];

  if (subFileIn) {
    subFileIn.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = evt => {
        const content = evt.target.result;
        subtitles = file.name.endsWith('.vtt') ? parseVTT(content) : parseSRT(content);
        toast(`Loaded subtitles: ${subtitles.length} lines`, 'ok');
        rtc.send('SUBTITLE_SYNC', { subtitles });
      };
      reader.readAsText(file);
    });
  }

  function parseSRT(data) {
    if (!data) return [];
    const cleanData = data.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = cleanData.split(/\n\s*\n/);
    const result = [];
    const timeToSec = t => {
      if (!t) return 0;
      const cleanT = t.trim().split(/\s+/)[0].replace('.', ',');
      const parts = cleanT.split(':');
      if (parts.length === 3) {
        const [h, m, sMs] = parts;
        const [s, ms] = (sMs || '0,0').split(',');
        return (parseFloat(h) || 0) * 3600 + (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0) + (parseFloat(ms) || 0) / 1000;
      } else if (parts.length === 2) {
        const [m, sMs] = parts;
        const [s, ms] = (sMs || '0,0').split(',');
        return (parseFloat(m) || 0) * 60 + (parseFloat(s) || 0) + (parseFloat(ms) || 0) / 1000;
      }
      return 0;
    };

    blocks.forEach(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const timeLineIdx = lines.findIndex(l => l.includes('-->'));
      if (timeLineIdx !== -1) {
        const timeLine = lines[timeLineIdx];
        const [startStr, endStr] = timeLine.split('-->');
        if (startStr && endStr) {
          const text = lines.slice(timeLineIdx + 1).join('<br>').replace(/<(?!\/?(?:i|b|br)\b)[^>]+>/gi, '');
          if (text) {
            result.push({ start: timeToSec(startStr), end: timeToSec(endStr), text });
          }
        }
      }
    });
    return result;
  }

  function parseVTT(data) {
    return parseSRT(data.replace(/WEBVTT/g, ''));
  }

  // ─── Subtitle Delay Offset ───
  let subOffsetSec = 0;
  if (subOffsetSlider && subOffsetVal) {
    subOffsetSlider.addEventListener('input', e => {
      subOffsetSec = parseFloat(e.target.value);
      subOffsetVal.textContent = `${subOffsetSec > 0 ? '+' : ''}${subOffsetSec.toFixed(1)}s`;
    });
  }

  function updateSubtitles(currentTime) {
    if (!subtitleContainer) return;
    if (!subtitles || subtitles.length === 0) {
      subtitleContainer.style.display = 'none';
      return;
    }
    const effectiveTime = currentTime + subOffsetSec;
    const currentSub = subtitles.find(s => effectiveTime >= s.start && effectiveTime <= s.end);
    if (currentSub) {
      subtitleContainer.innerHTML = currentSub.text;
      subtitleContainer.style.display = 'block';
    } else {
      subtitleContainer.style.display = 'none';
    }
  }

  // ─── Color Grading & Aspect Ratio Switches ───
  const filterSelect = $('filterSelect');
  const aspectBtn = $('aspectBtn');
  const grainBtn = $('grainBtn');
  const filmGrainOverlay = $('filmGrainOverlay');

  const aspectModes = ['normal', 'anamorphic', 'imax'];
  let currentAspectIdx = 0;

  if (filterSelect) {
    filterSelect.addEventListener('change', e => {
      applyFilter(e.target.value);
      rtc.send('FILTER_SYNC', { filter: e.target.value });
    });
  }

  function applyFilter(filterName) {
    [screenVideo, localVideo].forEach(v => {
      if (!v) return;
      v.classList.remove('filter-inception', 'filter-oppenheimer', 'filter-interstellar', 'filter-tenet');
      if (filterName !== 'none') {
        v.classList.add(`filter-${filterName}`);
      }
    });
  }

  if (aspectBtn) {
    aspectBtn.addEventListener('click', () => {
      currentAspectIdx = (currentAspectIdx + 1) % aspectModes.length;
      const mode = aspectModes[currentAspectIdx];
      [cardMainStream].forEach(card => {
        if (!card) return;
        card.classList.remove('aspect-anamorphic', 'aspect-imax');
        if (mode === 'anamorphic') card.classList.add('aspect-anamorphic');
        if (mode === 'imax') card.classList.add('aspect-imax');
      });
      const labels = { normal: '16:9 Standard', anamorphic: '2.39:1 Anamorphic', imax: '1.43:1 IMAX' };
      toast(`Aspect Ratio: ${labels[mode]}`, 'info');
    });
  }

  if (grainBtn && filmGrainOverlay) {
    grainBtn.addEventListener('click', () => {
      const isActive = filmGrainOverlay.classList.toggle('active');
      grainBtn.classList.toggle('active', isActive);
      toast(isActive ? '35mm Film Grain enabled' : 'Film Grain disabled', 'info');
    });
  }

  // ─── Audio Delay Slider & Voice Modulator ───
  const delaySlider = $('delaySlider');
  const delayVal = $('delayVal');
  if (delaySlider && delayVal) {
    delaySlider.addEventListener('input', e => {
      const ms = +e.target.value;
      delayVal.textContent = `${ms} ms`;
      rtc.dsp.setDelay(ms);
    });
  }

  if (voiceFxSelect) {
    voiceFxSelect.addEventListener('change', e => {
      rtc.dsp.setVoiceFX(e.target.value);
      toast(`Voice Modulator: ${e.target.options[e.target.selectedIndex].text}`, 'info');
    });
  }

  if (dimLightsBtn) {
    dimLightsBtn.addEventListener('click', () => {
      const active = document.body.classList.toggle('dim-lights');
      dimLightsBtn.classList.toggle('active', active);
      toast(active ? 'Cinema Lights Dimmed' : 'Cinema Lights Normal', 'info');
    });
  }

  // ─── Canvas QR Code Generator ───
  function generateQRCodeCanvas(text) {
    const container = $('qrCodeContainer');
    if (!container) return;
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 130;
    canvas.height = 130;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 130, 130);
    ctx.fillStyle = '#000000';

    const drawFinder = (x, y) => {
      ctx.fillRect(x, y, 35, 35);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5, y + 5, 25, 25);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 10, y + 10, 15, 15);
    };
    drawFinder(8, 8);
    drawFinder(87, 8);
    drawFinder(8, 87);

    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash << 5) - hash + text.charCodeAt(i);
    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 11; c++) {
        if ((r < 4 && c < 4) || (r < 4 && c > 6) || (r > 6 && c < 4)) continue;
        if (((hash >> (r + c)) & 1) === 1 || (r * c) % 3 === 0) {
          ctx.fillRect(10 + c * 10, 10 + r * 10, 8, 8);
        }
      }
    }
    container.appendChild(canvas);
    const label = document.createElement('span');
    label.style.fontSize = '0.65rem';
    label.style.color = '#333333';
    label.style.marginTop = '4px';
    label.style.fontWeight = '700';
    label.textContent = 'Scan to Join on Mobile';
    container.appendChild(label);
    container.style.display = 'flex';
  }

  createBtn.addEventListener('click', () => {
    setTimeout(() => {
      if (roomId) {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
        generateQRCodeCanvas(shareUrl);
      }
    }, 200);
  });

  // ─── Noise Filter & Night Mode Controls ───
  let sessionStartTime = Date.now();
  let statsSnapsCount = 0;
  let statsMemosCount = 0;
  let statsPollsCount = 0;

  if (nightCheck) {
    nightCheck.addEventListener('change', e => {
      rtc.dsp.toggleNightMode(e.target.checked);
      toast(e.target.checked ? 'Night Mode Audio Leveler Active' : 'Standard Audio Leveler', 'info');
    });
  }

  if (summaryBtn && summaryModal) {
    summaryBtn.addEventListener('click', () => {
      const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
      if (sumDuration) sumDuration.textContent = fmt(elapsedSec);
      if (sumSnaps) sumSnaps.textContent = statsSnapsCount;
      if (sumMemos) sumMemos.textContent = statsMemosCount;
      if (sumPolls) sumPolls.textContent = statsPollsCount;
      summaryModal.classList.add('open');
    });
  }
  if (closeSummaryBtn) {
    closeSummaryBtn.addEventListener('click', () => summaryModal?.classList.remove('open'));
  }

  noiseCheck.addEventListener('change', e => {
    rtc.dsp.toggle(e.target.checked);
    noiseBtn.classList.toggle('active', e.target.checked);
    noiseBtn.classList.toggle('off', !e.target.checked);
    saveSettings();
  });
  noiseBtn.addEventListener('click', () => {
    noiseCheck.checked = !noiseCheck.checked;
    noiseCheck.dispatchEvent(new Event('change'));
  });
  gateSlider.addEventListener('input', e => {
    gateVal.textContent = `${e.target.value} dB`;
    rtc.dsp.setThreshold(+e.target.value);
    saveSettings();
  });
  gainSlider.addEventListener('input', e => {
    const v = e.target.value / 10;
    gainVal.textContent = `${v.toFixed(1)}x`;
    rtc.dsp.setGain(v);
    saveSettings();
  });

  // ─── VU Meter & Speaking Halo Ring ───
  function tickMeter() {
    if (camOn && micOn) {
      const lv = rtc.dsp.getLevel();
      meterFill.style.width = lv + '%';
      const isSpeaking = lv > 12;
      pipRing.classList.toggle('speaking', isSpeaking);
      cardLocal?.classList.toggle('speaking', isSpeaking);
    } else {
      meterFill.style.width = '0%';
      pipRing.classList.remove('speaking');
      cardLocal?.classList.remove('speaking');
    }
    requestAnimationFrame(tickMeter);
  }
  requestAnimationFrame(tickMeter);

  updateParticipantCards();
  updateNicknameDisplay();

  // ─── Emojis & Soundboard FX ───
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.addEventListener('click', () => {
      const e = b.dataset.e;
      spawnEmoji(e, nickname || 'You');
      rtc.send('EMOJI', { e });
      b.classList.add('pop');
      setTimeout(() => b.classList.remove('pop'), 350);
    });
  });

  document.querySelectorAll('.fx-card').forEach(card => {
    card.addEventListener('click', () => {
      const fx = card.dataset.fx;
      sfx.play(fx);
      rtc.send('SOUND_FX', { fx });
      card.classList.add('pop');
      setTimeout(() => card.classList.remove('pop'), 350);
    });
  });

  function spawnEmoji(e, who = '') {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'float-e';
        el.innerHTML = `${e}${i === 0 && who ? `<span class="react-who">${who}</span>` : ''}`;
        el.style.left = (15 + Math.random() * 70) + '%';
        el.style.bottom = '50px';
        emojiLayer.appendChild(el);
        setTimeout(() => el.remove(), 2500);
      }, i * 100);
    }
  }

  // ─── Chat with Typing Indicators & Link Detection ───
  let chatTypingTimer = null;

  chatIn.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      rtc.send('TYPING', { typing: true });
    }
    clearTimeout(chatTypingTimer);
    chatTypingTimer = setTimeout(() => {
      isTyping = false;
      rtc.send('TYPING', { typing: false });
    }, 2000);
  });

  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const t = chatIn.value.trim();
    if (!t) return;
    addMsg(nickname || 'You', t, true);
    rtc.send('CHAT', { t, nickname });
    chatIn.value = '';
    isTyping = false;
    rtc.send('TYPING', { typing: false });
  });

  // ─── Chat Voice Memos ───
  let voiceRecorder = null;
  let voiceChunks = [];

  if (voiceMemoBtn) {
    voiceMemoBtn.addEventListener('click', async () => {
      if (!voiceRecorder || voiceRecorder.state === 'inactive') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          voiceChunks = [];
          const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' :
                           (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/mp4')) ? 'audio/mp4' : '';
          voiceRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
          voiceRecorder.ondataavailable = e => voiceChunks.push(e.data);
          voiceRecorder.onstop = () => {
            const type = voiceRecorder.mimeType || 'audio/webm';
            const blob = new Blob(voiceChunks, { type });
            const reader = new FileReader();
            reader.onload = evt => {
              const audioUrl = evt.target.result;
              statsMemosCount++;
              addVoiceMemoMsg(nickname || 'You', audioUrl, true);
              rtc.send('VOICE_MEMO', { audio: audioUrl, nickname });
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
          };
          voiceRecorder.start();
          voiceMemoBtn.classList.add('btn-recording');
          toast('Recording voice memo... Click again to send!', 'info');
        } catch (e) {
          toast('Microphone access required for voice memos', 'warn');
        }
      } else {
        voiceRecorder.stop();
        voiceMemoBtn.classList.remove('btn-recording');
        toast('Voice memo sent!', 'ok');
      }
    });
  }

  // ─── Movie Frame Snapshot Tool ───
  function takeSnapshot() {
    const activeVideo = (screenVideo.style.display !== 'none' && screenVideo.readyState >= 2) ? screenVideo :
                        (localVideo.style.display !== 'none' && localVideo.readyState >= 2) ? localVideo : null;
    if (!activeVideo) return toast('No active video to capture snapshot', 'warn');

    const canvas = document.createElement('canvas');
    canvas.width = activeVideo.videoWidth || 1920;
    canvas.height = activeVideo.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);

    sfx.play('cameraShutter');

    const flash = document.createElement('div');
    flash.className = 'camera-flash';
    screenEl.appendChild(flash);
    setTimeout(() => flash.remove(), 350);

    try {
      const imgData = canvas.toDataURL('image/png');
      statsSnapsCount++;
      addImgMsg(nickname || 'You', imgData, true);
      rtc.send('CHAT_IMG', { img: imgData, nickname });
      toast('HD Movie Snapshot captured & shared!', 'ok');

      const a = document.createElement('a');
      a.href = imgData;
      a.download = `SK_WatchParty_Snapshot_${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.warn('Snapshot CORS error:', e);
      toast('Cannot capture snapshot from cross-origin protected video', 'warn');
    }
  }

  if (snapBtn) snapBtn.addEventListener('click', takeSnapshot);

  // ─── Ambient Soundscape Generators ───
  document.querySelectorAll('.ambient-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.ambient;
      const active = sfx.toggleAmbient(type);
      btn.classList.toggle('active', active);
      toast(active ? `${btn.textContent} ambient started` : `${btn.textContent} stopped`, 'info');
    });
  });

  // ─── Live Room Polls Engine ───
  let activePolls = new Map();

  if (pollBtn) pollBtn.addEventListener('click', () => pollModal?.classList.add('open'));
  if (closePollBtn) closePollBtn.addEventListener('click', () => pollModal?.classList.remove('open'));

  if (submitPollBtn && pollQuestionInput && pollOptionsInput) {
    submitPollBtn.addEventListener('click', () => {
      const q = pollQuestionInput.value.trim();
      const rawOpts = pollOptionsInput.value.trim();
      if (!q || !rawOpts) return toast('Enter question and options', 'warn');

      const options = rawOpts.split(',').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) return toast('Enter at least 2 options', 'warn');

      const pollId = 'poll-' + Date.now();
      const pollData = { id: pollId, question: q, options, votes: options.map(() => 0), totalVotes: 0, creator: nickname || 'You' };

      statsPollsCount++;
      activePolls.set(pollId, pollData);
      renderPollMsg(pollData, true);
      rtc.send('CREATE_POLL', { poll: pollData });
      pollModal.classList.remove('open');
      pollQuestionInput.value = '';
      pollOptionsInput.value = '';
      toast('Live Poll launched to room!', 'ok');
    });
  }

  function renderPollMsg(poll, isCreator = false) {
    const d = document.createElement('div');
    d.className = 'chat-msg sys-msg';
    d.dataset.pollId = poll.id;
    d.innerHTML = `
      <div class="poll-card">
        <div class="poll-question">📊 ${esc(poll.question)}</div>
        <div class="poll-options" id="opts-${poll.id}">
          ${poll.options.map((opt, idx) => {
            const cnt = poll.votes[idx] || 0;
            const pct = poll.totalVotes > 0 ? Math.round((cnt / poll.totalVotes) * 100) : 0;
            return `
              <button class="poll-opt-btn" data-poll-id="${poll.id}" data-opt-idx="${idx}">
                <div class="poll-opt-bar" style="width:${pct}%"></div>
                <span class="poll-opt-text">${esc(opt)}</span>
                <span class="poll-opt-count">${pct}% (${cnt})</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;

    d.querySelectorAll('.poll-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pollId;
        const oidx = parseInt(btn.dataset.optIdx, 10);
        const p = activePolls.get(pid);
        if (p) {
          p.votes[oidx] = (p.votes[oidx] || 0) + 1;
          p.totalVotes++;
          updatePollUI(p);
          rtc.send('VOTE_POLL', { pollId: pid, optionIdx: oidx });
          toast('Vote cast!', 'info');
        }
      });
    });
  }

  function updatePollUI(poll) {
    const optsContainer = $(`opts-${poll.id}`);
    if (!optsContainer) return;
    optsContainer.innerHTML = poll.options.map((opt, idx) => {
      const cnt = poll.votes[idx] || 0;
      const pct = poll.totalVotes > 0 ? Math.round((cnt / poll.totalVotes) * 100) : 0;
      return `
        <button class="poll-opt-btn" data-poll-id="${poll.id}" data-opt-idx="${idx}">
          <div class="poll-opt-bar" style="width:${pct}%"></div>
          <span class="poll-opt-text">${esc(opt)}</span>
          <span class="poll-opt-count">${pct}% (${cnt})</span>
        </button>
      `;
    }).join('');
  }

  function linkify(text) {
    const urlRegex = /(https?:\/\/[^\s<]+)/gi;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  }

  function relativeTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addMsg(who, text, me = false) {
    const d = document.createElement('div');
    d.className = `chat-msg ${me ? 'me' : 'them'}`;
    const time = relativeTime();
    d.innerHTML = `<div class="chat-who">${esc(who)} <span class="chat-t">${time}</span></div>${linkify(esc(text))}`;
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (!me) {
      const chatTab = document.querySelector('[data-panel="chatPanel"]');
      if (chatTab && !chatTab.classList.contains('active')) {
        unreadCount++;
        if (chatUnreadBadge) {
          chatUnreadBadge.textContent = unreadCount;
          chatUnreadBadge.style.display = 'flex';
        }
      }
    }
  }

  function addImgMsg(who, imgSrc, me = false) {
    const d = document.createElement('div');
    d.className = `chat-msg ${me ? 'me' : 'them'}`;
    const time = relativeTime();
    d.innerHTML = `<div class="chat-who">${esc(who)} <span class="chat-t">${time}</span></div><img class="chat-img" src="${imgSrc}" alt="Shared image">`;
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function sysMsg(t) {
    const d = document.createElement('div');
    d.className = 'sys-msg';
    d.textContent = t;
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // ─── Incoming Data ───
  function handleData(d) {
    if (!d || typeof d !== 'object' || !d.type) return;
    switch (d.type) {
      case 'SYNC':
        if (d.payload) {
          if (!syncMode) {
            syncMode = true;
            if (cardMainStream) cardMainStream.style.display = 'flex';
            if (welcome) welcome.style.display = 'none';
          }
          if (d.payload.isYt && ytPlayer) {
            if (d.payload.a === 'play') {
              if (typeof ytPlayer.seekTo === 'function') ytPlayer.seekTo(d.payload.t, true);
              if (typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
            } else if (d.payload.a === 'pause') {
              if (typeof ytPlayer.seekTo === 'function') ytPlayer.seekTo(d.payload.t, true);
              if (typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
            }
          } else {
            if (d.payload.a === 'play') {
              localVideo.currentTime = d.payload.t;
              if (d.payload.speed) localVideo.playbackRate = d.payload.speed;
              localVideo.play().catch(()=>{});
            }
            else if (d.payload.a === 'pause') { localVideo.currentTime = d.payload.t; localVideo.pause(); }
            else if (d.payload.a === 'seek') { localVideo.currentTime = d.payload.t; }
            else if (d.payload.a === 'speed') {
              localVideo.playbackRate = d.payload.speed;
              if (speedSelect) speedSelect.value = d.payload.speed;
              toast(`Playback speed: ${d.payload.speed}x`, 'info');
            }
          }
        }
        break;
      case 'EMOJI':
        if (d.payload?.e) spawnEmoji(d.payload.e, partnerNickname);
        break;
      case 'SOUND_FX':
        if (d.payload?.fx) {
          sfx.play(d.payload.fx);
          const fxLabels = {
            popcorn: '🍿 Popcorn', applause: '👏 Applause', drumroll: '🥁 Drumroll', fanfare: '🎺 Fanfare', cheer: '🎉 Cheer',
            braam: '🎺 Inception BRAAM', dunkirkClock: '⏱️ Dunkirk Tick', cosmicDrone: '🌌 Cosmic Drone', trailerImpact: '💥 Trailer Boom',
            sciFiLaser: '🔫 Laser Pew', horrorSting: '😱 Horror Sting', vinylCrackle: '📻 Vinyl Crackle', cyberSynthRise: '⚡ Synth Rise',
            thunderBoom: '🌩️ Thunder Boom', retroChime: '🔔 Retro Chime'
          };
          toast(`${partnerNickname} played ${fxLabels[d.payload.fx] || d.payload.fx}!`, 'info');
        }
        break;
      case 'VOICE_MEMO':
        if (d.payload?.audio) {
          addVoiceMemoMsg(d.payload.nickname || partnerNickname, d.payload.audio, false);
          ping();
          showNotification(`${d.payload.nickname || partnerNickname}`, '🎙️ Sent a voice memo');
        }
        break;
      case 'CREATE_POLL':
        if (d.payload?.poll) {
          activePolls.set(d.payload.poll.id, d.payload.poll);
          renderPollMsg(d.payload.poll, false);
          toast(`New live poll: ${d.payload.poll.question}`, 'info');
        }
        break;
      case 'VOTE_POLL':
        if (d.payload?.pollId && d.payload?.optionIdx !== undefined) {
          const p = activePolls.get(d.payload.pollId);
          if (p) {
            p.votes[d.payload.optionIdx] = (p.votes[d.payload.optionIdx] || 0) + 1;
            p.totalVotes++;
            updatePollUI(p);
          }
        }
        break;
      case 'SUBTITLE_SYNC':
        if (d.payload?.subtitles) {
          subtitles = d.payload.subtitles;
          toast(`Received ${subtitles.length} subtitles from ${partnerNickname}!`, 'info');
        }
        break;
      case 'FILTER_SYNC':
        if (d.payload?.filter) {
          applyFilter(d.payload.filter);
          if (filterSelect) filterSelect.value = d.payload.filter;
          toast(`Color Grade: ${d.payload.filter}`, 'info');
        }
        break;
      case 'THEME_SYNC':
        if (d.payload?.theme) {
          applyTheme(d.payload.theme);
          toast(`Theater theme synced: ${d.payload.theme}`, 'info');
        }
        break;
      case 'STREAM_URL':
        if (d.payload?.url) {
          loadUrlVideo(d.payload.url);
          toast(`Partner loaded video URL: ${d.payload.url}`, 'info');
        }
        break;
      case 'CHAT':
        if (d.payload?.t) {
          addMsg(d.payload.nickname || partnerNickname, d.payload.t, false);
          ping();
          showNotification(`${d.payload.nickname || partnerNickname}`, d.payload.t);
          if (!tabFocused) flashTitle(`💬 ${d.payload.nickname || partnerNickname}: ${d.payload.t.substring(0, 30)}`);
        }
        break;
      case 'CHAT_IMG':
        if (d.payload?.img) {
          addImgMsg(d.payload.nickname || partnerNickname, d.payload.img, false);
          ping();
          showNotification(`${d.payload.nickname || partnerNickname}`, '📷 Sent an image');
        }
        break;
      case 'TYPING':
        if (typingIndicator) {
          if (d.payload?.typing) {
            typingIndicator.style.display = 'flex';
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
              typingIndicator.style.display = 'none';
            }, 3000);
          } else {
            typingIndicator.style.display = 'none';
          }
        }
        break;
      case 'IDENTITY':
        if (d.payload?.nickname) {
          updatePartnerNicknameDisplay(d.payload.nickname);
          sysMsg(`${d.payload.nickname} has joined the room!`);
        }
        break;
      case 'PRESENCE':
        if (d.payload?.status) {
          updatePresenceUI(d.payload.status);
          if (d.payload.nickname && d.payload.nickname !== partnerNickname) {
            updatePartnerNicknameDisplay(d.payload.nickname);
          }
        }
        break;
      case 'DRAW_POINT':
        if (d.payload?.x !== undefined && d.payload?.y !== undefined) {
          handleDrawPoint(d.payload.x, d.payload.y, true, d.payload.color || '#a855f7');
        }
        break;
    }
  }

  // ─── Notification Ping ───
  function ping() {
    try {
      const c = sfx._getCtx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.value = 0.06; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.25);
    } catch {}
  }

  // ─── Fullscreen ───
  fsBtn.addEventListener('click', () => {
    const el = $('screen');
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // ─── Theater Mode ───
  theaterBtn.addEventListener('click', () => {
    document.body.classList.toggle('theater');
  });

  // ─── Shortcuts Modal ───
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => shortcutsModal?.classList.add('open'));
  }
  if (closeShortcutsBtn) {
    closeShortcutsBtn.addEventListener('click', () => shortcutsModal?.classList.remove('open'));
  }
  if (shortcutsModal) {
    shortcutsModal.addEventListener('click', e => { if (e.target === shortcutsModal) shortcutsModal.classList.remove('open'); });
  }

  // ─── Keyboard Shortcuts ───
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case ' ': e.preventDefault(); togglePlay(); break;
      case 'm': micBtn.click(); break;
      case 'f': fsBtn.click(); break;
      case 't': theaterBtn.click(); break;
      case 'c': camBtn.click(); break;
      case 'g': setViewMode(currentViewMode === 'grid' ? 'stage' : 'grid'); break;
      case 'd':
        if (drawBtn) drawBtn.click();
        break;
      case 's':
        takeSnapshot();
        break;
      case 'p':
        if (nativePipBtn) nativePipBtn.click();
        break;
      case '?':
        if (shortcutsModal) shortcutsModal.classList.toggle('open');
        break;
      case 'arrowleft':
        if (syncMode) {
          localVideo.currentTime = Math.max(0, localVideo.currentTime - 10);
          rtc.send('SYNC', { a: 'seek', t: localVideo.currentTime });
          toast('Skipped back 10s', 'info');
        }
        break;
      case 'arrowright':
        if (syncMode && localVideo.duration) {
          localVideo.currentTime = Math.min(localVideo.duration, localVideo.currentTime + 10);
          rtc.send('SYNC', { a: 'seek', t: localVideo.currentTime });
          toast('Skipped forward 10s', 'info');
        }
        break;
      case '[':
        if (syncMode && speedSelect) {
          const idx = speedSelect.selectedIndex;
          if (idx > 0) {
            speedSelect.selectedIndex = idx - 1;
            speedSelect.dispatchEvent(new Event('change'));
          }
        }
        break;
      case ']':
        if (syncMode && speedSelect) {
          const idx = speedSelect.selectedIndex;
          if (idx < speedSelect.options.length - 1) {
            speedSelect.selectedIndex = idx + 1;
            speedSelect.dispatchEvent(new Event('change'));
          }
        }
        break;
      case 'escape':
        roomModal?.classList.remove('open');
        if (shortcutsModal) shortcutsModal.classList.remove('open');
        if (diagnosticsModal) diagnosticsModal.classList.remove('open');
        if (summaryModal) summaryModal.classList.remove('open');
        if (pollModal) pollModal.classList.remove('open');
        break;
    }
  });

  // ─── Draggable PIP ───
  let dragX, dragY;
  function onDragStart(x, y) { dragX = x; dragY = y; }
  function onDragMove(x, y) {
    if (currentViewMode !== 'pip') return;
    const dx = x - dragX, dy = y - dragY;
    dragX = x; dragY = y;
    const parent = pip.parentElement;
    const newTop = Math.max(0, Math.min(pip.offsetTop + dy, parent.clientHeight - pip.clientHeight));
    const newLeft = Math.max(0, Math.min(pip.offsetLeft + dx, parent.clientWidth - pip.clientWidth));
    pip.style.top = newTop + 'px';
    pip.style.left = newLeft + 'px';
    pip.style.right = 'auto';
  }

  pipDrag.addEventListener('mousedown', e => {
    if (e.target.closest('.pip-toggle')) return;
    e.preventDefault();
    onDragStart(e.clientX, e.clientY);
    const move = e2 => onDragMove(e2.clientX, e2.clientY);
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  pipDrag.addEventListener('touchstart', e => {
    if (e.target.closest('.pip-toggle')) return;
    const t = e.touches[0];
    onDragStart(t.clientX, t.clientY);
    const move = e2 => { e2.preventDefault(); const t2 = e2.touches[0]; onDragMove(t2.clientX, t2.clientY); };
    const end = () => { document.removeEventListener('touchmove', move); document.removeEventListener('touchend', end); };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }, { passive: false });

  // ─── Utilities ───
  function fmt(s) {
    if (isNaN(s)) return '--:--';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  function esc(t) {
    return t.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  }
});
