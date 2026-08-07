import Peer from 'peerjs';
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

  init(customId) {
    this._customId = customId;
    return new Promise((resolve, reject) => {
      const isHttps = window.location.protocol === 'https:';
      const host = window.location.hostname || 'localhost';
      const portStr = window.location.port;

      const iceServers = [
        // STUN servers (For Direct P2P NAT Mapping)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },

        // TURN Relay Servers (Essential for connections across different networks, cellular data, firewalls, and symmetric NATs)
        { urls: 'stun:openrelay.metered.ca:80' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelay',
          credential: 'openrelay'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelay',
          credential: 'openrelay'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelay',
          credential: 'openrelay'
        }
      ];

      // Self-hosted PeerServer options (/peerjs path)
      const selfHostedOpts = {
        host: host,
        path: '/peerjs',
        secure: isHttps,
        debug: 0,
        pingInterval: 5000,
        config: { iceServers, iceTransportPolicy: 'all' }
      };
      if (portStr && portStr !== '80' && portStr !== '443') {
        selfHostedOpts.port = parseInt(portStr, 10);
      }

      // Public PeerJS Cloud fallback options
      const cloudOpts = {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 0,
        pingInterval: 5000,
        config: { iceServers, iceTransportPolicy: 'all' }
      };

      this._cloudOpts = cloudOpts;
      this._selfHostedOpts = selfHostedOpts;

      const attempts = [
        { opts: selfHostedOpts, id: customId, name: 'Self-Hosted /peerjs' },
        { opts: cloudOpts, id: customId, name: 'PeerJS Cloud Fallback' }
      ];

      let currentAttemptIndex = 0;

      const tryNextAttempt = () => {
        if (currentAttemptIndex >= attempts.length) {
          this.cb.onStatus('error', 'All signaling server attempts failed');
          return reject(new Error('Could not connect to any signaling server'));
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

          let resolved = false;

          this.peer.on('open', id => {
            if (resolved) return;
            resolved = true;
            this.id = id;
            this._destroyed = false;
            console.log(`[RTC Signaling] Connected via ${config.name}! Room ID: ${id}`);
            this.cb.onStatus('ready', id);
            resolve(id);
          });

          this.peer.on('connection', c => this._handleConn(c));
          this.peer.on('call', c => this._handleCall(c));

          this.peer.on('error', e => {
            console.warn(`[RTC Signaling Warning] ${config.name} error:`, e.type, e.message);
            if (e.type === 'peer-unavailable') {
              // If connecting to a target peer and got peer-unavailable on primary server, try fallback cloud server
              if (this._targetPeerId && !this._triedCloudFallback) {
                this._triedCloudFallback = true;
                console.log('[RTC Signaling] Host not on current server, trying cloud signaling server fallback...');
                this._switchServerAndConnect(this._targetPeerId, cloudOpts);
                return;
              }
              if (this._targetPeerId && this._peerUnavailableRetries < 2) {
                this._peerUnavailableRetries++;
                console.log(`[RTC Signaling] Retrying connection to host ${this._targetPeerId} (Attempt ${this._peerUnavailableRetries}/2)...`);
                setTimeout(() => this.connect(this._targetPeerId), 2000);
                return;
              }
              this.cb.onStatus('error', 'Room ID not found or host is offline. Verify Room ID.');
              return;
            }
            if (e.type === 'unavailable-id') {
              console.warn(`[RTC Signaling Warning] ID ${config.id} in use, trying auto-generated ID...`);
              config.id = null;
              if (!resolved) setTimeout(tryNextAttempt, 500);
              return;
            }
            if (!resolved) {
              setTimeout(tryNextAttempt, 1500);
            }
          });

          this.peer.on('disconnected', () => {
            this.cb.onStatus('disconnected');
            if (this.peer && !this.peer.destroyed) {
              try { this.peer.reconnect(); } catch (err) {}
            }
          });
        } catch (err) {
          console.warn(`[RTC Signaling Exception] ${config.name} exception:`, err);
          setTimeout(tryNextAttempt, 1500);
        }
      };

      tryNextAttempt();
    });
  }

  // Switch signaling server target (e.g. from self-hosted to cloud fallback) and join
  async _switchServerAndConnect(targetId, serverOpts) {
    try {
      this.cb.onStatus('connecting');
      if (this.peer && !this.peer.destroyed) {
        try { this.peer.destroy(); } catch (e) {}
      }
      this.peer = new Peer(serverOpts);
      this.peer.on('open', id => {
        this.id = id;
        console.log(`[RTC Signaling] Switched signaling server successfully! Room ID: ${id}`);
        this.connect(targetId);
      });
      this.peer.on('connection', c => this._handleConn(c));
      this.peer.on('call', c => this._handleCall(c));
      this.peer.on('error', e => {
        console.warn('[RTC Fallback Signaling Error]', e.type, e.message);
        this.cb.onStatus('error', 'Host is offline or Room ID is invalid.');
      });
    } catch (e) {
      console.error('[RTC Switch Server Exception]', e);
      this.cb.onStatus('error', 'Could not reach signaling server');
    }
  }

  connect(targetId) {
    if (!targetId) return;
    if (this._targetPeerId !== targetId) {
      this._targetPeerId = targetId;
      this._triedCloudFallback = false;
      this._peerUnavailableRetries = 0;
    }
    if (!this._isReconnecting) {
      this._reconnectAttempts = 0;
    }

    if (!this.peer) {
      console.warn('[RTC Connect] Peer instance not initialized');
      this.cb.onStatus('error', 'Signaling server not ready');
      return;
    }

    if (this.peer.destroyed) {
      console.warn('[RTC Connect] Peer instance destroyed, re-initializing...');
      this._reinitAndConnect(targetId);
      return;
    }

    if (!this.peer.open) {
      console.log('[RTC Connect] Peer connection pending open... Queuing join to:', targetId);
      this.cb.onStatus('connecting');
      this.peer.once('open', () => this.connect(targetId));
      return;
    }

    console.log(`[RTC Connect] Initiating WebRTC data connection to room host: ${targetId}...`);
    this.cb.onStatus('connecting');

    try {
      if (this.conn) {
        try { this.conn.close(); } catch (e) {}
      }
      const c = this.peer.connect(targetId, { reliable: true, serialization: 'json' });
      this._handleConn(c, targetId);
    } catch (err) {
      console.error('[RTC Connect Error]', err);
      this.cb.onStatus('error', `Could not connect to room: ${err.message}`);
    }
  }

  // Re-initialize peer and reconnect after destroy
  async _reinitAndConnect(targetId) {
    try {
      this.cb.onStatus('connecting');
      this.cb.onReconnecting(this._reconnectAttempts + 1, this._maxReconnectAttempts);
      await this.init(this._customId);
      this.connect(targetId);
    } catch (err) {
      console.error('[RTC Reinit Error]', err);
      this.cb.onStatus('error', 'Could not reconnect to signaling server');
    }
  }

  // Auto-reconnect with exponential backoff
  _scheduleReconnect() {
    if (this._isReconnecting || this._destroyed) return;
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.warn('[RTC Reconnect] Max reconnection attempts reached');
      this.cb.onStatus('error', 'Connection lost. Please refresh and rejoin.');
      return;
    }

    this._isReconnecting = true;
    this._reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(2, this._reconnectAttempts - 1), 16000);
    console.log(`[RTC Reconnect] Attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts} in ${delay}ms...`);
    this.cb.onReconnecting(this._reconnectAttempts, this._maxReconnectAttempts);

    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      this._isReconnecting = false;
      if (this._targetPeerId) {
        if (this.peer && this.peer.destroyed) {
          this._reinitAndConnect(this._targetPeerId);
        } else {
          this.connect(this._targetPeerId);
        }
      }
    }, delay);
  }

  // Heartbeat system
  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatMissed = 0;
    this._lastHeartbeat = Date.now();

    this._heartbeatInterval = setInterval(() => {
      if (this.conn?.open) {
        this.send('__HEARTBEAT__', { ts: Date.now() });
        this._heartbeatMissed++;

        if (this._heartbeatMissed >= this._maxMissedHeartbeats) {
          console.warn('[RTC Heartbeat] Partner unresponsive, triggering reconnection...');
          this._stopHeartbeat();
          this._scheduleReconnect();
        }
      } else {
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
    this._reconnectAttempts = 0; // Reset on successful heartbeat
  }

  _handleConn(c, targetId) {
    this.conn = c;
    if (targetId) this._targetPeerId = targetId;

    // Timeout safety net: If connection stays stuck connecting for 25 seconds (allows TURN relay discovery across cellular & different networks)
    const connTimeout = setTimeout(() => {
      if (c && !c.open) {
        console.warn('[RTC DataConnection Timeout] Connection attempt timed out');
        this.cb.onStatus('error', `Connection timed out to ${targetId || c.peer}. Host may be offline or unreachable on network.`);
        try { c.close(); } catch (e) {}
      }
    }, 25000);

    c.on('open', () => {
      clearTimeout(connTimeout);
      this.conns.set(c.peer, c);
      this._targetPeerId = c.peer;
      this._reconnectAttempts = 0;
      this._isReconnecting = false;
      console.log('[RTC DataConnection Open] Connected to peer:', c.peer);
      this.cb.onConnect(c.peer);
      this.cb.onStatus('connected');
      this._startHeartbeat();
      this._startStatsMonitor();

      // Send existing active streams to newly connected peer immediately
      if (this.screenStream) {
        this._call(c.peer, this.screenStream, 'screen');
      }
      if (this.camStream || this.rawCamStream) {
        this._call(c.peer, this.camStream || this.rawCamStream, 'cam');
      }
    });

    c.on('data', d => {
      // Handle internal heartbeat
      if (d && d.type === '__HEARTBEAT__') {
        this._onHeartbeatReceived();
        // Echo heartbeat response
        if (c && c.open) {
          try { c.send({ type: '__HEARTBEAT_ACK__', payload: { ts: Date.now() }, ts: Date.now() }); } catch (e) {}
        }
        return;
      }
      if (d && d.type === '__HEARTBEAT_ACK__') {
        this._onHeartbeatReceived();
        // Calculate RTT
        if (d.payload?.ts) {
          this._latestStats.rtt = Date.now() - (d.ts || d.payload.ts);
        }
        return;
      }
      this.cb.onData(d);
    });

    c.on('close', () => {
      clearTimeout(connTimeout);
      this.conns.delete(c.peer);
      this._stopHeartbeat();
      this._stopStatsMonitor();
      this.cb.onDisconnect();
      this.cb.onStatus('disconnected');
      // Auto-reconnect if we had a target peer
      if (this._targetPeerId && !this._destroyed) {
        this._scheduleReconnect();
      }
    });

    c.on('error', err => {
      clearTimeout(connTimeout);
      console.error('[Data Connection Error]', err);
      this.cb.onStatus('error', `Room join error: ${err.type || err.message || 'Peer connection failed'}`);
    });
  }

  _handleCall(call) {
    if (!call) return;
    const type = call.metadata?.type || 'screen';
    const answerStream = type === 'cam' ? (this.camStream || this.rawCamStream) : this.screenStream;

    try {
      call.answer(answerStream || undefined);
    } catch (e) {
      console.error('[RTC Answer Error]', e);
      return;
    }
    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);
    this._monitorIceState(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        if (type === 'cam') {
          this.cb.onCam(remoteStream);
        } else {
          this.cb.onScreen(remoteStream);
        }
        remoteStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            if (remoteStream.getTracks().every(t => t.readyState === 'ended')) {
              if (type === 'cam') this.cb.onCam(null);
              else this.cb.onScreen(null);
            }
          });
        });
      }
    });

    call.on('close', () => {
      if (type === 'cam') {
        this.camCall = null;
        this.cb.onCam(null);
      } else {
        this.screenCall = null;
        this.cb.onScreen(null);
      }
    });

    call.on('error', err => {
      console.error('[Media Call Error]', err);
    });
  }

  _call(targetId, stream, type) {
    if (!this.peer || !stream) return null;
    let call = null;
    try {
      call = this.peer.call(targetId, stream, { metadata: { type } });
    } catch (e) {
      console.error('[RTC Call Error]', e);
      return null;
    }
    if (!call) return null;

    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);
    this._monitorIceState(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        if (type === 'cam') {
          this.cb.onCam(remoteStream);
        } else {
          this.cb.onScreen(remoteStream);
        }
        remoteStream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            if (remoteStream.getTracks().every(t => t.readyState === 'ended')) {
              if (type === 'cam') this.cb.onCam(null);
              else this.cb.onScreen(null);
            }
          });
        });
      }
    });

    call.on('error', err => {
      console.error('[Media Call Error]', err);
    });

    return call;
  }

  _optimizeCall(call) {
    if (!call) return;
    const update = () => {
      if (!call.peerConnection) return;
      try {
        call.peerConnection.getSenders().forEach(sender => {
          if (sender.track && sender.track.kind === 'video') {
            const params = sender.getParameters() || {};
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 5000000; // 5 Mbps for HD 1080p 60fps
            params.encodings[0].maxFramerate = 60;
            sender.setParameters(params).catch(() => {});
          } else if (sender.track && sender.track.kind === 'audio') {
            const params = sender.getParameters() || {};
            if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
            params.encodings[0].maxBitrate = 128000; // 128 kbps optimal voice & music encoding
            sender.setParameters(params).catch(() => {});
          }
        });
      } catch (e) {}
    };
    setTimeout(update, 500);
  }

  // Monitor ICE connection state and attempt restart on failure
  _monitorIceState(call) {
    if (!call || !call.peerConnection) return;
    const pc = call.peerConnection;
    pc.addEventListener('iceconnectionstatechange', () => {
      const state = pc.iceConnectionState;
      console.log(`[RTC ICE] State: ${state}`);
      if (state === 'failed') {
        console.warn('[RTC ICE] Connection failed, attempting ICE restart...');
        try {
          pc.restartIce();
        } catch (e) {
          console.error('[RTC ICE Restart Error]', e);
        }
      }
      if (state === 'disconnected') {
        // Wait briefly — may recover automatically
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            console.warn('[RTC ICE] Still disconnected after timeout');
          }
        }, 5000);
      }
    });
  }

  // Connection stats monitoring
  _startStatsMonitor() {
    this._stopStatsMonitor();
    this._statsInterval = setInterval(() => this._collectStats(), 3000);
  }

  _stopStatsMonitor() {
    if (this._statsInterval) {
      clearInterval(this._statsInterval);
      this._statsInterval = null;
    }
  }

  async _collectStats() {
    const call = this.screenCall || this.camCall;
    if (!call || !call.peerConnection) return;
    try {
      const stats = await call.peerConnection.getStats();
      let totalBytesSent = 0;
      let totalBytesReceived = 0;
      let packetLoss = 0;
      let resolution = '';
      let fps = 0;

      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime) {
            this._latestStats.rtt = Math.round(report.currentRoundTripTime * 1000);
          }
        }
        if (report.type === 'inbound-rtp' && report.kind === 'video') {
          if (report.packetsLost !== undefined && report.packetsReceived) {
            packetLoss = Math.round((report.packetsLost / (report.packetsReceived + report.packetsLost)) * 100);
          }
          if (report.frameWidth && report.frameHeight) {
            resolution = `${report.frameWidth}x${report.frameHeight}`;
          }
          if (report.framesPerSecond) {
            fps = Math.round(report.framesPerSecond);
          }
        }
        if (report.type === 'outbound-rtp' && report.kind === 'video') {
          totalBytesSent += report.bytesSent || 0;
          if (report.frameWidth && report.frameHeight && !resolution) {
            resolution = `${report.frameWidth}x${report.frameHeight}`;
          }
          if (report.framesPerSecond && !fps) {
            fps = Math.round(report.framesPerSecond);
          }
        }
        if (report.type === 'inbound-rtp') {
          totalBytesReceived += report.bytesReceived || 0;
        }
      });

      this._latestStats.packetLoss = packetLoss;
      this._latestStats.resolution = resolution;
      this._latestStats.fps = fps;
      this._latestStats.bitrate = Math.round((totalBytesSent + totalBytesReceived) / 1024); // KB

      this.cb.onStats({ ...this._latestStats });
    } catch (e) {}
  }

  getStats() {
    return { ...this._latestStats };
  }

  async shareScreen() {
    if (this.screenStream) {
      this.stopScreen();
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('SECURE_CONTEXT_REQUIRED');
    }

    const preferredOptions = {
      video: {
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
        frameRate: { ideal: 60, max: 60 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false
      },
      surfaceSwitching: 'include',
      selfBrowserSurface: 'exclude',
      systemAudio: 'include'
    };

    const fallbackOptions1 = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true
    };

    const fallbackOptions2 = {
      video: true,
      audio: false
    };

    let s;
    try {
      s = await navigator.mediaDevices.getDisplayMedia(preferredOptions);
    } catch (err1) {
      if (err1.name === 'NotAllowedError' || err1.name === 'PermissionDeniedError') {
        throw err1;
      }
      try {
        s = await navigator.mediaDevices.getDisplayMedia(fallbackOptions1);
      } catch (err2) {
        if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
          throw err2;
        }
        s = await navigator.mediaDevices.getDisplayMedia(fallbackOptions2);
      }
    }

    this.screenStream = s;
    const vTrack = s.getVideoTracks()[0];
    if (vTrack) {
      vTrack.addEventListener('ended', () => this.stopScreen());
    }

    if (this.conn?.open) {
      this.rebindCustomStream(s);
    }
    return s;
  }

  shareCustomStream(s) {
    return this.rebindCustomStream(s);
  }

  rebindCustomStream(s) {
    this.screenStream = s;
    const openPeers = new Set();
    if (this.conn?.open) openPeers.add(this.conn.peer);
    this.conns.forEach(c => {
      if (c && c.open) openPeers.add(c.peer);
    });

    if (openPeers.size === 0) return s;

    // Check if active call exists and attempt seamless replaceTrack / addTrack
    let replaced = false;
    if (this.screenCall && this.screenCall.peerConnection) {
      try {
        const pc = this.screenCall.peerConnection;
        const senders = pc.getSenders();
        const vTrack = s.getVideoTracks()[0];
        const aTrack = s.getAudioTracks()[0];

        let vReplaced = false;
        let aReplaced = false;

        senders.forEach(sender => {
          if (sender.track?.kind === 'video' && vTrack) {
            sender.replaceTrack(vTrack);
            vReplaced = true;
          } else if (sender.track?.kind === 'audio' && aTrack) {
            sender.replaceTrack(aTrack);
            aReplaced = true;
          }
        });

        if (aTrack && !aReplaced && pc.addTrack) {
          try {
            pc.addTrack(aTrack, s);
            aReplaced = true;
          } catch (e) {}
        }
        if (vTrack && !vReplaced && pc.addTrack) {
          try {
            pc.addTrack(vTrack, s);
            vReplaced = true;
          } catch (e) {}
        }
        replaced = vReplaced || aReplaced;
      } catch (e) {
        replaced = false;
      }
    }

    if (!replaced) {
      if (this.screenCall) {
        try { this.screenCall.close(); } catch (e) {}
      }
      openPeers.forEach(peerId => {
        this._call(peerId, s, 'screen');
      });
    }
    return s;
  }

  stopScreen() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    if (this.screenCall) {
      try { this.screenCall.close(); } catch (e) {}
      this.screenCall = null;
    }
    this.cb.onScreen(null);
  }

  async startCam() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    });
    this.rawCamStream = raw;

    try {
      this.camStream = await this.dsp.process(raw);
    } catch (e) {
      this.camStream = raw;
    }

    const openPeers = new Set();
    if (this.conn?.open) openPeers.add(this.conn.peer);
    this.conns.forEach(c => {
      if (c && c.open) openPeers.add(c.peer);
    });

    openPeers.forEach(peerId => {
      this._call(peerId, this.camStream || raw, 'cam');
    });
    return this.camStream || raw;
  }

  async startMicOnly() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    });
    this.rawCamStream = raw;

    try {
      this.camStream = await this.dsp.process(raw);
    } catch (e) {
      this.camStream = raw;
    }

    const openPeers = new Set();
    if (this.conn?.open) openPeers.add(this.conn.peer);
    this.conns.forEach(c => {
      if (c && c.open) openPeers.add(c.peer);
    });

    openPeers.forEach(peerId => {
      this._call(peerId, this.camStream || raw, 'cam');
    });
    return this.camStream || raw;
  }

  stopCam() {
    if (this.rawCamStream) {
      this.rawCamStream.getTracks().forEach(t => t.stop());
      this.rawCamStream = null;
    }
    if (this.camStream) {
      this.camStream.getTracks().forEach(t => t.stop());
      this.camStream = null;
    }
    if (this.camCall) {
      try { this.camCall.close(); } catch (e) {}
      this.camCall = null;
    }
    this.dsp.cleanup();
    this.cb.onCam(null);
  }

  send(type, payload) {
    const packet = { type, payload, ts: Date.now() };
    if (this.conn?.open) {
      try { this.conn.send(packet); } catch (e) {}
    }
    this.conns.forEach(c => {
      if (c && c.open && c !== this.conn) {
        try { c.send(packet); } catch (e) {}
      }
    });
  }

  destroy() {
    this._destroyed = true;
    this._stopHeartbeat();
    this._stopStatsMonitor();
    clearTimeout(this._reconnectTimer);
    if (this.peer && !this.peer.destroyed) {
      try { this.peer.destroy(); } catch (e) {}
    }
  }
}
