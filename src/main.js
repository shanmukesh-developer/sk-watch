import { RTC } from './webrtc.js';

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // ─── State ───
  let roomId = null;
  let camOn = false;
  let micOn = true;
  let syncMode = false;
  let sharing = false;
  let pipMini = false;

  // ─── DOM ───
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

  const screenVideo = $('screenVideo');
  const localVideo = $('localVideo');
  const welcome = $('welcome');
  const shareBtn = $('shareBtn');
  const fileIn = $('fileIn');

  const pip = $('pip');
  const pipDrag = $('pipDrag');
  const pipToggle = $('pipToggle');
  const pipVideoWrap = $('pipVideoWrap');
  const remoteCam = $('remoteCam');
  const localCam = $('localCam');
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

  // ─── Tabs ───
  document.querySelectorAll('.side-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.side-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.side-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(tab.dataset.panel).classList.add('active');
    });
  });

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
    },
    onDisconnect: () => {
      sysMsg('Partner disconnected.');
      toast('Partner left', 'warn');
    },
    onScreen: (stream) => {
      if (stream) {
        screenVideo.srcObject = stream;
        screenVideo.style.display = 'block';
        localVideo.style.display = 'none';
        welcome.style.display = 'none';
        toast('Receiving HD screen!', 'ok');
      } else {
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        if (!syncMode) welcome.style.display = 'flex';
      }
    },
    onCam: (stream) => {
      if (stream) { remoteCam.srcObject = stream; pipOff.style.display = 'none'; }
      else { remoteCam.srcObject = null; pipOff.style.display = 'flex'; }
    },
    onData: (d) => handleData(d)
  });

  const myId = 'sk-' + Math.floor(100000 + Math.random() * 900000);
  rtc.init(myId).then(id => {
    roomId = id;
    roomIdDisplay.textContent = id;
  }).catch(() => toast('Could not connect to signaling server', 'err'));

  // ─── Room Modal ───
  openRoomBtn.addEventListener('click', () => roomModal.classList.add('open'));
  closeModalBtn.addEventListener('click', () => roomModal.classList.remove('open'));
  roomModal.addEventListener('click', e => { if (e.target === roomModal) roomModal.classList.remove('open'); });

  createBtn.addEventListener('click', () => {
    roomPill.style.display = 'flex';
    roomModal.classList.remove('open');
    sysMsg(`✨ Room created: ${roomId}`);
    toast('Room created! Share ID with your partner.', 'ok');
  });

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
      welcome.style.display = 'flex';
      sharing = false;
      shareBtn.innerHTML = `<i data-lucide="monitor" style="width:18px;height:18px"></i> Share Screen`;
      shareBtn.classList.remove('btn-danger');
      lucide.createIcons();
      return;
    }
    try {
      const s = await rtc.shareScreen();
      screenVideo.srcObject = s;
      screenVideo.style.display = 'block';
      localVideo.style.display = 'none';
      welcome.style.display = 'none';
      syncMode = false;
      sharing = true;
      shareBtn.innerHTML = `<i data-lucide="monitor-off" style="width:18px;height:18px"></i> Stop Sharing`;
      shareBtn.classList.add('btn-danger');
      lucide.createIcons();
      sysMsg('🖥️ Sharing screen with HD audio!');
      toast('Screen sharing started!', 'ok');

      s.getVideoTracks()[0].onended = () => {
        sharing = false;
        screenVideo.srcObject = null;
        screenVideo.style.display = 'none';
        welcome.style.display = 'flex';
        shareBtn.innerHTML = `<i data-lucide="monitor" style="width:18px;height:18px"></i> Share Screen`;
        shareBtn.classList.remove('btn-danger');
        lucide.createIcons();
      };
    } catch (e) { /* cancelled */ }
  });

  // ─── Local Video Sync ───
  fileIn.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    localVideo.src = URL.createObjectURL(f);
    localVideo.style.display = 'block';
    screenVideo.style.display = 'none';
    welcome.style.display = 'none';
    syncMode = true;
    seekBar.disabled = false;
    sysMsg(`🎬 Loaded: ${f.name}`);
    toast(`Loaded ${f.name}`, 'ok');
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

  localVideo.addEventListener('play', () => { playPauseBtn.innerHTML = `<i data-lucide="pause" style="width:18px;height:18px"></i>`; lucide.createIcons(); });
  localVideo.addEventListener('pause', () => { playPauseBtn.innerHTML = `<i data-lucide="play" style="width:18px;height:18px"></i>`; lucide.createIcons(); });

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
  });

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
    lucide.createIcons();
  });

  // ─── Camera ───
  camBtn.addEventListener('click', async () => {
    if (!camOn) {
      try {
        const s = await rtc.startCam();
        localCam.srcObject = s;
        pipOff.style.display = 'none';
        camBtn.classList.add('active');
        camBtn.classList.remove('off');
        micBtn.classList.add('active');
        camOn = true;
        micOn = true;
        toast('Camera on', 'ok');
      } catch { toast('Camera access denied', 'err'); }
    } else {
      rtc.stopCam();
      localCam.srcObject = null;
      camBtn.classList.remove('active');
      camBtn.classList.add('off');
      micBtn.classList.remove('active');
      camOn = false;
      micOn = false;
    }
  });

  // ─── Mic ───
  micBtn.addEventListener('click', () => {
    if (!rtc.camStream) return toast('Turn on camera first', 'warn');
    const tk = rtc.camStream.getAudioTracks()[0];
    if (!tk) return;
    tk.enabled = !tk.enabled;
    micOn = tk.enabled;
    micBtn.classList.toggle('active', micOn);
    micBtn.classList.toggle('off', !micOn);
    micBtn.innerHTML = micOn ? `<i data-lucide="mic" style="width:16px;height:16px"></i>` : `<i data-lucide="mic-off" style="width:16px;height:16px"></i>`;
    lucide.createIcons();
  });

  // ─── PIP toggle ───
  pipToggle.addEventListener('click', e => {
    e.stopPropagation();
    pipMini = !pipMini;
    pip.classList.toggle('mini', pipMini);
    pipVideoWrap.style.display = pipMini ? 'none' : 'block';
    pipToggle.innerHTML = pipMini ? `<i data-lucide="plus" style="width:12px;height:12px"></i>` : `<i data-lucide="minus" style="width:12px;height:12px"></i>`;
    lucide.createIcons();
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

  // ─── VU Meter ───
  function tickMeter() {
    if (camOn && micOn) {
      const lv = rtc.dsp.getLevel();
      meterFill.style.width = lv + '%';
      pipRing.classList.toggle('speaking', lv > 12);
    } else {
      meterFill.style.width = '0%';
      pipRing.classList.remove('speaking');
    }
    requestAnimationFrame(tickMeter);
  }
  requestAnimationFrame(tickMeter);

  // ─── Emojis ───
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.addEventListener('click', () => {
      const e = b.dataset.e;
      spawnEmoji(e, 'You');
      rtc.send('EMOJI', { e });
      b.classList.add('pop');
      setTimeout(() => b.classList.remove('pop'), 350);
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
    switch (d.type) {
      case 'SYNC':
        if (syncMode) {
          if (d.payload.a === 'play') { localVideo.currentTime = d.payload.t; localVideo.play(); }
          else if (d.payload.a === 'pause') { localVideo.currentTime = d.payload.t; localVideo.pause(); }
          else if (d.payload.a === 'seek') { localVideo.currentTime = d.payload.t; }
        }
        break;
      case 'EMOJI': spawnEmoji(d.payload.e, 'Partner'); break;
      case 'CHAT':
        addMsg('Partner', d.payload.t, false);
        ping();
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
      case 'escape': roomModal.classList.remove('open'); break;
    }
  });

  // ─── Draggable PIP (mouse + touch) ───
  let dragX, dragY;
  function onDragStart(x, y) { dragX = x; dragY = y; }
  function onDragMove(x, y) {
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
