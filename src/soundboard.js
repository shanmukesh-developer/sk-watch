/**
 * Cinema SoundFX Engine — Web Audio API Synthesizer
 */
export class SoundFXEngine {
  constructor() {
    this.ctx = null;
  }

  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(name) {
    switch (name) {
      case 'popcorn': this.popcorn(); break;
      case 'applause': this.applause(); break;
      case 'drumroll': this.drumroll(); break;
      case 'fanfare': this.fanfare(); break;
      case 'cheer': this.cheer(); break;
      case 'braam': this.braam(); break;
      case 'dunkirkClock': this.dunkirkClock(); break;
      case 'cosmicDrone': this.cosmicDrone(); break;
      case 'trailerImpact': this.trailerImpact(); break;
      case 'sciFiLaser': this.sciFiLaser(); break;
      case 'horrorSting': this.horrorSting(); break;
      case 'vinylCrackle': this.vinylCrackle(); break;
      case 'cyberSynthRise': this.cyberSynthRise(); break;
      case 'thunderBoom': this.thunderBoom(); break;
      case 'retroChime': this.retroChime(); break;
      case 'cameraShutter': this.cameraShutter(); break;
    }
  }

  cameraShutter() {
    const c = this._getCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  toggleAmbient(type) {
    if (!this.ambientActive) this.ambientActive = {};
    if (this.ambientActive[type]) {
      try { this.ambientActive[type].stop(); } catch (e) {}
      this.ambientActive[type] = null;
      return false;
    } else {
      const c = this._getCtx();
      const dur = 10;
      const bufSize = c.sampleRate * dur;
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const data = buf.getChannelData(0);

      if (type === 'rain') {
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
      } else if (type === 'fireplace') {
        for (let i = 0; i < bufSize; i++) {
          data[i] = Math.random() < 0.005 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 0.04 - 0.02);
        }
      } else if (type === 'wind') {
        let last = 0;
        for (let i = 0; i < bufSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (last + (0.02 * white)) / 1.02;
          last = data[i];
        }
      }

      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = c.createGain();
      g.gain.value = type === 'rain' ? 0.15 : (type === 'fireplace' ? 0.2 : 0.25);

      const filter = c.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : (type === 'fireplace' ? 'bandpass' : 'lowpass');
      filter.frequency.value = type === 'rain' ? 3000 : (type === 'fireplace' ? 1200 : 400);

      src.connect(filter);
      filter.connect(g);
      g.connect(c.destination);
      src.start();
      this.ambientActive[type] = src;
      return true;
    }
  }

  // ─── Nolan Soundscapes & Synthesizers ───

  vinylCrackle() {
    const c = this._getCtx();
    const now = c.currentTime;
    const dur = 2.0;
    const bufSize = c.sampleRate * dur;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = Math.random() < 0.003 ? (Math.random() * 2 - 1) * 0.8 : (Math.random() * 0.05 - 0.025);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(g);
    g.connect(c.destination);
    src.start(now);
  }

