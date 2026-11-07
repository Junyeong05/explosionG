import { BALANCE } from '../data/balance';
import { EXPERIMENTS } from '../data/experiments';
import { TAU, clamp } from '../core/math';
import type { SimEvent } from '../sim/events';
import type { Enemy } from '../sim/types';
import type { World } from '../sim/World';
import type { GlowCache } from './fx/effects';
import { COLORS, rgba } from './palette';

const FW = BALANCE.field.width;
const FH = BALANCE.field.height;
const LINE_Y = BALANCE.field.defenseLineY;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';

/** 색 맞추기 색 (적 종류 색과 덜 겹치게 채도 높은 3색) */
export const EXP_COLORS = ['#ff4d6d', '#5dff7a', '#4da3ff'] as const;
const ICE = '#9fe8ff';
const FIRE = '#ff8a3c';

interface Flight {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dur: number;
  t: number;
}

interface Reveal {
  x: number;
  y: number;
  r: number;
  t: number;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

/**
 * 11-07 실험 묶음의 화면 표시. Renderer 가 정해진 자리에서 부른다.
 * sim 상태는 읽기만 하고, 일회성 연출(탄 비행·안개 걷힘·글자)은 이벤트로 만든다.
 */
export class ExpDraw {
  private flights: Flight[] = [];
  private reveals: Reveal[] = [];
  private pops: Pop[] = [];
  private rows: { y: number; half: number; t: number }[] = [];
  private beatPulse = 0;
  private time = 0;
  private fog: HTMLCanvasElement | null = null;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly glow: GlowCache,
  ) {}

  reset(): void {
    this.flights = [];
    this.reveals = [];
    this.pops = [];
    this.rows = [];
    this.beatPulse = 0;
  }

