import { AudioDSP } from './audio-processor.js';

export class RTC {
  constructor(cb = {}) {
    this.peer = null;
    this.id = null;
    this.conn = null;
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
            { urls: 'stun:stun1.l.google.com:19302' }
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
    if (this.screenStream) this._call(targetId, this.screenStream, 'screen');
    if (this.camStream) this._call(targetId, this.camStream, 'cam');
  }

  _handleConn(c) {
    this.conn = c;
    c.on('open', () => {
      this.cb.onConnect(c.peer);
      this.cb.onStatus('connected');
    });
    c.on('data', d => this.cb.onData(d));
    c.on('close', () => {
      this.cb.onDisconnect();
      this.cb.onStatus('disconnected');
    });
  }

  _handleCall(call) {
    const type = call.metadata?.type || 'screen';
    call.answer(type === 'cam' ? this.camStream : this.screenStream);
    call.on('stream', s => type === 'cam' ? this.cb.onCam(s) : this.cb.onScreen(s));
    call.on('close', () => type === 'cam' ? this.cb.onCam(null) : this.cb.onScreen(null));
  }

  _call(targetId, stream, type) {
    if (!this.peer || !stream) return;
    const call = this.peer.call(targetId, stream, { metadata: { type } });
    call.on('stream', s => type === 'cam' ? this.cb.onCam(s) : this.cb.onScreen(s));
  }

  async shareScreen() {
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
    });
    this.screenStream = s;
    s.getVideoTracks()[0].onended = () => this.stopScreen();
    if (this.conn?.open) this._call(this.conn.peer, s, 'screen');
    return s;
  }

  stopScreen() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
  }

  async startCam() {
    const raw = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const processed = await this.dsp.process(raw);
    this.camStream = processed;
    if (this.conn?.open) this._call(this.conn.peer, processed, 'cam');
    return processed;
  }

  stopCam() {
    if (this.camStream) {
      this.camStream.getTracks().forEach(t => t.stop());
      this.camStream = null;
    }
  }

  send(type, payload) {
    if (this.conn?.open) this.conn.send({ type, payload, ts: Date.now() });
  }
}
