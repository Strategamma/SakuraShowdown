type SoundType =
  | "turn"
  | "ready"
  | "notice"
  | "move"
  | "slash"
  | "victory"
  | "door"
  | "disconnect";

class SoundManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  unlock() {
    if (this.unlocked) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.ctx.resume?.();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
    this.unlocked = true;
  }

  play(type: SoundType) {
    if (!this.ctx || this.ctx.state === "suspended") return;
    const now = this.ctx.currentTime;
    switch (type) {
      case "turn":
        this.tone(660, now, 0.12, 0.12);
        this.tone(880, now + 0.12, 0.14, 0.12);
        break;
      case "move":
        this.tone(520, now, 0.08, 0.09);
        this.tone(640, now + 0.08, 0.1, 0.08);
        break;
      case "slash":
        this.noise(now, 0.14, 0.18, 1200, 600);
        this.toneSweep(900, 400, now, 0.12, 0.08);
        break;
      case "victory":
        this.tone(392, now, 0.16, 0.12);
        this.tone(523, now + 0.16, 0.16, 0.14);
        this.tone(659, now + 0.32, 0.18, 0.16);
        this.tone(784, now + 0.5, 0.22, 0.18);
        break;
      case "door":
        this.toneSweep(180, 320, now, 0.2, 0.12);
        this.noise(now + 0.05, 0.12, 0.08, 200, 600);
        break;
      case "disconnect":
        this.tone(300, now, 0.12, 0.12);
        this.tone(200, now + 0.12, 0.16, 0.12);
        break;
      case "ready":
        this.tone(440, now, 0.14, 0.12);
        this.tone(660, now + 0.14, 0.14, 0.12);
        this.tone(880, now + 0.28, 0.18, 0.13);
        break;
      case "notice":
      default:
        this.tone(520, now, 0.12, 0.1);
        break;
    }
  }

  private tone(freq: number, start: number, duration: number, peak = 0.12) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private toneSweep(
    fromFreq: number,
    toFreq: number,
    start: number,
    duration: number,
    peak = 0.12
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fromFreq, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, toFreq), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(
    start: number,
    duration: number,
    peak: number,
    filterFrom: number,
    filterTo: number
  ) {
    if (!this.ctx) return;
    const buffer = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * duration), this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFrom, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, filterTo), start + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
  }
}

export const sound = new SoundManager();
export type { SoundType };
