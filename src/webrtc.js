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
      const opts = {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
          ]
        }
      };

      this.peer = customId ? new window.Peer(customId, opts) : new window.Peer(opts);

      this.peer.on('open', id => {
        this.id = id;
        this.cb.onStatus('ready', id);
        resolve(id);
      });

      this.peer.on('connection', c => this._handleConn(c));
      this.peer.on('call', c => this._handleCall(c));
      this.peer.on('error', e => {
        console.error('[WebRTC Error]', e);
        this.cb.onStatus('error', e.message);
        reject(e);
      });
      this.peer.on('disconnected', () => this.cb.onStatus('disconnected'));
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
  }

  _handleCall(call) {
    const type = call.metadata?.type || 'screen';
    const answerStream = type === 'cam' ? this.rawCamStream : this.screenStream;

    call.answer(answerStream || undefined);

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
        this.cb.onCam(null);
      } else {
        this.cb.onScreen(null);
      }
    });
  }

  _call(targetId, stream, type) {
    if (!this.peer || !stream) return;
    const call = this.peer.call(targetId, stream, { metadata: { type } });

    call.on('stream', remoteStream => {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        if (type === 'cam') {
          this.cb.onCam(remoteStream);
        } else {
          this.cb.onScreen(remoteStream);
        }
      }
    });
  }

  async shareScreen() {
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        suppressLocalAudioPlayback: false
      }
    });
    this.screenStream = s;
    s.getVideoTracks()[0].onended = () => this.stopScreen();

    if (this.conn?.open) {
      this._call(this.conn.peer, s, 'screen');
    }
    return s;
  }

  stopScreen() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    this.cb.onScreen(null);
  }

  async startCam() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    this.rawCamStream = raw;

    // Apply Audio DSP locally for meter & noise gate
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
    this.dsp.cleanup();
    this.cb.onCam(null);
  }

  send(type, payload) {
    if (this.conn?.open) this.conn.send({ type, payload, ts: Date.now() });
  }
}
