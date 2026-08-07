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
    this.voiceFxNode = null;
    this.reverbNode = null;
    this.pannerNode = null;
    this.currentVoiceFx = 'normal';
  }

  cleanup() {
    const nodes = [this.source, this.hp, this.eqBass, this.eqMid, this.eqTreble, this.voiceFxNode, this.comp, this.gain, this.delay, this.pannerNode, this.analyser];
    nodes.forEach(n => {
      if (n) {
        try { n.disconnect(); } catch (e) {}
      }
    });
    this.source = null;
    this.voiceFxNode = null;
  }

  async process(rawStream) {
    const track = rawStream.getAudioTracks()[0];
    if (!track) return rawStream;

    this.cleanup();

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      try {
        this.ctx = new AudioCtx({ sampleRate: 48000, latencyHint: 'interactive' });
      } catch (e) {
        this.ctx = new AudioCtx();
      }
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

    // 3. Voice FX Node (Biquad / Bandpass / Shifter filter chain)
    this.voiceFxNode = this.ctx.createBiquadFilter();
    this.applyVoiceFx(this.currentVoiceFx);

    // 4. Dynamics compressor — broadcast vocal leveling
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = this.enabled ? this.threshold : 0;
    this.comp.knee.value = 30;
    this.comp.ratio.value = this.enabled ? 2.5 : 1;
    this.comp.attack.value = 0.02;
    this.comp.release.value = 0.15;

    // 5. Gain node
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.gainVal;

    // 6. Delay Node for audio lip-sync alignment
    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = this.delaySec;

    // 7. Stereo Panner Node (Spatial positioning)
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.pan.value = 0;
    }

    // 8. Analyser for VU meter
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // 9. Output destination stream
    this.dest = this.ctx.createMediaStreamDestination();

    // Connect audio node chain: source -> hp -> eqBass -> eqMid -> eqTreble -> voiceFx -> comp -> gain -> delay -> [panner] -> analyser -> dest
    this.source.connect(this.hp);
    this.hp.connect(this.eqBass);
    this.eqBass.connect(this.eqMid);
    this.eqMid.connect(this.eqTreble);
    this.eqTreble.connect(this.voiceFxNode);
    this.voiceFxNode.connect(this.comp);
    this.comp.connect(this.gain);
    this.gain.connect(this.delay);

    if (this.pannerNode) {
      this.delay.connect(this.pannerNode);
      this.pannerNode.connect(this.analyser);
    } else {
      this.delay.connect(this.analyser);
    }
    this.analyser.connect(this.dest);

    const processedAudioTrack = this.dest.stream.getAudioTracks()[0];
    return new MediaStream([processedAudioTrack, ...rawStream.getVideoTracks()]);
  }

  setVoiceFX(mode) {
    this.currentVoiceFx = mode;
    this.applyVoiceFx(mode);
  }

  applyVoiceFx(mode) {
    if (!this.voiceFxNode) return;
    switch (mode) {
      case 'deep':
        this.voiceFxNode.type = 'lowshelf';
        this.voiceFxNode.frequency.value = 250;
        this.voiceFxNode.Q.value = 1.0;
        this.voiceFxNode.gain.value = 12;
        break;
      case 'telephone':
        this.voiceFxNode.type = 'bandpass';
        this.voiceFxNode.frequency.value = 1800;
        this.voiceFxNode.Q.value = 2.5;
        this.voiceFxNode.gain.value = 0;
        break;
      case 'robot':
        this.voiceFxNode.type = 'peaking';
        this.voiceFxNode.frequency.value = 440;
        this.voiceFxNode.Q.value = 8;
        this.voiceFxNode.gain.value = 15;
        break;
      case 'radio':
        this.voiceFxNode.type = 'highpass';
        this.voiceFxNode.frequency.value = 800;
        this.voiceFxNode.Q.value = 1.0;
        this.voiceFxNode.gain.value = 0;
        break;
      case 'normal':
      default:
        this.voiceFxNode.type = 'allpass';
        this.voiceFxNode.frequency.value = 1000;
        this.voiceFxNode.Q.value = 1.0;
        this.voiceFxNode.gain.value = 0;
        break;
    }
  }

  setPan(panVal) { // -1 (left) to +1 (right)
    if (this.pannerNode) {
      this.pannerNode.pan.value = Math.max(-1, Math.min(1, panVal));
    }
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

  toggleNightMode(on) {
    this.nightMode = on;
    if (this.comp) {
      if (on) {
        this.comp.threshold.value = -45;
        this.comp.knee.value = 40;
        this.comp.ratio.value = 6.0;
        this.comp.attack.value = 0.005;
        this.comp.release.value = 0.05;
      } else {
        this.comp.threshold.value = this.enabled ? this.threshold : 0;
        this.comp.knee.value = 30;
        this.comp.ratio.value = this.enabled ? 2.5 : 1;
        this.comp.attack.value = 0.02;
        this.comp.release.value = 0.15;
      }
    }
  }

  getLevel() {
    if (!this.analyser) return 0;
    if (!this.levelDataArray || this.levelDataArray.length !== this.analyser.frequencyBinCount) {
      this.levelDataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    this.analyser.getByteFrequencyData(this.levelDataArray);
    let sum = 0;
    for (let i = 0; i < this.levelDataArray.length; i++) sum += this.levelDataArray[i];
    return Math.min(100, Math.round((sum / this.levelDataArray.length / 255) * 250));
  }
}
