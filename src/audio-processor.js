/**
 * Web Audio DSP Engine — Broadcast vocal clarity, 3-band EQ, noise filter, gain control, level meter.
 */
export class AudioDSP {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.hp = null;
    this.eqBass = null;
    this.eqMid = null;
    this.eqTreble = null;
    this.comp = null;
    this.gain = null;
    this.delay = null;
    this.analyser = null;
    this.dest = null;
    this.enabled = true;
    this.threshold = -30;
    this.gainVal = 1.0;
    this.delaySec = 0;
    this.bassGain = 0;
    this.midGain = 0;
    this.trebleGain = 0;
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

    // 1. Highpass filter — removes sub-bass room rumble
    this.hp = this.ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = this.enabled ? 65 : 10;

    // 2. 3-Band Cinema Equalizer
    this.eqBass = this.ctx.createBiquadFilter();
    this.eqBass.type = 'lowshelf';
    this.eqBass.frequency.value = 90;
    this.eqBass.gain.value = this.bassGain;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1.0;
    this.eqMid.gain.value = this.midGain;

    this.eqTreble = this.ctx.createBiquadFilter();
    this.eqTreble.type = 'highshelf';
    this.eqTreble.frequency.value = 6000;
    this.eqTreble.gain.value = this.trebleGain;

    // 3. Dynamics compressor — broadcast vocal leveling
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = this.enabled ? this.threshold : 0;
    this.comp.knee.value = 30;
    this.comp.ratio.value = this.enabled ? 2.5 : 1;
    this.comp.attack.value = 0.02;
    this.comp.release.value = 0.15;

    // 4. Gain node
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.gainVal;

    // 5. Delay Node for audio lip-sync alignment
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = this.delaySec;

    // 6. Analyser for VU meter
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // 7. Output destination stream
    this.dest = this.ctx.createMediaStreamDestination();

    // Connect audio node chain: source -> hp -> eqBass -> eqMid -> eqTreble -> comp -> gain -> delay -> analyser -> dest
    this.source.connect(this.hp);
    this.hp.connect(this.eqBass);
    this.eqBass.connect(this.eqMid);
    this.eqMid.connect(this.eqTreble);
    this.eqTreble.connect(this.comp);
    this.comp.connect(this.gain);
    this.gain.connect(this.delay);
    this.delay.connect(this.analyser);
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

  setDelay(ms) {
    this.delaySec = Math.max(0, ms / 1000);
    if (this.delay) this.delay.delayTime.value = this.delaySec;
  }

  setEQ(bass, mid, treble) {
    this.bassGain = bass;
    this.midGain = mid;
    this.trebleGain = treble;
    if (this.eqBass) this.eqBass.gain.value = bass;
    if (this.eqMid) this.eqMid.gain.value = mid;
    if (this.eqTreble) this.eqTreble.gain.value = treble;
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
