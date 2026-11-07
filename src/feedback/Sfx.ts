import type { SimEvent } from '../sim/events';

/** 펜타토닉: 연쇄 한 칸마다 음이 한 칸씩 올라가도 불협화음이 안 난다 */
const PENTA = [0, 2, 4, 7, 9];
const BASE_HZ = 160;
const MAX_STEP = 19;
const BLAST_MIN_GAP = 0.03;

/**
 * WebAudio 합성 효과음 (에셋 없이 시작하기 위한 임시 사운드).
 * 기획서: 연쇄 수에 따라 폭발음 피치가 한 칸씩 올라간다.
 * iOS 는 사용자 제스처 안에서 unlock() 해야 소리가 난다.
 */
export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastBlast = 0;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.ctx = ctx;
    this.master = master;
    this.noise = buf;
  }

  consume(events: readonly SimEvent[]): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    let step = -1;
    let big = false;
    for (const e of events) {
      switch (e.type) {
        case 'explosion':
          if (e.source === 'tap') big = true;
          step = Math.max(step, e.chainKills);
          break;
        case 'shieldBreak':
          this.tone(1800, 0.05, 'square', 0.08);
          break;
        case 'dryTap':
          this.tone(120, 0.05, 'square', 0.06);
          break;
        case 'leak':
          this.tone(70, 0.25, 'sawtooth', 0.35, 40);
          break;
        case 'bossKill':
          this.burst(0.6, 0.6, 500);
          this.tone(90, 0.6, 'triangle', 0.5, 40);
          break;
        case 'mult':
          // 배율 상승: 두 음 올라감
          this.tone(660, 0.08, 'triangle', 0.1);
          this.tone(990, 0.12, 'triangle', 0.1, undefined, 0.07);
          break;
        case 'overload':
          this.burst(0.35, 0.45, 300);
          this.tone(110, 0.3, 'sawtooth', 0.25, 50);
          break;
        case 'pairBlast':
          // 짝 폭발: 멀리서 울리는 두 번째 펑
          this.tone(520, 0.08, 'triangle', 0.12, 1040);
          break;
        case 'brink':
          this.tone(1500, 0.04, 'square', 0.05);
          break;
        case 'gaugeFull':
          // 게이지가 가득: 작게 "준비됨"
          this.tone(990, 0.05, 'sine', 0.05);
          break;
        case 'refund':
          // 충전이 돌아오는 짧은 상승음
          this.tone(1320, 0.06, 'square', 0.07, 1980);
          break;
        case 'levelUp':
          [0, 4, 7, 12].forEach((s, i) => this.tone(440 * 2 ** (s / 12), 0.12, 'triangle', 0.12, undefined, i * 0.05));
          break;
        case 'augment':
          this.tone(e.rarity === 'prism' ? 1320 : 880, 0.25, 'sine', 0.15);
          break;
        default:
          break;
      }
    }
    if (step >= 0) this.blast(step, big);
  }

  private blast(step: number, big: boolean): void {
    const now = this.ctx!.currentTime;
    if (now - this.lastBlast < BLAST_MIN_GAP) return;
    this.lastBlast = now;
    const s = Math.min(step, MAX_STEP);
    const semis = Math.floor(s / PENTA.length) * 12 + PENTA[s % PENTA.length];
    const hz = BASE_HZ * 2 ** (semis / 12);
    this.tone(hz, big ? 0.22 : 0.14, 'triangle', big ? 0.35 : 0.2, hz * 0.55);
    this.burst(big ? 0.25 : 0.1, big ? 0.35 : 0.15, 900 + hz);
  }

  private tone(hz: number, dur: number, type: OscillatorType, gain: number, endHz?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(hz, t);
    if (endHz) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