  consume(e: SimEvent): void {
    switch (e.type) {
      case 'launch':
        this.flights.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, dur: Math.max(0.01, e.dur), t: 0 });
        break;
      case 'explosion':
        if (this.reveals.length < 80) this.reveals.push({ x: e.x, y: e.y, r: e.radius + 30, t: 0 });
        break;
      case 'beat':
        this.beatPulse = 1;
        break;
      case 'beatShot':
        this.pop(e.x, e.y - 26, e.on ? 'PERFECT' : '엇박', e.on ? COLORS.gold : COLORS.dim);
        break;
      case 'sweetShot':
        this.pop(e.x, e.y - 26, '명당 ×2', COLORS.gold);
        break;
      case 'golden':
        this.pop(e.x, e.y - 20, e.ok ? '황금! 레벨 업' : '꽝 (탭으로 잡음)', e.ok ? COLORS.gold : COLORS.dim);
        break;
      case 'seed':
        this.pop(e.x, e.y - 14, '씨앗', '#9dff5a');
        break;
      case 'rowBlast':
        this.rows.push({ y: e.y, half: e.half, t: 0 });
        break;
      default:
        break;
    }
  }

  private pop(x: number, y: number, text: string, color: string): void {
    if (this.pops.length > 12) this.pops.shift();
    this.pops.push({ x, y, text, color, t: 0 });
  }

  update(dt: number): void {
    this.time += dt;
    this.beatPulse = Math.max(0, this.beatPulse - dt * 3);
    for (const f of this.flights) f.t += dt;
    this.flights = this.flights.filter((f) => f.t < f.dur);
    const hold = BALANCE.experiment.fog.holdSec;
    for (const r of this.reveals) r.t += dt;
    this.reveals = this.reveals.filter((r) => r.t < hold);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.9);
    for (const r of this.rows) r.t += dt;
    this.rows = this.rows.filter((r) => r.t < 0.35);
  }

  /** 적 아래 층: 명당 띠·코어·발사대·씨앗·지뢰 범위·자석 선·익는 폭발형 */
  drawUnder(w: World): void {
    const ctx = this.ctx;
    const r = w.rules;
    const E = BALANCE.experiment;
    if (r.sweet) {
      const top = w.exp.sweetTop();
      const grad = ctx.createLinearGradient(0, top, 0, top + E.sweet.height);
      grad.addColorStop(0, rgba(COLORS.gold, 0));
      grad.addColorStop(0.5, rgba(COLORS.gold, 0.16));
      grad.addColorStop(1, rgba(COLORS.gold, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, top, FW, E.sweet.height);
      ctx.strokeStyle = rgba(COLORS.gold, 0.45);
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, top);
      ctx.lineTo(FW, top);
      ctx.moveTo(0, top + E.sweet.height);
      ctx.lineTo(FW, top + E.sweet.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (r.core) {
      const C = E.core;
      const f = 0.5 + 0.5 * Math.sin(this.time * 3);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * f;
      const s = C.radius * 4;
      ctx.drawImage(this.glow.get(COLORS.line), C.x - s / 2, C.y - s / 2, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(C.x, C.y, C.radius, 0, TAU);
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = rgba(COLORS.line, 0.18);
      ctx.fill();
      ctx.font = `900 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.line;
      ctx.fillText('CORE', C.x, C.y + 4);
    }
    if (r.launcher) {
      const L = E.launcher;
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(0, -12);
      ctx.lineTo(14, 8);
      ctx.closePath();
      ctx.fillStyle = rgba(COLORS.charge, 0.25);
      ctx.fill();
      ctx.strokeStyle = COLORS.charge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    if (r.seeds) {
      for (const sd of w.exp.seeds) {
        const k = clamp(sd.ttl / E.seeds.ttl, 0, 1);
        const blink = sd.ttl < 2 && Math.floor(this.time * 6) % 2 === 0;
        ctx.beginPath();
        ctx.arc(sd.x, sd.y, E.seeds.radius, 0, TAU);
        ctx.strokeStyle = rgba('#9dff5a', 0.18 * k + 0.05);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(sd.x, sd.y, 5, 0, TAU);
        ctx.fillStyle = rgba('#9dff5a', blink ? 0.3 : 0.9);
        ctx.fill();
      }
    }
    if (r.mines) {
      for (const m of w.mines) {
        if (m.depth === undefined) continue;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, TAU);
        ctx.strokeStyle = rgba('#ff9a3c', m.armIn <= 0 ? 0.35 : 0.15);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, E.mines.trigger, 0, TAU);
        ctx.fillStyle = rgba('#ff9a3c', 0.12);
        ctx.fill();
      }
    }
    if (r.magnet || r.ripen) {
      for (const e of w.enemies) {
        if (e.dead || !e.def.deathBlast || e.def.boss) continue;
        if (r.ripen) {
          // 익는 폭발형: 지금 터지면 닿는 범위 (익을수록 진해짐)
          const R = E.ripen;
          const t = clamp((w.time - e.bornAt) / R.fullSec, 0, 1);
          const rad = w.stats.chainRadius * e.def.deathBlast.radiusMul * (R.from + (R.to - R.from) * t);
          ctx.beginPath();
          ctx.arc(e.x, e.y, rad, 0, TAU);
          ctx.strokeStyle = rgba(t >= 1 ? COLORS.gold : FIRE, 0.12 + 0.3 * t);
          ctx.lineWidth = 1 + t;
          ctx.stroke();
        }
        if (r.magnet) {
          ctx.beginPath();
          ctx.arc(e.x, e.y, E.magnet.range, 0, TAU);
          ctx.strokeStyle = rgba('#c77dff', 0.12 + 0.06 * Math.sin(this.time * 4 + e.id));
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  /** 적 한 마리 꾸밈 (색·얼음·불·황금·풍선) */
  decorate(e: Enemy, w: World): void {
    const ctx = this.ctx;
    const r = e.radius;
    if (e.color >= 0) {
      const c = EXP_COLORS[e.color % EXP_COLORS.length];
      ctx.beginPath();
      ctx.arc(e.x, e.y, Math.max(3, r * 0.42), 0, TAU);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 3, 0, TAU);
      ctx.strokeStyle = rgba(c, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (e.frozen > 0) {
      const k = clamp(e.frozen / BALANCE.experiment.freeze.sec, 0, 1);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 2, 0, TAU);
      ctx.fillStyle = rgba(ICE, 0.25 + 0.25 * k);
      ctx.fill();
      ctx.strokeStyle = rgba(ICE, 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (e.burn > 0) {
      const f = 0.5 + 0.5 * Math.sin(this.time * 20 + e.id * 1.7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + 0.3 * f;
      const s = r * 3;
      ctx.drawImage(this.glow.get(FIRE), e.x - s / 2, e.y - s / 2 - 3, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (e.golden) {
      const f = 0.5 + 0.5 * Math.sin(this.time * 6 + e.id);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 4 + f * 2, 0, TAU);
      ctx.strokeStyle = rgba(COLORS.gold, 0.7 + 0.3 * f);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    if (e.inflate > 0 && w.rules.inflate) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fillStyle = rgba('#ff7ad9', 0.08 * e.inflate);
      ctx.fill();
    }
  }

  /** 적 위 층: 불덩이·날아가는 탄·가로 띠·안개 */
  drawOver(w: World): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of w.exp.balls) {
      ctx.drawImage(this.glow.get(FIRE), b.x - 12, b.y - 12, 24, 24);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, TAU);
      ctx.fillStyle = '#ffe1a8';
      ctx.fill();
    }
    for (const f of this.flights) {
      const k = clamp(f.t / f.dur, 0, 1);
      const x = f.x1 + (f.x2 - f.x1) * k;
      const y = f.y1 + (f.y2 - f.y1) * k;
      ctx.strokeStyle = rgba(COLORS.charge, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x1 + (f.x2 - f.x1) * Math.max(0, k - 0.25), f.y1 + (f.y2 - f.y1) * Math.max(0, k - 0.25));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.drawImage(this.glow.get(COLORS.charge), x - 10, y - 10, 20, 20);
      // 도착 지점 표시
      ctx.beginPath();
      ctx.arc(f.x2, f.y2, 6 + 4 * (1 - k), 0, TAU);
      ctx.strokeStyle = rgba(COLORS.charge, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const rw of this.rows) {
      const k = 1 - rw.t / 0.35;
      ctx.fillStyle = rgba('#e8fbff', 0.35 * k);
      ctx.fillRect(0, rw.y - rw.half, FW, rw.half * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.pops) {
      const k = p.t / 0.9;
      ctx.globalAlpha = 1 - k;
      ctx.font = `900 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - k * 16);
    }
    ctx.globalAlpha = 1;
    if (w.rules.fog) this.drawFog(w);
  }

  /** 안개: 방어선 근처·폭발 자리·과충전 조준점만 보인다 (작은 캔버스에 칠하고 구멍을 지운 뒤 늘려 그림) */
  private drawFog(w: World): void {
    const F = BALANCE.experiment.fog;
    if (!this.fog) {
      this.fog = document.createElement('canvas');
      this.fog.width = FW / 2;
      this.fog.height = FH / 2;
    }
    const g = this.fog.getContext('2d')!;
    g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, FW, FH);
    g.fillStyle = 'rgba(8, 9, 16, 0.95)';
    g.fillRect(0, 0, FW, FH);
    g.globalCompositeOperation = 'destination-out';
    const clearTop = LINE_Y - F.clear;
    const grad = g.createLinearGradient(0, clearTop - 30, 0, clearTop + 20);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = grad;
    g.fillRect(0, clearTop - 30, FW, FH);
    const hole = (x: number, y: number, r: number, a: number) => {
      const rg = g.createRadialGradient(x, y, r * 0.5, x, y, r);
      rg.addColorStop(0, `rgba(0,0,0,${a})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const r of this.reveals) hole(r.x, r.y, r.r, 1 - r.t / F.holdSec);
    const c = w.charging;
    if (c) hole(c.x, c.y, 60, 1);
    this.ctx.drawImage(this.fog, 0, 0, FW, FH);
  }

  /** HUD: 켠 실험 번호, 탭 색, 박자, 바람, 시간 멈춤 */
  drawHud(w: World): void {
    const ctx = this.ctx;
    const r = w.rules;
    const on = EXPERIMENTS.filter((x) => r[x.id]);
    if (on.length > 0) {
      ctx.font = `700 9px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(`실험 ${on.map((x) => `${x.no}.${x.name}`).join(' · ')}`, 12, 44);
    }
    const gy = 598;
    const gx = FW / 2 - 75 + 10 - 20;
    if (r.colors) {
      // 다음 탭 색 (큰 원) + 그다음 색 (작은 원)
      const n = BALANCE.experiment.colors.count;
      const c0 = EXP_COLORS[w.exp.tapColor % n];
      const c1 = EXP_COLORS[(w.exp.tapColor + 1) % n];
      ctx.beginPath();
      ctx.arc(gx - 30, gy, 9, 0, TAU);
      ctx.fillStyle = c0;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx - 40, gy - 13, 4.5, 0, TAU);
      ctx.fillStyle = rgba(c1, 0.7);
      ctx.fill();
      ctx.font = `700 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('탭 색', gx - 30, gy + 20);
    }
    if (r.beat) {
      const P = BALANCE.experiment.beat.period;
      const ph = (w.time % P) / P;
      // 다음 박자까지 줄어드는 고리 (0 이 되는 순간이 박자)
      ctx.beginPath();
      ctx.arc(gx, gy, 12 + 14 * (1 - ph), 0, TAU);
      ctx.strokeStyle = rgba(COLORS.gold, 0.25 + 0.5 * ph);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (this.beatPulse > 0) {
        ctx.fillStyle = rgba(COLORS.gold, 0.08 * this.beatPulse);
        ctx.fillRect(0, 0, FW, FH);
        ctx.strokeStyle = rgba(COLORS.gold, 0.6 * this.beatPulse);
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, FW - 3, FH - 3);
      }
    }
    if (r.wind) {
      const v = w.exp.wind;
      const len = (v / BALANCE.experiment.wind.speed) * 40;
      const y = 66;
      ctx.strokeStyle = rgba('#9fe8ff', 0.7);
      ctx.fillStyle = rgba('#9fe8ff', 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(FW / 2 - len, y);
      ctx.lineTo(FW / 2 + len, y);
      ctx.stroke();
      if (Math.abs(len) > 4) {
        const d = Math.sign(len);
        ctx.beginPath();
        ctx.moveTo(FW / 2 + len, y);
        ctx.lineTo(FW / 2 + len - d * 7, y - 5);
        ctx.lineTo(FW / 2 + len - d * 7, y + 5);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 탭이 하는 일이 바뀌는 규칙은 게이지 위에 한 줄
    const hint =
      r.mines ? '탭 = 지뢰 심기'
      : r.seeds && w.gauge < 1 ? `100% 전 탭 = 씨앗 심기 (게이지 ${Math.round(BALANCE.experiment.seeds.cost * 100)}%)`
      : r.freeze && w.gauge < 1 ? '100% 전 탭 = 얼리기 (피해 없음)'
      : '';
    if (hint) {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = r.freeze ? ICE : r.seeds ? '#9dff5a' : '#ff9a3c';
      ctx.fillText(hint, FW / 2 + 10, gy - 12);
    }
    if (r.stopTime && !w.charging && w.phase === 'playing') {
      ctx.font = `900 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(COLORS.charge, 0.55 + 0.25 * Math.sin(this.time * 4));
      ctx.fillText('II  멈춤 — 누르는 동안만 시간이 흐른다', FW / 2, LINE_Y - 14);
    }
  }
}
