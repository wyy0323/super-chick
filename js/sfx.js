/* 音效：全部由 WebAudio 实时合成，零音频文件依赖 */
(function (global) {
  'use strict';

  const Sfx = {
    ctx: null,
    muted: false,
    _noise: null,

    ensure: function () {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        try {
          this.ctx = new AC();
        } catch (e) {
          return null;
        }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },

    tone: function (freq, dur, opts) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      opts = opts || {};
      const t0 = ctx.currentTime + (opts.delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
      const peak = opts.gain == null ? 0.11 : opts.gain;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },

    noise: function (dur, gainValue, delay, cutoff) {
      if (this.muted) return;
      const ctx = this.ensure();
      if (!ctx) return;
      if (!this._noise) {
        const len = Math.floor(ctx.sampleRate * 0.5);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noise = buf;
      }
      const t0 = ctx.currentTime + (delay || 0);
      const src = ctx.createBufferSource();
      src.buffer = this._noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff || 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gainValue == null ? 0.05 : gainValue, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },

    pickup: function () {
      this.tone(700, 0.08, { type: 'sine', gain: 0.1 });
      this.tone(1050, 0.12, { type: 'sine', gain: 0.08, delay: 0.055 });
      this.noise(0.08, 0.03, 0, 2400);
    },

    warn: function () {
      this.tone(210, 0.1, { type: 'square', gain: 0.06 });
      this.tone(210, 0.1, { type: 'square', gain: 0.06, delay: 0.16 });
    },

    lose: function () {
      this.tone(320, 0.28, { type: 'sawtooth', gain: 0.1, to: 90 });
      this.noise(0.22, 0.05, 0.02, 900);
    },

    over: function () {
      this.tone(520, 0.16, { type: 'triangle', gain: 0.1 });
      this.tone(392, 0.18, { type: 'triangle', gain: 0.09, delay: 0.14 });
      this.tone(262, 0.36, { type: 'triangle', gain: 0.09, delay: 0.3 });
      this.noise(0.3, 0.04, 0.3, 700);
    },

    start: function () {
      this.tone(523, 0.1, { type: 'triangle', gain: 0.08 });
      this.tone(659, 0.1, { type: 'triangle', gain: 0.08, delay: 0.08 });
      this.tone(784, 0.16, { type: 'triangle', gain: 0.09, delay: 0.16 });
    }
  };

  global.Sfx = Sfx;
})(window);
