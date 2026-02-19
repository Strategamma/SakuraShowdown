type SoundType =
  | "turn"
  | "turnRed"
  | "turnBlue"
  | "ready"
  | "ting"
  | "notice"
  | "info"
  | "warn"
  | "error"
  | "click"
  | "modalOpen"
  | "modalClose"
  | "toggle"
  | "select"
  | "deselect"
  | "swap"
  | "move"
  | "slash"
  | "impact"
  | "warning"
  | "victory"
  | "door"
  | "disconnect"
  | "footstep"
  | "question";

class SoundManager {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private ambienceTimer: number | null = null;

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
      case "turnRed":
        this.tone(520, now, 0.12, 0.12);
        this.tone(740, now + 0.12, 0.14, 0.12);
        break;
      case "turnBlue":
        this.tone(440, now, 0.12, 0.12);
        this.tone(640, now + 0.12, 0.14, 0.12);
        break;
      case "move":
        this.tone(520, now, 0.08, 0.09);
        this.tone(640, now + 0.08, 0.1, 0.08);
        break;
      case "slash":
        this.noise(now, 0.14, 0.18, 1200, 600);
        this.toneSweep(900, 400, now, 0.12, 0.08);
        break;
      case "impact":
        this.tone(180, now, 0.16, 0.16);
        this.noise(now + 0.02, 0.12, 0.1, 120, 260);
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
        this.tone(740, now, 0.14, 0.1);
        this.tone(980, now + 0.12, 0.16, 0.11);
        break;
      case "ting":
        this.tone(1200, now, 0.12, 0.12);
        break;
      case "click":
        this.tone(900, now, 0.06, 0.08);
        break;
      case "modalOpen":
        this.toneSweep(360, 620, now, 0.18, 0.1);
        break;
      case "modalClose":
        this.toneSweep(620, 320, now, 0.18, 0.1);
        break;
      case "toggle":
        this.tone(520, now, 0.08, 0.08);
        this.tone(780, now + 0.08, 0.1, 0.08);
        break;
      case "select":
        this.tone(820, now, 0.08, 0.08);
        break;
      case "deselect":
        this.tone(520, now, 0.07, 0.07);
        break;
      case "swap":
        this.noise(now, 0.12, 0.08, 900, 300);
        break;
      case "warning":
        this.toneSweep(520, 880, now, 0.2, 0.12);
        this.tone(1040, now + 0.18, 0.12, 0.08);
        break;
      case "footstep":
        this.noise(now, 0.08, 0.08, 120, 220);
        this.noise(now + 0.12, 0.08, 0.08, 120, 220);
        break;
      case "question":
        this.tone(520, now, 0.1, 0.1);
        this.tone(680, now + 0.1, 0.12, 0.1);
        this.tone(520, now + 0.22, 0.12, 0.09);
        break;
      case "info":
      case "notice":
      default:
        this.tone(520, now, 0.12, 0.1);
        break;
      case "warn":
        this.tone(460, now, 0.12, 0.1);
        this.tone(620, now + 0.12, 0.12, 0.1);
        break;
      case "error":
        this.tone(240, now, 0.14, 0.12);
        this.tone(180, now + 0.14, 0.16, 0.12);
        break;
    }
  }

  startAmbience() {
    if (!this.ctx || this.ambienceTimer !== null) return;
    const notes = [0, 3, 5, 7, 10];
    let index = 0;
    this.ambienceTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const step = notes[index % notes.length];
      const freq = 220 * Math.pow(2, step / 12);
      this.tone(freq, now, 0.4, 0.03);
      index += 1;
    }, 1800);
  }

  stopAmbience() {
    if (this.ambienceTimer !== null) {
      window.clearInterval(this.ambienceTimer);
      this.ambienceTimer = null;
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
