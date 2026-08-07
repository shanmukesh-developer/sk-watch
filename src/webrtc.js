import Peer from 'peerjs';
import { io } from 'socket.io-client';
import { AudioDSP } from './audio-processor.js';

export class RTC {
  constructor(cb = {}) {
    this.peer = null;
    this.id = null;
    this.conn = null;
    this.rawCamStream = null;
    this.camStream = null;
    this.screenStream = null;
    this.dsp = new AudioDSP();

    // Socket.IO relay (primary data channel — works across ALL networks)
    this.socket = null;
    this._socketConnected = false;
    this._socketRoomJoined = false;

    // Partner tracking
    this._partnerPeerId = null;   // Partner's PeerJS ID (for media calls)
    this._connected = false;       // Whether we have an active partner connection

    // Reconnection state
    this._targetPeerId = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectTimer = null;
    this._heartbeatInterval = null;
    this._heartbeatMissed = 0;
    this._maxMissedHeartbeats = 3;
    this._lastHeartbeat = 0;
    this._isReconnecting = false;
    this._initOpts = null;
    this._customId = null;
    this._destroyed = false;

    // Multi-peer mesh connections
    this.conns = new Map();

    // Connection stats
    this._statsInterval = null;
    this._latestStats = { rtt: 0, bitrate: 0, packetLoss: 0, resolution: '', fps: 0 };

    // Deduplication for messages received via both Socket.IO and WebRTC
    this._recentMsgIds = new Set();

    this.cb = {
      onStatus: cb.onStatus || (() => {}),
      onConnect: cb.onConnect || (() => {}),
      onDisconnect: cb.onDisconnect || (() => {}),
      onScreen: cb.onScreen || (() => {}),
      onCam: cb.onCam || (() => {}),
      onData: cb.onData || (() => {}),
      onReconnecting: cb.onReconnecting || (() => {}),
      onStats: cb.onStats || (() => {})
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  SOCKET.IO — Primary Data Relay (guaranteed cross-network)
  // ═══════════════════════════════════════════════════════════════

  _initSocketIO() {
    if (this.socket) return;

    const socketUrl = window.location.origin;
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000
    });

    this.socket.on('connect', () => {
      console.log('[Socket.IO] Connected to relay server:', this.socket.id);
      this._socketConnected = true;

      // Re-join room if we had one (reconnection scenario)
      if (this.id && !this._socketRoomJoined) {
        this._joinSocketRoom(this.id);
      }
      // If we were trying to connect to a target, re-join that room
      if (this._targetPeerId && this._targetPeerId !== this.id) {
        this._joinSocketRoom(this._targetPeerId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO] Disconnected:', reason);
      this._socketConnected = false;
      this._socketRoomJoined = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
    });

    // ─── Receive relayed data messages ───
    this.socket.on('room-data', (data) => {
      if (!data || typeof data !== 'object') return;

      // Deduplicate
      if (data._msgId && this._recentMsgIds.has(data._msgId)) return;
      if (data._msgId) {
        this._recentMsgIds.add(data._msgId);
        setTimeout(() => this._recentMsgIds.delete(data._msgId), 5000);
      }

      // Internal heartbeat
      if (data.type === '__HEARTBEAT__' || data.type === '__HEARTBEAT_ACK__') {
        this._onHeartbeatReceived();
        return;
      }

      this.cb.onData(data);
    });

    // ─── Partner joined our room ───
    this.socket.on('peer-joined', (info) => {
      console.log('[Socket.IO] Peer joined:', info.nickname || info.socketId, '(PeerJS:', info.peerId, ')');

      // Store partner's PeerJS ID for media calls
      if (info.peerId) {
        this._partnerPeerId = info.peerId;
      }

      // Fire onConnect only once
      if (!this._connected) {
        this._connected = true;
        this._reconnectAttempts = 0;
        this._isReconnecting = false;
        this.cb.onConnect(info.peerId || info.socketId);
        this.cb.onStatus('connected');
        this._startHeartbeat();
      }

      // Attempt WebRTC P2P for media streams using partner's PeerJS ID
      if (info.peerId && this.peer && this.peer.open) {
        setTimeout(() => this._attemptWebRTCMedia(info.peerId), 500);
      }
    });

    // ─── Partner left our room ───
    this.socket.on('peer-left', (info) => {
      console.log('[Socket.IO] Peer left:', info.socketId);
      this._connected = false;
      this._partnerPeerId = null;
      this._stopHeartbeat();
      this._stopStatsMonitor();
      this.cb.onDisconnect();
      this.cb.onStatus('disconnected');
    });

    // ─── Room join confirmation ───
    this.socket.on('room-joined', (info) => {
      console.log('[Socket.IO] Joined room:', info.roomId, '| Members:', info.memberCount, '| Existing:', info.existingMembers?.length || 0);
      this._socketRoomJoined = true;

      // If there are existing members, we're the joiner — connect to them
      if (info.existingMembers && info.existingMembers.length > 0) {
        const partner = info.existingMembers[0]; // First existing member is the host
        if (partner.peerId) {
          this._partnerPeerId = partner.peerId;
        }

        if (!this._connected) {
          this._connected = true;
          this._reconnectAttempts = 0;
          this._isReconnecting = false;
          this.cb.onConnect(partner.peerId || partner.socketId);
          this.cb.onStatus('connected');
          this._startHeartbeat();
        }

        // Attempt WebRTC P2P for media using partner's PeerJS ID
        if (partner.peerId && this.peer && this.peer.open) {
          setTimeout(() => this._attemptWebRTCMedia(partner.peerId), 500);
        }
      }
    });
  }

  _joinSocketRoom(roomId) {
    if (!this.socket || !this._socketConnected) return;
    this.socket.emit('join-room', {
      roomId,
      peerId: this.id || this._customId || '',
      nickname: ''
    });
    console.log('[Socket.IO] Joining room:', roomId, 'with PeerJS ID:', this.id || this._customId);
  }

  // Attempt WebRTC P2P connection for media streams (screen share, camera)
  _attemptWebRTCMedia(partnerPeerId) {
    if (!this.peer || !this.peer.open || this.peer.destroyed) return;
    if (!partnerPeerId || partnerPeerId === this.id) return;

    try {
      console.log('[RTC] Attempting WebRTC P2P to:', partnerPeerId);
      const c = this.peer.connect(partnerPeerId, { reliable: true, serialization: 'json' });
      this._handleConn(c, partnerPeerId);
    } catch (e) {
      console.warn('[RTC] WebRTC P2P attempt failed:', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  PEERJS — Signaling + WebRTC Media Streams
  // ═══════════════════════════════════════════════════════════════

  init(customId) {
    this._customId = customId;

    // Initialize Socket.IO first
    this._initSocketIO();

    return new Promise((resolve, reject) => {
      const isHttps = window.location.protocol === 'https:';
      const host = window.location.hostname || 'localhost';
      const portStr = window.location.port;

      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        // TURN relay for media across different networks
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelay', credential: 'openrelay' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelay', credential: 'openrelay' }
      ];

      const selfHostedOpts = {
        host, path: '/peerjs', secure: isHttps, debug: 0,
        pingInterval: 5000,
        config: { iceServers, iceTransportPolicy: 'all' }
      };
      if (portStr && portStr !== '80' && portStr !== '443') {
        selfHostedOpts.port = parseInt(portStr, 10);
      }

      const cloudOpts = {
        host: '0.peerjs.com', port: 443, path: '/', secure: true, debug: 0,
        pingInterval: 5000,
        config: { iceServers, iceTransportPolicy: 'all' }
      };

      const attempts = [
        { opts: selfHostedOpts, id: customId, name: 'Self-Hosted' },
        { opts: cloudOpts, id: customId, name: 'PeerJS Cloud' }
      ];

      let currentAttemptIndex = 0;
      let resolved = false;

      const doResolve = (id) => {
        if (resolved) return;
        resolved = true;
        this.id = id;
        this._destroyed = false;

        // Join Socket.IO room with our PeerJS ID
        if (this._socketConnected) {
          this._joinSocketRoom(id);
        } else if (this.socket) {
          this.socket.once('connect', () => this._joinSocketRoom(id));
        }

        this.cb.onStatus('ready', id);
        resolve(id);
      };

      const tryNextAttempt = () => {
        if (resolved) return;
        if (currentAttemptIndex >= attempts.length) {
          // PeerJS failed, but Socket.IO relay still works for data
          console.warn('[RTC] All PeerJS servers failed — using Socket.IO relay only (no media streams)');
          doResolve(customId);
          return;
        }

        const config = attempts[currentAttemptIndex];
        currentAttemptIndex++;
        console.log(`[RTC Signaling] Attempt ${currentAttemptIndex}/${attempts.length}: ${config.name}...`);

        try {
          if (this.peer && !this.peer.destroyed) {
            try { this.peer.destroy(); } catch (e) {}
          }

          this.peer = config.id ? new Peer(config.id, config.opts) : new Peer(config.opts);
          this._initOpts = config;

          // Timeout per attempt
          const sigTimeout = setTimeout(() => {
            if (!resolved) {
              console.warn(`[RTC] ${config.name} timed out`);
              tryNextAttempt();
            }
          }, 8000);

          this.peer.on('open', id => {
            clearTimeout(sigTimeout);
            console.log(`[RTC Signaling] Connected via ${config.name}! ID: ${id}`);
            doResolve(id);
          });

          this.peer.on('connection', c => this._handleConn(c));
          this.peer.on('call', c => this._handleCall(c));

          this.peer.on('error', e => {
            console.warn(`[RTC ${config.name} Error]`, e.type, e.message);
            if (e.type === 'peer-unavailable') {
              // Not critical — Socket.IO handles data connectivity
              return;
            }
            if (e.type === 'unavailable-id') {
              config.id = null;
              if (!resolved) { clearTimeout(sigTimeout); setTimeout(tryNextAttempt, 500); }
              return;
            }
            if (!resolved) { clearTimeout(sigTimeout); setTimeout(tryNextAttempt, 1500); }
          });

          this.peer.on('disconnected', () => {
            if (this.peer && !this.peer.destroyed) {
              try { this.peer.reconnect(); } catch (err) {}
            }
          });
        } catch (err) {
          console.warn(`[RTC ${attempts[currentAttemptIndex - 1]?.name} Exception]`, err);
          setTimeout(tryNextAttempt, 1500);
        }
      };

      tryNextAttempt();
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONNECT — Join a partner's room
  // ═══════════════════════════════════════════════════════════════

  connect(targetId) {
    if (!targetId) return;
    this._targetPeerId = targetId;
    this._connected = false;
    this._partnerPeerId = null;
    this._reconnectAttempts = 0;

    console.log(`[RTC] Connecting to room: ${targetId}`);
    this.cb.onStatus('connecting');

    // PRIMARY: Join room via Socket.IO (guaranteed to work)
    if (this.socket && this._socketConnected) {
      this._joinSocketRoom(targetId);
    } else if (this.socket) {
      this.socket.once('connect', () => this._joinSocketRoom(targetId));
    }

    // SECONDARY: Also try PeerJS WebRTC data connection
    if (this.peer && !this.peer.destroyed && this.peer.open) {
      this._attemptWebRTCMedia(targetId);
    } else if (this.peer && !this.peer.destroyed) {
      this.peer.once('open', () => this._attemptWebRTCMedia(targetId));
    }

    // Safety timeout: if nothing connected in 12 seconds, show status
    setTimeout(() => {
      if (!this._connected) {
        console.warn('[RTC] Connection attempt timed out after 12s');
        this.cb.onStatus('error', `Could not reach room ${targetId}. Host may be offline.`);
      }
    }, 12000);
  }

  // ═══════════════════════════════════════════════════════════════
  //  RECONNECTION
  // ═══════════════════════════════════════════════════════════════

  async _reinitAndConnect(targetId) {
    try {
      this.cb.onStatus('connecting');
      this.cb.onReconnecting(this._reconnectAttempts + 1, this._maxReconnectAttempts);
      await this.init(this._customId);
      this.connect(targetId);
    } catch (err) {
      console.error('[RTC Reinit Error]', err);
    }
  }

  _scheduleReconnect() {
    if (this._isReconnecting || this._destroyed) return;
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this.cb.onStatus('error', 'Connection lost. Please refresh.');
      return;
    }
    this._isReconnecting = true;
    this._reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(2, this._reconnectAttempts - 1), 16000);
    this.cb.onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);

    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._isReconnecting = false;
      if (this._targetPeerId) {
        this.connect(this._targetPeerId);
      }
    }, delay);
  }

