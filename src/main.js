import { RTC } from './webrtc.js';
import { SoundFXEngine } from './soundboard.js';

document.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();

  const sfx = new SoundFXEngine();

  // ─── Authentic Marvel Studios Stencil Letter-Mask Engine ───
  const marvelIntro = document.getElementById('marvelIntro');
  const enterTheaterBtn = document.getElementById('enterTheaterBtn');
  const maskedTextCanvas = document.getElementById('maskedTextCanvas');

  if (maskedTextCanvas) {
    const maskedCtx = maskedTextCanvas.getContext('2d');

    // Create offscreen flipbook canvas
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

      // 1. Render vibrant high-contrast comic panels onto flipCanvas
      flipCtx.clearRect(0, 0, w, h);
      const theme = panelThemes[frameIndex % panelThemes.length];

      // Base background
      flipCtx.fillStyle = theme[3];
      flipCtx.fillRect(0, 0, w, h);

      // Bright comic action splotches & slashes
      const bandOffset = (frameIndex * 40) % w;
      flipCtx.fillStyle = theme[0];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset - 200, 0);
      flipCtx.lineTo(bandOffset + 220, 0);
      flipCtx.lineTo(bandOffset + 80, h);
      flipCtx.lineTo(bandOffset - 340, h);
      flipCtx.closePath();
      flipCtx.fill();

      // Golden highlight band
      flipCtx.fillStyle = theme[2];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset + 350, 0);
      flipCtx.lineTo(bandOffset + 550, 0);
      flipCtx.lineTo(bandOffset + 410, h);
      flipCtx.lineTo(bandOffset + 210, h);
      flipCtx.closePath();
      flipCtx.fill();

      // Crimson action block
      flipCtx.fillStyle = theme[1];
      flipCtx.beginPath();
      flipCtx.moveTo(bandOffset - 500, 0);
      flipCtx.lineTo(bandOffset - 320, 0);
      flipCtx.lineTo(bandOffset - 420, h);
      flipCtx.lineTo(bandOffset - 600, h);
      flipCtx.closePath();
      flipCtx.fill();

      // Comic halftone dots grid
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

      // Dynamic action speed lines
      flipCtx.strokeStyle = '#ffffff';
      flipCtx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const lx = Math.random() * w;
        flipCtx.beginPath();
        flipCtx.moveTo(lx, 0);
        flipCtx.lineTo(lx + (Math.random() - 0.5) * 200, h);
        flipCtx.stroke();
      }

      // 2. Render onto maskedTextCanvas with 'destination-in' text stencil
      maskedCtx.save();
      maskedCtx.clearRect(0, 0, w, h);

      // Copy flipping comic frame onto target canvas
      maskedCtx.drawImage(flipCanvas, 0, 0);

      // Stencil mask: Keep comic frame ONLY inside the letters of SHANMUKH & KAVYA!
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
        setTimeout(() => requestAnimationFrame(renderMarvelStencilFrame), 42); // 24fps
      }
    }
    renderMarvelStencilFrame();
  }

  // Marvel Studio Fanfare & Drumbeat
  if (enterTheaterBtn && marvelIntro) {
    enterTheaterBtn.addEventListener('click', () => {
      marvelIntro.classList.add('zoom-in');
      playMarvelFanfare();
      setTimeout(() => {
        marvelIntro.classList.add('hidden');
        setTimeout(() => marvelIntro.remove(), 850);
      }, 900);
    });
  }

  function playMarvelFanfare() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      
      // Rhythmic Marvel Drumbeat: BUM... BUM... BUM-BUM-BUM!
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

      // Brass Horn Heroic Fanfare Sweep
      const brassNotes = [
        { f: 293.66, t: 0.8, d: 0.2 },   // D4
        { f: 440.00, t: 1.0, d: 0.2 },   // A4
        { f: 587.33, t: 1.2, d: 0.8 }    // D5 Grand Finish
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

  // ─── Auto-Ping Keep Alive (Client-side ping every 13 minutes) ───
  setInterval(() => {
    fetch('/ping').catch(() => {});
  }, 13 * 60 * 1000);

  // ─── DOM Elements ───
  const $ = id => document.getElementById(id);

  const statusDot = $('statusDot');
  const statusText = $('statusText');
  const roomPill = $('roomPill');
  const roomIdDisplay = $('roomIdDisplay');
  const copyIdBtn = $('copyIdBtn');

  const openRoomBtn = $('openRoomBtn');
  const roomModal = $('roomModal');
  const closeModalBtn = $('closeModalBtn');
  const createBtn = $('createBtn');
  const joinInput = $('joinInput');
  const joinBtn = $('joinBtn');
  const theaterBtn = $('theaterBtn');

  const viewGridBtn = $('viewGridBtn');
  const viewStageBtn = $('viewStageBtn');
  const viewPipBtn = $('viewPipBtn');
  const screenEl = $('screen');
  const cardMainStream = $('cardMainStream');
  const mainStreamLabel = $('mainStreamLabel');

  const screenVideo = $('screenVideo');
  const localVideo = $('localVideo');
  const welcome = $('welcome');
  const shareBtn = $('shareBtn');
  const fileIn = $('fileIn');

  const cardLocal = $('cardLocal');
  const localCam = $('localCam');
  const localAvatar = $('localAvatar');
  const localHalo = $('localHalo');
  const localMicBadge = $('localMicBadge');

  const cardRemote = $('cardRemote');
  const remoteCam = $('remoteCam');
  const remoteAvatar = $('remoteAvatar');
  const remoteHalo = $('remoteHalo');
  const remoteMicBadge = $('remoteMicBadge');

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

  const chatLog = $('chatLog');
  const chatForm = $('chatForm');
  const chatIn = $('chatIn');
  const emojiLayer = $('emojiLayer');

  const noiseCheck = $('noiseCheck');
  const gateSlider = $('gateSlider');
  const gateVal = $('gateVal');
  const gainSlider = $('gainSlider');
  const gainVal = $('gainVal');
  const meterFill = $('meterFill');

  // ─── Toast ───
  function toast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    $('toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3000);
  }

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
      toast('Zoom Grid View active', 'info');
    } else if (mode === 'stage') {
      screenEl.classList.add('zoom-stage-view');
      viewStageBtn?.classList.add('active');
      pip.style.display = 'none';
      toast('Spotlight Stage View active', 'info');
    } else if (mode === 'pip') {
      screenEl.classList.add('zoom-pip-view');
      viewPipBtn?.classList.add('active');
      pip.style.display = 'flex';
      toast('Picture-in-Picture mode active', 'info');
    }
  }

  viewGridBtn?.addEventListener('click', () => setViewMode('grid'));
  viewStageBtn?.addEventListener('click', () => setViewMode('stage'));
  viewPipBtn?.addEventListener('click', () => setViewMode('pip'));

  // ─── Participant Cards & Avatar Fallback Manager ───
  function updateParticipantCards() {
    const hasLocalCam = localCam.srcObject && localCam.srcObject.getVideoTracks().some(t => t.readyState === 'live');
    const hasRemoteCam = remoteCam.srcObject && remoteCam.srcObject.getVideoTracks().some(t => t.readyState === 'live');

    // Local Camera Tile
    if (hasLocalCam && camOn) {
      localCam.style.display = 'block';
      localAvatar.style.display = 'none';
    } else {
      localCam.style.display = 'none';
      localAvatar.style.display = 'flex';
    }
    localMicBadge.innerHTML = micOn ? `<i data-lucide="mic" style="width:13px;height:13px"></i>` : `<i data-lucide="mic-off" style="width:13px;height:13px"></i>`;
    localMicBadge.className = `mic-status ${micOn ? '' : 'off'}`;

    // Remote Camera Tile
    if (hasRemoteCam) {
      remoteCam.style.display = 'block';
      remoteAvatar.style.display = 'none';
      pipOff.style.display = 'none';
    } else {
      remoteCam.style.display = 'none';
      remoteAvatar.style.display = 'flex';
      pipOff.style.display = 'flex';
    }

    // Sync to PIP video streams if in PIP mode
    if (pipRemoteCam && pipRemoteCam.srcObject !== remoteCam.srcObject) {
      pipRemoteCam.srcObject = remoteCam.srcObject;
    }
    if (pipLocalCam && pipLocalCam.srcObject !== localCam.srcObject) {
      pipLocalCam.srcObject = localCam.srcObject;
    }

    if (window.lucide) lucide.createIcons();
  }

  // ─── Tabs ───
  document.querySelectorAll('.side-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.side-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(tab.dataset.panel).classList.add('active');
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
    onStatus: (s) => {
      statusDot.className = 'dot' + (s === 'connected' || s === 'ready' ? ' on' : '');
      const labels = { ready: 'Ready', connecting: 'Connecting...', connected: 'Connected', disconnected: 'Offline', error: 'Error' };
      statusText.textContent = labels[s] || s;
    },
    onConnect: (pid) => {
      sysMsg('🎉 Partner connected!');
      toast('Partner joined!', 'ok');
      if (syncMode && localVideo && !localVideo.paused) {
        rtc.send('SYNC', { a: 'play', t: localVideo.currentTime });
      }
    },
    onDisconnect: () => {
      sysMsg('Partner disconnected.');
      toast('Partner left', 'warn');
      updateParticipantCards();
    },
    onScreen: (stream) => {
      if (stream) {
        screenVideo.srcObject = stream;
        screenVideo.muted = false;
        screenVideo.volume = volSlider ? volSlider.value / 100 : 1;
        screenVideo.style.display = 'block';
        localVideo.style.display = 'none';
        cardMainStream.style.display = 'flex';
        welcome.style.display = 'none';
        setViewMode('stage'); // Switch to Spotlight view when receiving screen share
        screenVideo.play().catch(err => {
          console.log('Auto-play blocked, tap banner to enable', err);
          if (tapUnmute) tapUnmute.style.display = 'flex';
        });
        toast('Receiving HD screen & audio!', 'ok');
      } else {
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        cardMainStream.style.display = 'none';
        if (!syncMode) {
          welcome.style.display = 'flex';
          setViewMode('grid');
        }
      }
    },
    onCam: (stream) => {
      if (stream) {
        remoteCam.srcObject = stream;
        remoteCam.muted = false;
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
    onData: (d) => handleData(d)
  });

  const createdRoomCard = $('createdRoomCard');
  const modalRoomId = $('modalRoomId');
  const modalCopyBtn = $('modalCopyBtn');
  const modalShareBtn = $('modalShareBtn');

  const myId = 'sk-' + Math.floor(100000 + Math.random() * 900000);
  rtc.init(myId).then(id => {
    roomId = id;
    roomIdDisplay.textContent = id;
    if (modalRoomId) modalRoomId.textContent = id;

    // Check URL parameters for direct room auto-join link (e.g. ?room=sk-123456)
    const urlParams = new URLSearchParams(window.location.search);
    const joinRoomParam = urlParams.get('room') || urlParams.get('join');
    if (joinRoomParam && joinRoomParam !== id) {
      joinInput.value = joinRoomParam;
      doJoin();
    }
  }).catch(() => toast('Could not connect to signaling server', 'err'));

  // ─── Room Modal ───
  openRoomBtn.addEventListener('click', () => roomModal.classList.add('open'));
  closeModalBtn.addEventListener('click', () => roomModal.classList.remove('open'));
  roomModal.addEventListener('click', e => { if (e.target === roomModal) roomModal.classList.remove('open'); });

  createBtn.addEventListener('click', () => {
    roomPill.style.display = 'flex';
    if (createdRoomCard) createdRoomCard.style.display = 'block';
    if (modalRoomId) modalRoomId.textContent = roomId;
    sysMsg(`✨ Room created! Your Room ID is: ${roomId}`);
    toast(`Room created: ${roomId}`, 'ok');
  });

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(roomId).then(() => toast('Room ID copied to clipboard!', 'ok'));
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
    rtc.connect(tid);
    roomPill.style.display = 'flex';
    roomIdDisplay.textContent = tid;
    roomModal.classList.remove('open');
    sysMsg(`Connecting to ${tid}...`);
  }

  copyIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId).then(() => toast('Room ID copied!', 'ok'));
  });

  // ─── Screen Share ───
  shareBtn.addEventListener('click', async () => {
    if (sharing) {
      rtc.stopScreen();
      screenVideo.srcObject = null;
      screenVideo.style.display = 'none';
      cardMainStream.style.display = 'none';
      welcome.style.display = 'flex';
      sharing = false;
      shareBtn.innerHTML = `<i data-lucide="monitor" style="width:18px;height:18px"></i> Share Screen`;
      shareBtn.classList.remove('btn-danger');
      if (window.lucide) lucide.createIcons();
      setViewMode('grid');
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
      sysMsg('🖥️ Sharing screen with HD audio!');
      toast('Screen sharing started!', 'ok');

      s.getVideoTracks()[0].onended = () => {
        sharing = false;
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        cardMainStream.style.display = 'none';
        welcome.style.display = 'flex';
        shareBtn.innerHTML = `<i data-lucide="monitor" style="width:18px;height:18px"></i> Share Screen`;
        shareBtn.classList.remove('btn-danger');
        if (window.lucide) lucide.createIcons();
        setViewMode('grid');
      };
    } catch (e) { /* cancelled */ }
  });

  // ─── Local Video Sync & Replay Stream Fix ───
  function attachAndStreamLocalVideo() {
    if (!localVideo || !syncMode) return;
    const fileStream = localVideo.captureStream ? localVideo.captureStream() : (localVideo.mozCaptureStream ? localVideo.mozCaptureStream() : null);
    if (fileStream) {
      rtc.rebindCustomStream(fileStream);
    }
  }

  fileIn.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const objectUrl = URL.createObjectURL(f);
    localVideo.src = objectUrl;
    localVideo.muted = false;
    localVideo.volume = volSlider ? volSlider.value / 100 : 1;
    localVideo.style.display = 'block';
    screenVideo.style.display = 'none';
    cardMainStream.style.display = 'flex';
    mainStreamLabel.innerHTML = `<i data-lucide="file-video" style="width:13px;height:13px"></i> ${f.name}`;
    welcome.style.display = 'none';
    syncMode = true;
    seekBar.disabled = false;
    setViewMode('stage');

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
  });

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

  localVideo.addEventListener('ended', () => {
    playPauseBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px"></i>`;
    if (window.lucide) lucide.createIcons();
    if (syncMode) rtc.send('SYNC', { a: 'pause', t: localVideo.duration || 0 });
  });

  localVideo.addEventListener('timeupdate', () => {
    if (!syncMode) return;
    const c = localVideo.currentTime, d = localVideo.duration || 1;
    seekBar.value = Math.round((c / d) * 1000);
    timeLabel.textContent = `${fmt(c)} / ${fmt(d)}`;
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
      rtc.send('SYNC', { a: 'play', t: localVideo.currentTime });
    } else {
      localVideo.pause();
      rtc.send('SYNC', { a: 'pause', t: localVideo.currentTime });
    }
  }

  // ─── Volume ───
  volSlider.addEventListener('input', e => {
    const v = e.target.value / 100;
    screenVideo.volume = v;
    localVideo.volume = v;
  });

  volBtn.addEventListener('click', () => {
    const m = !screenVideo.muted;
    screenVideo.muted = m;
    localVideo.muted = m;
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
  micBtn.addEventListener('click', () => {
    if (!rtc.rawCamStream) return toast('Turn on camera first', 'warn');
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

  // ─── PIP toggle ───
  pipToggle.addEventListener('click', e => {
    e.stopPropagation();
    pipMini = !pipMini;
    pip.classList.toggle('mini', pipMini);
    pipVideoWrap.style.display = pipMini ? 'none' : 'block';
    pipToggle.innerHTML = pipMini ? `<i data-lucide="plus" style="width:12px;height:12px"></i>` : `<i data-lucide="minus" style="width:12px;height:12px"></i>`;
    if (window.lucide) lucide.createIcons();
  });

  // ─── Noise Filter Controls ───
  noiseCheck.addEventListener('change', e => {
    rtc.dsp.toggle(e.target.checked);
    noiseBtn.classList.toggle('active', e.target.checked);
    noiseBtn.classList.toggle('off', !e.target.checked);
  });
  noiseBtn.addEventListener('click', () => {
    noiseCheck.checked = !noiseCheck.checked;
    noiseCheck.dispatchEvent(new Event('change'));
  });
  gateSlider.addEventListener('input', e => {
    gateVal.textContent = `${e.target.value} dB`;
    rtc.dsp.setThreshold(+e.target.value);
  });
  gainSlider.addEventListener('input', e => {
    const v = e.target.value / 10;
    gainVal.textContent = `${v.toFixed(1)}x`;
    rtc.dsp.setGain(v);
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

  // Initial call to set participant cards
  updateParticipantCards();

  // ─── Emojis & Soundboard FX ───
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.addEventListener('click', () => {
      const e = b.dataset.e;
      spawnEmoji(e, 'You');
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

  // ─── Chat ───
  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const t = chatIn.value.trim();
    if (!t) return;
    addMsg('You', t, true);
    rtc.send('CHAT', { t });
    chatIn.value = '';
  });

  function addMsg(who, text, me = false) {
    const d = document.createElement('div');
    d.className = `chat-msg ${me ? 'me' : 'them'}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    d.innerHTML = `<div class="chat-who">${esc(who)} <span class="chat-t">${time}</span></div>${esc(text)}`;
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
        if (syncMode && d.payload) {
          if (d.payload.a === 'play') { localVideo.currentTime = d.payload.t; localVideo.play().catch(()=>{}); }
          else if (d.payload.a === 'pause') { localVideo.currentTime = d.payload.t; localVideo.pause(); }
          else if (d.payload.a === 'seek') { localVideo.currentTime = d.payload.t; }
        }
        break;
      case 'EMOJI':
        if (d.payload?.e) spawnEmoji(d.payload.e, 'Partner');
        break;
      case 'SOUND_FX':
        if (d.payload?.fx) {
          sfx.play(d.payload.fx);
          const fxLabels = { popcorn: '🍿 Popcorn', applause: '👏 Applause', drumroll: '🥁 Drumroll', fanfare: '🎺 Fanfare', cheer: '🎉 Cheer' };
          toast(`Partner played ${fxLabels[d.payload.fx] || d.payload.fx}!`, 'info');
        }
        break;
      case 'CHAT':
        if (d.payload?.t) {
          addMsg('Partner', d.payload.t, false);
          ping();
        }
        break;
    }
  }

  // ─── Notification Ping ───
  function ping() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
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
      case 'escape': roomModal.classList.remove('open'); break;
    }
  });

  // ─── Draggable PIP (mouse + touch) ───
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
  }, { passive: true });

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
