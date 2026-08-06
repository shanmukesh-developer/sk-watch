/**
 * Web Audio DSP — Noise gate, highpass filter, gain control, level meter.
 */
export class AudioDSP {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.hp = null;
    this.comp = null;
    this.gain = null;
    this.analyser = null;
    this.dest = null;
    this.enabled = true;
    this.threshold = -45;
    this.gainVal = 1.0;
  }

  cleanup() {
    if (this.source) {
      try { this.source.disconnect(); } catch (e) {}
      this.source = null;
    }
  }

  async process(rawStream) {
    const track = rawStream.getAudioTracks()[0];
    if (!track) return rawStream;

    this.cleanup();

    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    this.source = this.ctx.createMediaStreamSource(rawStream);

    // Highpass — kill room hum below 85Hz
    this.hp = this.ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = this.enabled ? 85 : 10;

    // Compressor — acts as noise gate
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = this.enabled ? this.threshold : -100;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.25;

    // Gain
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.gainVal;

    // Analyser for VU meter
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    // Output
    this.dest = this.ctx.createMediaStreamDestination();

    // Connect chain
    this.source.connect(this.hp);
    this.hp.connect(this.comp);
    this.comp.connect(this.gain);
    this.gain.connect(this.analyser);
    this.analyser.connect(this.dest);

    const processed = this.dest.stream.getAudioTracks()[0];
    return new MediaStream([processed, ...rawStream.getVideoTracks()]);
  }

  toggle(on) {
    this.enabled = on;
    if (this.hp && this.comp) {
      this.hp.frequency.value = on ? 85 : 10;
      this.comp.threshold.value = on ? this.threshold : -100;
    }
  }

  setThreshold(db) {
    this.threshold = db;
    if (this.comp && this.enabled) this.comp.threshold.value = db;
  }

  setGain(v) {
    this.gainVal = v;
    if (this.gain) this.gain.gain.value = v;
  }

  getLevel() {
    if (!this.analyser) return 0;
    const d = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(d);
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i];
    return Math.min(100, Math.round((sum / d.length / 255) * 250));
  }
}
