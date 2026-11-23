"use strict";

/* =========================================================================
   3. MOTOR DE AUDIO PROCEDURAL (WEB AUDIO API SIN ARCHIVOS EXTERNOS)
========================================================================= */
class CosmicAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
  playTone(freq, endFreq, duration, type = "sine", volume = 0.12, delay = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
  star(combo = 0) {
    const semitone = Math.min(combo, 12);
    const base = 587.33 * Math.pow(2, semitone / 24);
    this.playTone(base, base * 1.45, 0.14, "triangle", 0.11);
  }
  jump() {
    this.playTone(260, 560, 0.16, "sine", 0.1);
  }
  slide() {
    this.playTone(340, 140, 0.15, "sine", 0.08);
  }
  lane() {
    this.playTone(420, 500, 0.07, "sine", 0.05);
  }
  powerup() {
    this.playTone(523.25, 523.25, 0.12, "triangle", 0.11, 0);
    this.playTone(659.25, 659.25, 0.12, "triangle", 0.11, 0.07);
    this.playTone(783.99, 1046.5, 0.24, "sine", 0.12, 0.14);
  }
  shieldBreak() {
    this.playTone(680, 220, 0.28, "sawtooth", 0.1);
    this.playTone(920, 1240, 0.25, "sine", 0.11, 0.05);
  }
  letter(i = 0) {
    const f = 523.25 * Math.pow(2, i / 6);
    this.playTone(f, f * 1.5, 0.18, "triangle", 0.13);
    this.playTone(f * 2, f * 2, 0.14, "sine", 0.06, 0.05);
  }
  word() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.playTone(f, f, 0.22, "triangle", 0.12, i * 0.075));
    this.playTone(2093, 2093, 0.5, "sine", 0.08, 0.5);
  }
  rocket() {
    this.playTone(110, 760, 0.7, "sawtooth", 0.1);
    this.playTone(220, 1200, 0.6, "square", 0.04, 0.05);
    this.playTone(660, 1320, 0.25, "sine", 0.1, 0.45);
  }
  planetWarp() {
    this.playTone(293.66, 587.33, 0.45, "sine", 0.09, 0);
    this.playTone(440, 880, 0.42, "triangle", 0.07, 0.09);
    this.playTone(659.25, 1174.66, 0.48, "sine", 0.08, 0.18);
  }
  shoot() {
    this.playTone(520, 1250, 0.16, "triangle", 0.12);
    this.playTone(1040, 1560, 0.12, "sine", 0.07, 0.04);
  }
  ammo() {
    this.playTone(660, 990, 0.12, "sine", 0.1);
    this.playTone(990, 1320, 0.12, "triangle", 0.08, 0.06);
  }
  bossAppear() {
    this.playTone(90, 55, 0.9, "sawtooth", 0.12);
    this.playTone(130, 70, 0.8, "square", 0.05, 0.1);
  }
  bossAttack() {
    this.playTone(180, 90, 0.25, "sawtooth", 0.08);
  }
  bossHit() {
    this.playTone(300, 120, 0.3, "square", 0.09);
    this.playTone(880, 1760, 0.22, "triangle", 0.11, 0.05);
  }
  bossDefeat() {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => this.playTone(f, f * 1.02, 0.28, "triangle", 0.12, i * 0.08));
  }
  crash() {
    this.playTone(240, 68, 0.42, "sawtooth", 0.13);
    this.playTone(170, 55, 0.48, "triangle", 0.12, 0.04);
  }
}

const audio = new CosmicAudio();
