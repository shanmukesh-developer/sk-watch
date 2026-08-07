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
      const port = window.location.port ? +window.location.port : (isHttps ? 443 : 80);

      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ];

      // Primary options: Dedicated self-hosted PeerServer on /peerjs endpoint
      const selfHostedOpts = {
        host: host,
        port: port,
        path: '/peerjs',
        secure: isHttps,
        debug: 0,
        config: { iceServers }
      };

      // Fallback options: Public PeerJS Cloud
      const cloudOpts = {
        debug: 0,
        config: { iceServers }
      };

      let attemptedFallback = false;

      const createPeer = (opts, idToUse) => {
        try {
          return idToUse ? new window.Peer(idToUse, opts) : new window.Peer(opts);
        } catch (err) {
          return new window.Peer(opts);
        }
      };

      // If running on Vite dev server port 5173, use cloud directly or selfHosted
      const isDevPort = port === 5173 || port === 3000;
      const initialOpts = isDevPort ? cloudOpts : selfHostedOpts;

      this.peer = createPeer(initialOpts, customId);

      const setupHandlers = (p) => {
        p.on('open', id => {
          this.id = id;
          this.cb.onStatus('ready', id);
          resolve(id);
        });

        p.on('connection', c => this._handleConn(c));
        p.on('call', c => this._handleCall(c));

        p.on('error', e => {
          console.error('[WebRTC Error]', e);
          if (!attemptedFallback && e.type !== 'peer-unavailable') {
            attemptedFallback = true;
            console.log('Switching signaling server fallback...');
            try { p.destroy(); } catch (err) {}
            this.peer = createPeer(cloudOpts, customId);
            setupHandlers(this.peer);
            return;
          }
          const msg = e.type === 'peer-unavailable' ? 'Room ID not found' : (e.message || e.type);
          this.cb.onStatus('error', msg);
          reject(e);
        });

        p.on('disconnected', () => {
          this.cb.onStatus('disconnected');
          if (p && !p.destroyed) {
            try { p.reconnect(); } catch (err) {}
          }
        });
      };

      setupHandlers(this.peer);
    });
  }

  connect(targetId) {
    if (!this.peer) return;
    this.cb.onStatus('connecting');
    const c = this.peer.connect(targetId, { reliable: true });
    this._handleConn(c);
  }

  _handleConn(c) {
    this.conn = c;
    c.on('open', () => {
      this.cb.onConnect(c.peer);
      this.cb.onStatus('connected');

      // Send existing active streams to newly connected peer immediately
      if (this.screenStream) {
        this._call(c.peer, this.screenStream, 'screen');
      }
      if (this.rawCamStream) {
        this._call(c.peer, this.rawCamStream, 'cam');
      }
    });

    c.on('data', d => this.cb.onData(d));

    c.on('close', () => {
      this.cb.onDisconnect();
      this.cb.onStatus('disconnected');
    });

    c.on('error', err => {
      console.error('[Data Connection Error]', err);
    });
  }

  _handleCall(call) {
    const type = call.metadata?.type || 'screen';
    const answerStream = type === 'cam' ? this.rawCamStream : this.screenStream;

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
            params.encodings[0].maxBitrate = 510000; // 510 kbps Studio Stereo
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
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 3840, min: 1920 }, height: { ideal: 2160, min: 1080 }, frameRate: { ideal: 60, min: 30 } },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
        suppressLocalAudioPlayback: false
      }
    });
    this.screenStream = s;
    s.getVideoTracks()[0].onended = () => this.stopScreen();

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

    // Check if active call exists and attempt seamless replaceTrack
    let replaced = false;
    if (this.screenCall && this.screenCall.peerConnection) {
      try {
        const senders = this.screenCall.peerConnection.getSenders();
        const vTrack = s.getVideoTracks()[0];
        const aTrack = s.getAudioTracks()[0];
        senders.forEach(sender => {
          if (sender.track?.kind === 'video' && vTrack) {
            sender.replaceTrack(vTrack);
            replaced = true;
          } else if (sender.track?.kind === 'audio' && aTrack) {
            sender.replaceTrack(aTrack);
            replaced = true;
          }
        });
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
      video: { width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: 60, min: 30 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 2 }, sampleRate: { ideal: 48000 } }
    });
    this.rawCamStream = raw;

    try {
      this.camStream = await this.dsp.process(raw);
    } catch (e) {
      this.camStream = raw;
    }

    if (this.conn?.open) {
      this._call(this.conn.peer, raw, 'cam');
    }
    return raw;
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
