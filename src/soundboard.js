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
    }
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
}
