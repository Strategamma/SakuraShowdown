type SoundType =
  | "turn"
  | "ready"
  | "notice"
  | "move"
  | "capture"
  | "victory"
  | "join"
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
      case "capture":
        this.tone(320, now, 0.12, 0.12);
        this.tone(220, now + 0.1, 0.16, 0.14);
        break;
      case "victory":
        this.tone(440, now, 0.16, 0.12);
        this.tone(660, now + 0.16, 0.16, 0.14);
        this.tone(880, now + 0.32, 0.22, 0.16);
        break;
      case "join":
        this.tone(740, now, 0.12, 0.1);
        this.tone(940, now + 0.12, 0.12, 0.1);
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
}

export const sound = new SoundManager();
export type { SoundType };