  // ═══════════════════════════════════════════════════════════════
  //  HEARTBEAT
  // ═══════════════════════════════════════════════════════════════

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatMissed = 0;
    this._lastHeartbeat = Date.now();

    this._heartbeatInterval = setInterval(() => {
      this.send('__HEARTBEAT__', { ts: Date.now() });
      this._heartbeatMissed++;

      if (this._heartbeatMissed >= this._maxMissedHeartbeats) {
        console.warn('[RTC] Partner unresponsive');
        this._stopHeartbeat();
      }
    }, 5000);
  }

  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  _onHeartbeatReceived() {
    this._heartbeatMissed = 0;
    this._lastHeartbeat = Date.now();
    this._reconnectAttempts = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  //  WEBRTC DATA CONNECTION (bonus P2P — not required for data)
  // ═══════════════════════════════════════════════════════════════

  _handleConn(c, targetId) {
    this.conn = c;
    if (targetId) this._partnerPeerId = targetId;

    const connTimeout = setTimeout(() => {
      if (c && !c.open) {
        console.warn('[RTC P2P] Data channel timed out (Socket.IO relay still active)');
        try { c.close(); } catch (e) {}
      }
    }, 15000);

    c.on('open', () => {
      clearTimeout(connTimeout);
      this.conns.set(c.peer, c);
      this._partnerPeerId = c.peer;
      console.log('[RTC P2P] WebRTC data channel open:', c.peer);

      // If Socket.IO hasn't connected yet, fire onConnect from here
      if (!this._connected) {
        this._connected = true;
        this._reconnectAttempts = 0;
        this._isReconnecting = false;
        this.cb.onConnect(c.peer);
        this.cb.onStatus('connected');
      }

      this._startHeartbeat();
      this._startStatsMonitor();

      // Send active media streams to partner
      if (this.screenStream) this._call(c.peer, this.screenStream, 'screen');
      if (this.camStream || this.rawCamStream) this._call(c.peer, this.camStream || this.rawCamStream, 'cam');
    });

    c.on('data', d => {
      if (d && d.type === '__HEARTBEAT__') {
        this._onHeartbeatReceived();
        if (c.open) try { c.send({ type: '__HEARTBEAT_ACK__', payload: { ts: Date.now() }, ts: Date.now() }); } catch (e) {}
        return;
      }
      if (d && d.type === '__HEARTBEAT_ACK__') {
        this._onHeartbeatReceived();
        if (d.payload?.ts) this._latestStats.rtt = Date.now() - (d.ts || d.payload.ts);
        return;
      }
      // Deduplicate
      if (d && d._msgId && this._recentMsgIds.has(d._msgId)) return;
      if (d && d._msgId) {
        this._recentMsgIds.add(d._msgId);
        setTimeout(() => this._recentMsgIds.delete(d._msgId), 5000);
      }
      this.cb.onData(d);
    });

    c.on('close', () => {
      clearTimeout(connTimeout);
      this.conns.delete(c.peer);
      this._stopStatsMonitor();
    });

    c.on('error', err => {
      clearTimeout(connTimeout);
      console.warn('[RTC P2P Error]', err.type || err.message);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  WEBRTC MEDIA CALLS (screen share, camera)
  // ═══════════════════════════════════════════════════════════════

  _handleCall(call) {
    if (!call) return;
    const type = call.metadata?.type || 'screen';
    const answerStream = type === 'cam' ? (this.camStream || this.rawCamStream) : this.screenStream;

    try { call.answer(answerStream || undefined); } catch (e) { return; }
    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);
    this._monitorIceState(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        (type === 'cam') ? this.cb.onCam(remoteStream) : this.cb.onScreen(remoteStream);
        remoteStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            if (remoteStream.getTracks().every(t => t.readyState === 'ended')) {
              (type === 'cam') ? this.cb.onCam(null) : this.cb.onScreen(null);
            }
          });
        });
      }
    });

    call.on('close', () => {
      if (type === 'cam') { this.camCall = null; this.cb.onCam(null); }
      else { this.screenCall = null; this.cb.onScreen(null); }
    });

    call.on('error', err => console.error('[Media Call Error]', err));
  }

  _call(targetId, stream, type) {
    if (!this.peer || !stream || !targetId) return null;
    let call;
    try { call = this.peer.call(targetId, stream, { metadata: { type } }); } catch (e) { return null; }
    if (!call) return null;

    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);
    this._monitorIceState(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        (type === 'cam') ? this.cb.onCam(remoteStream) : this.cb.onScreen(remoteStream);
        remoteStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            if (remoteStream.getTracks().every(t => t.readyState === 'ended')) {
              (type === 'cam') ? this.cb.onCam(null) : this.cb.onScreen(null);
            }
          });
        });
      }
    });

    call.on('error', err => console.error('[Media Call Error]', err));
    return call;
  }

  _optimizeCall(call) {
    if (!call) return;
    setTimeout(() => {
      if (!call.peerConnection) return;
      try {
        call.peerConnection.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video') {
            const p = sender.getParameters() || {};
            if (!p.encodings?.length) p.encodings = [{}];
            p.encodings[0].maxBitrate = 5000000;
            p.encodings[0].maxFramerate = 60;
            sender.setParameters(p).catch(() => {});
          } else if (sender.track?.kind === 'audio') {
            const p = sender.getParameters() || {};
            if (!p.encodings?.length) p.encodings = [{}];
            p.encodings[0].maxBitrate = 128000;
            sender.setParameters(p).catch(() => {});
          }
        });
      } catch (e) {}
    }, 500);
  }

  _monitorIceState(call) {
    if (!call?.peerConnection) return;
    const pc = call.peerConnection;
    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState;
      console.log(`[RTC ICE] ${state}`);
      if (state === 'failed') { try { pc.restartIce(); } catch (e) {} }
      if (state === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn('[RTC ICE] Still disconnected');
          }
        }, 5000);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  STATS
  // ═══════════════════════════════════════════════════════════════

  _startStatsMonitor() {
    this._stopStatsMonitor();
    this._statsInterval = setInterval(() => this._collectStats(), 3000);
  }

  _stopStatsMonitor() {
    if (this._statsInterval) { clearInterval(this._statsInterval); this._statsInterval = null; }
  }

  async _collectStats() {
    const call = this.screenCall || this.camCall;
    if (!call?.peerConnection) return;
    try {
      const stats = await call.peerConnection.getStats();
      let packetLoss = 0, resolution = '', fps = 0, totalBytes = 0;

      stats.forEach(r => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime) {
          this._latestStats.rtt = Math.round(r.currentRoundTripTime * 1000);
        }
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          if (r.packetsLost !== undefined && r.packetsReceived) packetLoss = Math.round((r.packetsLost / (r.packetsReceived + r.packetsLost)) * 100);
          if (r.frameWidth && r.frameHeight) resolution = `${r.frameWidth}x${r.frameHeight}`;
          if (r.framesPerSecond) fps = Math.round(r.framesPerSecond);
        }
        if (r.type === 'outbound-rtp' && r.kind === 'video') {
          totalBytes += r.bytesSent || 0;
          if (!resolution && r.frameWidth && r.frameHeight) resolution = `${r.frameWidth}x${r.frameHeight}`;
          if (!fps && r.framesPerSecond) fps = Math.round(r.framesPerSecond);
        }
        if (r.type === 'inbound-rtp') totalBytes += r.bytesReceived || 0;
      });

      Object.assign(this._latestStats, { packetLoss, resolution, fps, bitrate: Math.round(totalBytes / 1024) });
      this.cb.onStats({ ...this._latestStats });
    } catch (e) {}
  }

  getStats() { return { ...this._latestStats }; }

  // ═══════════════════════════════════════════════════════════════
  //  SCREEN SHARE
  // ═══════════════════════════════════════════════════════════════

  async shareScreen() {
    if (this.screenStream) this.stopScreen();
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('SECURE_CONTEXT_REQUIRED');

    const opts = [
      { video: { width: { ideal: 1920, max: 3840 }, height: { ideal: 1080, max: 2160 }, frameRate: { ideal: 60 } }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false }, surfaceSwitching: 'include', selfBrowserSurface: 'exclude', systemAudio: 'include' },
      { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true },
      { video: true, audio: false }
    ];

    let s;
    for (const o of opts) {
      try { s = await navigator.mediaDevices.getDisplayMedia(o); break; }
      catch (err) { if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') throw err; }
    }
    if (!s) throw new Error('Failed to capture screen');

    this.screenStream = s;
    s.getVideoTracks()[0]?.addEventListener('ended', () => this.stopScreen());

    // Send to all connected peers
    this._sendStreamToPeers(s, 'screen');
    return s;
  }

  shareCustomStream(s) { return this.rebindCustomStream(s); }

  rebindCustomStream(s) {
    this.screenStream = s;
    const openPeers = this._getOpenPeers();
    if (openPeers.size === 0) return s;

    let replaced = false;
    if (this.screenCall?.peerConnection) {
      try {
        const pc = this.screenCall.peerConnection;
        const senders = pc.getSenders();
        const vTrack = s.getVideoTracks()[0];
        const aTrack = s.getAudioTracks()[0];
        let vR = false, aR = false;

        senders.forEach(sender => {
          if (sender.track?.kind === 'video' && vTrack) { sender.replaceTrack(vTrack); vR = true; }
          else if (sender.track?.kind === 'audio' && aTrack) { sender.replaceTrack(aTrack); aR = true; }
        });
        if (aTrack && !aR && pc.addTrack) try { pc.addTrack(aTrack, s); aR = true; } catch (e) {}
        if (vTrack && !vR && pc.addTrack) try { pc.addTrack(vTrack, s); vR = true; } catch (e) {}
        replaced = vR || aR;
      } catch (e) { replaced = false; }
    }

    if (!replaced) {
      if (this.screenCall) try { this.screenCall.close(); } catch (e) {}
      openPeers.forEach(pid => this._call(pid, s, 'screen'));
    }
    return s;
  }

  stopScreen() {
    if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
    if (this.screenCall) { try { this.screenCall.close(); } catch (e) {} this.screenCall = null; }
    this.cb.onScreen(null);
  }

  // ═══════════════════════════════════════════════════════════════
  //  CAMERA & MIC
  // ═══════════════════════════════════════════════════════════════

  async startCam() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    });
    this.rawCamStream = raw;
    try { this.camStream = await this.dsp.process(raw); } catch (e) { this.camStream = raw; }
    this._sendStreamToPeers(this.camStream || raw, 'cam');
    return this.camStream || raw;
  }

  async startMicOnly() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    });
    this.rawCamStream = raw;
    try { this.camStream = await this.dsp.process(raw); } catch (e) { this.camStream = raw; }
    this._sendStreamToPeers(this.camStream || raw, 'cam');
    return this.camStream || raw;
  }

  stopCam() {
    if (this.rawCamStream) { this.rawCamStream.getTracks().forEach(t => t.stop()); this.rawCamStream = null; }
    if (this.camStream) { this.camStream.getTracks().forEach(t => t.stop()); this.camStream = null; }
    if (this.camCall) { try { this.camCall.close(); } catch (e) {} this.camCall = null; }
    this.dsp.cleanup();
    this.cb.onCam(null);
  }

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════

  _getOpenPeers() {
    const peers = new Set();
    if (this.conn?.open) peers.add(this.conn.peer);
    this.conns.forEach(c => { if (c?.open) peers.add(c.peer); });
    // Also include partner PeerJS ID even if WebRTC data conn isn't open
    if (this._partnerPeerId && this.peer?.open) peers.add(this._partnerPeerId);
    return peers;
  }

  _sendStreamToPeers(stream, type) {
    const peers = this._getOpenPeers();
    peers.forEach(pid => this._call(pid, stream, type));
  }

  // ─── Send data via BOTH Socket.IO (guaranteed) and WebRTC (bonus) ───
  send(type, payload) {
    const _msgId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const packet = { type, payload, ts: Date.now(), _msgId };

    // PRIMARY: Socket.IO relay
    if (this.socket && this._socketConnected && this._socketRoomJoined) {
      try { this.socket.emit('room-data', packet); } catch (e) {}
    }

    // SECONDARY: WebRTC data channel
    if (this.conn?.open) try { this.conn.send(packet); } catch (e) {}
    this.conns.forEach(c => { if (c?.open && c !== this.conn) try { c.send(packet); } catch (e) {} });
  }

  destroy() {
    this._destroyed = true;
    this._connected = false;
    this._stopHeartbeat();
    this._stopStatsMonitor();
    clearTimeout(this._reconnectTimer);
    if (this.socket) { try { this.socket.disconnect(); } catch (e) {} this.socket = null; }
    if (this.peer && !this.peer.destroyed) { try { this.peer.destroy(); } catch (e) {} }
  }
}
