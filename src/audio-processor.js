/**
 * Web Audio DSP — Smooth vocal clarity, noise filter, gain control, level meter.
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
    this.threshold = -30;
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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }

    this.source = this.ctx.createMediaStreamSource(rawStream);

    // Highpass filter — removes sub-bass room rumble without cutting speech
    this.hp = this.ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = this.enabled ? 65 : 10;

    // Dynamics compressor — smooth broadcast vocal leveling (no aggressive gating!)
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = this.enabled ? this.threshold : 0;
    this.comp.knee.value = 30;
    this.comp.ratio.value = this.enabled ? 2.5 : 1;
    this.comp.attack.value = 0.02; // 20ms attack for natural transients
    this.comp.release.value = 0.15; // 150ms release

    // Gain node
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.gainVal;

    // Analyser for VU meter
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Output destination stream
    this.dest = this.ctx.createMediaStreamDestination();

    // Connect audio node chain
    this.source.connect(this.hp);
    this.hp.connect(this.comp);
    this.comp.connect(this.gain);
    this.gain.connect(this.analyser);
    this.analyser.connect(this.dest);

    const processedAudioTrack = this.dest.stream.getAudioTracks()[0];
    return new MediaStream([processedAudioTrack, ...rawStream.getVideoTracks()]);
  }

  toggle(on) {
    this.enabled = on;
    if (this.hp && this.comp) {
      this.hp.frequency.value = on ? 65 : 10;
      this.comp.threshold.value = on ? this.threshold : 0;
      this.comp.ratio.value = on ? 2.5 : 1;
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