  cyberSynthRise() {
    const c = this._getCtx();
    const now = c.currentTime;
    const dur = 1.5;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + dur);
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  thunderBoom() {
    const c = this._getCtx();
    const now = c.currentTime;
    const dur = 2.5;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + dur);
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  retroChime() {
    const c = this._getCtx();
    const now = c.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, i) => {
      const st = now + i * 0.1;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, st);
      g.gain.setValueAtTime(0.15, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.4);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(st);
      osc.stop(st + 0.45);
    });
  }

  braam() {
    const c = this._getCtx();
    const now = c.currentTime;
    const duration = 2.4;

    // Sub-bass layer
    const subOsc = c.createOscillator();
    const subGain = c.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + duration);
    subGain.gain.setValueAtTime(0.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    subOsc.connect(subGain);
    subGain.connect(c.destination);
    subOsc.start(now);
    subOsc.stop(now + duration);

    // Brass Sawtooth Detuned Pair
    [130.81, 131.5].forEach(freq => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const filter = c.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3500, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + duration);
      filter.Q.value = 4;

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.08); // Sharp brass attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);

      osc.start(now);
      osc.stop(now + duration);
    });
  }

  dunkirkClock() {
    const c = this._getCtx();
    const ticks = 8;
    const interval = 0.18;

    for (let i = 0; i < ticks; i++) {
      const st = c.currentTime + i * interval;
      const isPitchHigh = i % 2 === 0;

      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isPitchHigh ? 1200 : 900, st);
      osc.frequency.exponentialRampToValueAtTime(100, st + 0.025);

      gain.gain.setValueAtTime(0.2, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.025);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(st);
      osc.stop(st + 0.03);
    }
  }

  cosmicDrone() {
    const c = this._getCtx();
    const now = c.currentTime;
    const duration = 2.8;

    const chords = [220, 277.18, 329.63, 440]; // A Major Ethereal Pad
    chords.forEach(f => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.linearRampToValueAtTime(f * 1.02, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + duration);
    });
  }

  trailerImpact() {
    const c = this._getCtx();
    const now = c.currentTime;
    const duration = 1.8;

    // Sub-boom
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, now);
    o.frequency.exponentialRampToValueAtTime(25, now + 0.5);

    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    o.connect(g);
    g.connect(c.destination);
    o.start(now);
    o.stop(now + duration);

    // Highpass Metallic Clang Noise
    const bufSize = c.sampleRate * 0.5;
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = c.createBufferSource();
    noise.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;

    const ng = c.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(hp);
    hp.connect(ng);
    ng.connect(c.destination);
    noise.start(now);
  }

  popcorn() {
    const c = this._getCtx();
    const count = 7;
    for (let i = 0; i < count; i++) {
      const startTime = c.currentTime + i * (0.06 + Math.random() * 0.04);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(600 + Math.random() * 800, startTime);
      o.frequency.exponentialRampToValueAtTime(150 + Math.random() * 100, startTime + 0.04);
      g.gain.setValueAtTime(0.12, startTime);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.04);
      o.connect(g);
      g.connect(c.destination);
      o.start(startTime);
      o.stop(startTime + 0.05);
    }
  }

  applause() {
    const c = this._getCtx();
    const duration = 1.8;
    const bufferSize = c.sampleRate * duration;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.01, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    noise.start();
    noise.stop(c.currentTime + duration);
  }

  drumroll() {
    const c = this._getCtx();
    const duration = 1.4;
    const ticks = 24;

    for (let i = 0; i < ticks; i++) {
      const t = c.currentTime + (i / ticks) * (duration - 0.2);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = 140 + (i / ticks) * 60;
      g.gain.setValueAtTime(0.08 + (i / ticks) * 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + 0.035);
    }

    // Cymbal Crash at end
    setTimeout(() => {
      const crashDuration = 1.2;
      const bSize = c.sampleRate * crashDuration;
      const buf = c.createBuffer(1, bSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;

      const crash = c.createBufferSource();
      crash.buffer = buf;

      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3500;

      const g = c.createGain();
      g.gain.setValueAtTime(0.2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + crashDuration);

      crash.connect(hp);
      hp.connect(g);
      g.connect(c.destination);
      crash.start();
    }, 1200);
  }

  fanfare() {
    const c = this._getCtx();
    const notes = [
      { f: 523.25, t: 0, d: 0.15 },    // C5
      { f: 659.25, t: 0.15, d: 0.15 }, // E5
      { f: 783.99, t: 0.3, d: 0.15 },  // G5
      { f: 1046.50, t: 0.45, d: 0.6 }  // C6
    ];

    notes.forEach(n => {
      const st = c.currentTime + n.t;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.value = n.f;

      g.gain.setValueAtTime(0.01, st);
      g.gain.linearRampToValueAtTime(0.12, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + n.d);

      o.connect(g);
      g.connect(c.destination);
      o.start(st);
      o.stop(st + n.d);
    });
  }

  cheer() {
    const c = this._getCtx();
    const duration = 1.5;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(300, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.5);
    o.frequency.exponentialRampToValueAtTime(400, c.currentTime + duration);

    g.gain.setValueAtTime(0.01, c.currentTime);
    g.gain.linearRampToValueAtTime(0.15, c.currentTime + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }

  sciFiLaser() {
    const c = this._getCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  horrorSting() {
    const c = this._getCtx();
    const now = c.currentTime;
    const duration = 1.2;

    [110, 116.54, 155.56, 233.08].forEach(freq => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 1.08, now + duration);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now);
      osc.stop(now + duration);
    });
  }
}
