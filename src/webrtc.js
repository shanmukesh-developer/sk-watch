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

    this.cb = {
      onStatus: cb.onStatus || (() => {}),
      onConnect: cb.onConnect || (() => {}),
      onDisconnect: cb.onDisconnect || (() => {}),
      onScreen: cb.onScreen || (() => {}),
      onCam: cb.onCam || (() => {}),
      onData: cb.onData || (() => {})
    };
  }

  init(customId) {
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
        { urls: 'stun:openrelay.metered.ca:80' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ];

      // Self-hosted PeerServer options (/peerjs path)
      const selfHostedOpts = {
        host: host,
        path: '/peerjs',
        secure: isHttps,
        debug: 0,
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
        config: { iceServers, iceTransportPolicy: 'all' }
      };

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

          let resolved = false;

          this.peer.on('open', id => {
            if (resolved) return;
            resolved = true;
            this.id = id;
            console.log(`[RTC Signaling] Connected via ${config.name}! Room ID: ${id}`);
            this.cb.onStatus('ready', id);
            resolve(id);
          });

          this.peer.on('connection', c => this._handleConn(c));
          this.peer.on('call', c => this._handleCall(c));

          this.peer.on('error', e => {
            console.warn(`[RTC Signaling Warning] ${config.name} error:`, e.type, e.message);
            if (e.type === 'peer-unavailable') {
              this.cb.onStatus('error', 'Room ID not found or host is offline');
              return;
            }
            if (!resolved) {
              setTimeout(tryNextAttempt, 200);
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
          setTimeout(tryNextAttempt, 200);
        }
      };

      tryNextAttempt();
    });
  }

  connect(targetId) {
    if (!targetId) return;

    if (!this.peer) {
      console.warn('[RTC Connect] Peer instance not initialized');
      this.cb.onStatus('error', 'Signaling server not ready');
      return;
    }

    if (this.peer.destroyed) {
      console.warn('[RTC Connect] Peer instance destroyed');
      this.cb.onStatus('error', 'Signaling lost. Refresh page.');
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

  _handleConn(c, targetId) {
    this.conn = c;

    // Timeout safety net: If connection stays stuck connecting for 15 seconds
    const connTimeout = setTimeout(() => {
      if (c && !c.open) {
        console.warn('[RTC DataConnection Timeout] Connection attempt timed out');
        this.cb.onStatus('error', `Connection timed out to ${targetId || c.peer}. Host may be offline.`);
        try { c.close(); } catch (e) {}
      }
    }, 15000);

    c.on('open', () => {
      clearTimeout(connTimeout);
      console.log('[RTC DataConnection Open] Connected to peer:', c.peer);
      this.cb.onConnect(c.peer);
      this.cb.onStatus('connected');

      // Send existing active streams to newly connected peer immediately
      if (this.screenStream) {
        this._call(c.peer, this.screenStream, 'screen');
      }
      if (this.camStream || this.rawCamStream) {
        this._call(c.peer, this.camStream || this.rawCamStream, 'cam');
      }
    });

    c.on('data', d => this.cb.onData(d));

    c.on('close', () => {
      clearTimeout(connTimeout);
      this.cb.onDisconnect();
      this.cb.onStatus('disconnected');
    });

    c.on('error', err => {
      clearTimeout(connTimeout);
      console.error('[Data Connection Error]', err);
      this.cb.onStatus('error', `Room join error: ${err.type || err.message || 'Peer connection failed'}`);
    });
  }

  _handleCall(call) {
    const type = call.metadata?.type || 'screen';
    const answerStream = type === 'cam' ? (this.camStream || this.rawCamStream) : this.screenStream;

    call.answer(answerStream || undefined);
    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        if (type === 'cam') {
          this.cb.onCam(remoteStream);
        } else {
          this.cb.onScreen(remoteStream);
        }
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
    const call = this.peer.call(targetId, stream, { metadata: { type } });
    if (type === 'screen') this.screenCall = call;
    if (type === 'cam') this.camCall = call;

    this._optimizeCall(call);

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        if (type === 'cam') {
          this.cb.onCam(remoteStream);
        } else {
          this.cb.onScreen(remoteStream);
        }
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
    if (!this.conn?.open) return s;

    // Check if active call exists and attempt seamless replaceTrack if senders match
    let replaced = false;
    if (this.screenCall && this.screenCall.peerConnection) {
      try {
        const senders = this.screenCall.peerConnection.getSenders();
        const vTrack = s.getVideoTracks()[0];
        const aTrack = s.getAudioTracks()[0];

        const hasVideoSender = senders.some(sender => sender.track?.kind === 'video');
        const hasAudioSender = senders.some(sender => sender.track?.kind === 'audio');

        const videoMatches = !vTrack || hasVideoSender;
        const audioMatches = !aTrack || hasAudioSender;

        if (videoMatches && audioMatches) {
          senders.forEach(sender => {
            if (sender.track?.kind === 'video' && vTrack) {
              sender.replaceTrack(vTrack);
            } else if (sender.track?.kind === 'audio' && aTrack) {
              sender.replaceTrack(aTrack);
            }
          });
          replaced = true;
        }
      } catch (e) {
        replaced = false;
      }
    }

    if (!replaced) {
      if (this.screenCall) {
        try { this.screenCall.close(); } catch (e) {}
      }
      this._call(this.conn.peer, s, 'screen');
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

    if (this.conn?.open) {
      this._call(this.conn.peer, this.camStream || raw, 'cam');
    }
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

    if (this.conn?.open) {
      this._call(this.conn.peer, this.camStream || raw, 'cam');
    }
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
    if (this.conn?.open) this.conn.send({ type, payload, ts: Date.now() });
  }
}
