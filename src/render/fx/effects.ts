import { CappedList } from '../../core/pool';
import { TAU, easeOutCubic } from '../../core/math';
import { rgba } from '../palette';

/**
 * 연출 전용 효과들. 전부 고정 용량(CappedList)이라 후반에 폭발이 수백 개 터져도 메모리·그리기 비용이 상한을 넘지 않는다.
 * 연출이라 Math.random 을 써도 된다 (sim 결정론과 무관).
 */

/** 색별 방사형 글로우 스프라이트 캐시. shadowBlur 대신 써서 모바일에서도 가볍게 */
export class GlowCache {
  private readonly cache = new Map<string, HTMLCanvasElement>();

  get(color: string): HTMLCanvasElement {
    let c = this.cache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, rgba(color, 1));
      grad.addColorStop(0.25, rgba(color, 0.5));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.cache.set(color, c);
    }
    return c;
  }
}

interface Ring {
  alive: boolean;
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  life: number;
  color: string;
  width: number;
}

export class Rings {
  private readonly list: CappedList<Ring>;

  constructor(capacity: number) {
    this.list = new CappedList(capacity, () => ({ alive: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, life: 1, color: '#fff', width: 1 }));
  }

  add(x: number, y: number, r0: number, r1: number, color: string, life: number, width: number): void {
    const r = this.list.spawn();
    r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.t = 0; r.life = life; r.color = color; r.width = width;
  }

  update(dt: number): void {
    for (const r of this.list.items) {
      if (!r.alive) continue;
      r.t += dt;
      if (r.t >= r.life) r.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, glow: GlowCache): void {
    for (const r of this.list.items) {
      if (!r.alive) continue;
      const p = r.t / r.life;
      const rr = r.r0 + (r.r1 - r.r0) * easeOutCubic(p);
      if (p < 0.45) {
        ctx.globalAlpha = (1 - p / 0.45) * 0.85;
        const s = rr * 2.4;
        ctx.drawImage(glow.get(r.color), r.x - s / 2, r.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - p * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rr, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const r of this.list.items) r.alive = false;
  }
}

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
}

export class Particles {
  private readonly list: CappedList<Particle>;
  private readonly colors = new Set<string>();

  constructor(capacity: number) {
    this.list = new CappedList(capacity, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, color: '#fff' }));
  }

  burst(x: number, y: number, count: number, color: string, speedMin: number, speedMax: number, life: number): void {
    this.colors.add(color);
    for (let i = 0; i < count; i++) {
      const p = this.list.spawn();
      const a = Math.random() * TAU;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.t = 0;
      p.life = life * (0.6 + Math.random() * 0.6);
      p.color = color;
    }
  }

  update(dt: number): void {
    const drag = Math.exp(-4 * dt);
    for (const p of this.list.items) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= drag;
      p.vy *= drag;
    }
  }

  /** 색 × 알파 4단계로 묶어서 한 번에 stroke (드로우콜 절약) */
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const color of this.colors) {
      for (let band = 0; band < 4; band++) {
        let any = false;
        ctx.beginPath();
        for (const p of this.list.items) {
          if (!p.alive || p.color !== color) continue;
          const k = 1 - p.t / p.life;
          if (Math.min(3, Math.floor(k * 4)) !== band) continue;
          any = true;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        }
        if (!any) continue;
        ctx.globalAlpha = (band + 1) / 4;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (this.colors.size > 48) this.colors.clear();
  }

  clear(): void {
    for (const p of this.list.items) p.alive = false;
  }
}

interface DamageNumber {
  alive: boolean;
  x: number;
  y: number;
  value: number;
  t: number;
  crit: boolean;
  color: string;
}

const NUMBER_LIFE = 0.65;
const MERGE_WINDOW = 0.15;
const MERGE_DIST2 = 26 * 26;

/** 피해 숫자 합치기: 가까운 곳에서 짧은 시간 안에 난 피해는 숫자 하나로 (기획서 성능 항목) */
export class DamageNumbers {
  private readonly list: CappedList<DamageNumber>;

  constructor(capacity: number) {
    this.list = new CappedList(capacity, () => ({ alive: false, x: 0, y: 0, value: 0, t: 0, crit: false, color: '' }));
  }

  /** color: 낸 무기 갈래 색 (도파민 모드, 비면 흰색). 색이 다른 숫자끼리는 안 합친다 */
  add(x: number, y: number, value: number, crit: boolean, color = ''): void {
    for (const n of this.list.items) {
      if (!n.alive || n.t > MERGE_WINDOW || n.color !== color) continue;
      const dx = n.x - x;
      const dy = n.y - y;
      if (dx * dx + dy * dy <= MERGE_DIST2) {
        n.value += value;
        n.crit ||= crit;
        return;
      }
    }
    const n = this.list.spawn();
    n.x = x; n.y = y; n.value = value; n.t = 0; n.crit = crit; n.color = color;
  }

  update(dt: number): void {
    for (const n of this.list.items) {
      if (!n.alive) continue;
      n.t += dt;
      if (n.t >= NUMBER_LIFE) n.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D, font: string): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    for (const n of this.list.items) {
      if (!n.alive) continue;
      const p = n.t / NUMBER_LIFE;
      ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.font = n.crit ? `900 15px ${font}` : `800 11px ${font}`;
      const y = n.y - 22 * easeOutCubic(p);
      const text = String(Math.max(1, Math.round(n.value)));
      ctx.strokeText(text, n.x, y);
      ctx.fillStyle = n.crit ? '#ffd36b' : n.color || '#f2f4fa';
      ctx.fillText(text, n.x, y);
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const n of this.list.items) n.alive = false;
  }
}

interface Bolt {
  alive: boolean;
  pts: Float32Array;
  t: number;
  life: number;
  color: string;
}

const BOLT_POINTS = 7;

export class Bolts {
  private readonly list: CappedList<Bolt>;

  constructor(capacity: number) {
    this.list = new CappedList(capacity, () => ({ alive: false, pts: new Float32Array(BOLT_POINTS * 2), t: 0, life: 1, color: '#fff' }));
  }

  add(x1: number, y1: number, x2: number, y2: number, color: string, life: number): void {
    const b = this.list.spawn();
    const len = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / (len || 1);
    const ny = (x2 - x1) / (len || 1);
    for (let i = 0; i < BOLT_POINTS; i++) {
      const k = i / (BOLT_POINTS - 1);
      const j = i === 0 || i === BOLT_POINTS - 1 ? 0 : (Math.random() * 2 - 1) * Math.min(14, len * 0.08);
      b.pts[i * 2] = x1 + (x2 - x1) * k + nx * j;
      b.pts[i * 2 + 1] = y1 + (y2 - y1) * k + ny * j;
    }
    b.t = 0;
    b.life = life;
    b.color = color;
  }

  update(dt: number): void {
    for (const b of this.list.items) {
      if (!b.alive) continue;
      b.t += dt;
      if (b.t >= b.life) b.alive = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.lineJoin = 'round';
    for (const b of this.list.items) {
      if (!b.alive) continue;
      ctx.globalAlpha = 1 - b.t / b.life;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.pts[0], b.pts[1]);
      for (let i = 1; i < BOLT_POINTS; i++) ctx.lineTo(b.pts[i * 2], b.pts[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    for (const b of this.list.items) b.alive = false;
  }
}

/** 트라우마 방식 화면 흔들림: 폭발 크기에 비례해 쌓이고 빠르게 식는다 */
export class Shake {
  trauma = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
  }

  offset(maxPx: number): [number, number] {
    const s = this.trauma * this.trauma * maxPx;
    return [(Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s];
  }
}
