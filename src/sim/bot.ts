import { getAugment, type Rarity } from '../data/augments';
import { BALANCE } from '../data/balance';
import { dist2 } from '../core/math';
import { Rng } from '../core/rng';
import type { Command, Enemy } from './types';
import type { World } from './World';

export type PickStrategy = 'random' | 'rarity';

export interface BotOptions {
  seed: number;
  /** 탭 사이 최소 간격 (사람 반응 속도 흉내) */
  reactionSec?: number;
  /** 급하지 않으면 게이지가 이만큼 찰 때까지 모은다 (1 = 100%) */
  fireAt?: number;
  /** 다 모였어도 이 점수 이상 모인 곳이 있어야 탭 (게이지가 상한이면 무시) */
  minClusterScore?: number;
  pick?: PickStrategy;
  /**
   * 쏘기로 정한 뒤 실제로 누르기까지 지연 [최소, 최대] 초 (사람 손 흉내).
   * 과충전처럼 타이밍이 중요한 규칙을 볼 때 쓴다. 없으면 바로 누름.
   */
  pressDelay?: [number, number];
  /** 과충전 규칙: 평소 이만큼까지 누르고 있다가 뗀다 (기본 1 = 과충전 안 함) */
  overchargeAt?: number;
  /** 과충전 규칙: 떼는 타이밍 오차 ± 초 (사람 손 흉내, 기본 0.07) */
  holdJitter?: number;
  /** 과충전 규칙: 적이 내려와 압박이 있으면 overchargeAt 대신 100% 에서 쏜다 */
  overchargeAdaptive?: boolean;
  /** 연쇄 잇기 규칙: 콤보가 minKills 이상이고 곧 끊기려 하면(timerBelow) 게이지 minGauge 이상이면 바로 쏴서 잇는다 */
  comboExtend?: { minKills: number; minGauge: number; timerBelow: number };
  /** 벼랑 끝 규칙: 급하지 않으면 방어선 가까이 내려온 무리만 노린다 */
  brinkGreed?: boolean;
  /**
   * 불씨 칠하기 규칙: 누르고 있는 동안 어떻게 끄나.
   *   none: 안 끔, ring: 늘 목표 둘레를 한 바퀴 칠하고 돌아와서 뗌, smart: 둘레에 칠할 적이 3마리 이상일 때만 ring
   */
  paint?: 'none' | 'ring' | 'smart';
  /** 짝 폭발형 규칙: 짝이 있는 폭발형을 맞히면 짝 자리 주변 적까지 점수에 넣는다 */
  pairAware?: boolean;
}

/** 과충전: 100% 에서 level 까지 누르고 있어야 하는 시간 (World.updateGauge 의 가속 곡선을 적분) */
function overchargeHoldSec(w: World, level: number): number {
  const OC = BALANCE.experiment.overcharge;
  const span = OC.max - 1;
  const t = Math.min(1, Math.max(0, (level - 1) / span));
  return ((w.stats.gaugeFillSec * span) / OC.accel) * Math.log(1 + OC.accel * t);
}

function pathLength(from: { x: number; y: number }, path: readonly { x: number; y: number }[]): number {
  let len = 0;
  let p = from;
  for (const q of path) {
    len += Math.hypot(q.x - p.x, q.y - p.y);
    p = q;
  }
  return len;
}

const RARITY_SCORE: Record<Rarity, number> = { normal: 1, rare: 2, epic: 3, prism: 5 };
/** 방어선에서 이 거리 안으로 들어온 적이 있으면 급함 */
const DANGER_DIST = 70;
/** 급할 때는 게이지가 이만큼만 있어도 쏜다 */
const URGENT_FIRE = 0.5;
/** 초신성(과충전)이면 상한까지 기다리지 않고 이만큼에서 쏜다 */
const OVERFILL_FIRE = 1.8;
/** 과충전 적응 정책: 방어선에서 이 거리 안에 적이 있으면 압박 */
const PRESSURE_DIST = 170;
/** 벼랑 끝 욕심 정책: 가득 찬 채 이 시간 넘게 기다렸으면 아무 데나 쏜다 */
const BRINK_PATIENCE = 1.5;
/** 불씨 칠하기: 목표 둘레를 도는 반경과 손가락 속도 (px/s) */
const PAINT_RING = 55;
const FINGER_SPEED = 900;
/** 짝 폭발형: 짝 자리에서 터질 때 맞을 거리 (폭발형 반경 × 1.8 + 적 반지름) */
const PAIR_REACH = 46 * 1.8 + 11;

/**
 * 자동 플레이 봇. 사람이 아니라 "밸런스 기준선"이다.
 * 같은 봇으로 수백 판을 돌려 "어느 웨이브에서 죽는지, 연쇄가 얼마나 나오는지"를 본다.
 * 봇의 난수는 sim 과 분리돼 있어 sim 결정론에 영향을 주지 않는다.
 *
 * 모으는 탭 전략: 급하면(방어선 근처) 조금만 모여도 가장 아래 적을 쏘고,
 * 아니면 정한 만큼 모았다가 지금 반경으로 가장 많이 잡히는 곳을 쏜다.
 * 실험 규칙마다 정책 옵션이 있어서 "고정 정책 vs 상황 판단" 클리어율을 비교할 수 있다.
 */
export class Bot {
  private readonly rng: Rng;
  private cooldown = 0;
  private readonly reactionSec: number;
  private readonly fireAt: number;
  private readonly minClusterScore: number;
  private readonly pick: PickStrategy;
  private readonly opts: BotOptions;
  /** 쏘기로 정하고 누르기를 기다리는 중 (holdSec 가 있으면 누른 뒤 그만큼 있다가 뗀다) */
  private pending: { x: number; y: number; at: number; holdSec: number; path: { x: number; y: number }[] } | null = null;
  /** 과충전으로 누르고 있는 중: 이 시각에 뗀다 */
  private releaseAt = -1;
  /** 불씨 칠하기: 누르고 있는 동안 지나갈 점들 */
  private paintPath: { x: number; y: number }[] = [];
  /** 게이지가 가득 찬 채로 기다리기 시작한 시각 */
  private fullSince = -1;
  /** 마지막 판단 때 방어선 근처에 적이 있었나 (급하면 과충전 안 함) */
  private urgent = false;

  constructor(opts: BotOptions) {
    this.rng = new Rng(opts.seed ^ 0x5bd1e995);
    this.reactionSec = opts.reactionSec ?? 0.3;
    this.fireAt = opts.fireAt ?? 1;
    this.minClusterScore = opts.minClusterScore ?? 3;
    this.pick = opts.pick ?? 'rarity';
    this.opts = opts;
  }

  think(w: World, dt: number): Command[] {
    if (w.phase === 'choosing' && w.offer) return [{ t: 'choose', index: this.pickIndex(w.offer.choices) }];
    if (w.phase !== 'playing') return [];

    this.cooldown -= dt;
    // 과충전으로 누르고 있는 중 (폭주했으면 sim 이 이미 놓았다)
    if (this.releaseAt >= 0) {
      if (!w.charging) {
        this.releaseAt = -1;
        return [];
      }
      // 불씨 칠하기: 정한 길을 손가락 속도로 따라간다
      if (this.paintPath.length > 0 && w.time < this.releaseAt) {
        const c = w.charging;
        const next = this.paintPath[0];
        const step = FINGER_SPEED * dt;
        const d = Math.hypot(next.x - c.x, next.y - c.y);
        if (d <= step) {
          this.paintPath.shift();
          return [{ t: 'move', x: next.x, y: next.y }];
        }
        return [{ t: 'move', x: c.x + ((next.x - c.x) / d) * step, y: c.y + ((next.y - c.y) / d) * step }];
      }
      if (w.time < this.releaseAt) return [];
      this.releaseAt = -1;
      this.paintPath = [];
      return [{ t: 'release', x: w.charging.x, y: w.charging.y }];
    }
    if (this.pending) {
      if (w.time < this.pending.at) return [];
      const p = this.pending;
      this.pending = null;
      return this.pressFor(w, p.x, p.y, p.holdSec, p.path);
    }
    if (this.cooldown > 0) return [];
    const g = w.gauge;
    if (g < BALANCE.tap.gauge.minFire || w.overheat > 0) return [];

    const target = this.decide(w, g);
    if (!target) return [];
    this.cooldown = this.reactionSec * this.rng.range(0.8, 1.3);
    // 과충전: 100% 에서 목표만큼 누르고 있을 시간 (+ 손 오차)
    let holdSec = 0;
    const level = this.readyLevel(w);
    let path: { x: number; y: number }[] = [];
    if (w.overloadable && g >= 1 && (level > 1 || this.wantsPaint(w)) && !this.urgent) {
      const jitter = this.opts.holdJitter ?? 0.07;
      holdSec = Math.max(0, overchargeHoldSec(w, level) + this.rng.range(-jitter, jitter));
      // 불씨 칠하기: 칠하는 길을 다 지나갈 만큼은 누르고 있는다
      path = this.planPaint(w, target.x, target.y);
      if (path.length > 0) holdSec = Math.max(holdSec, pathLength(target, path) / FINGER_SPEED + 0.05);
    }
    const d = this.opts.pressDelay;
    if (d) {
      this.pending = { x: target.x, y: target.y, at: w.time + this.rng.range(d[0], d[1]), holdSec, path };
      return [];
    }
    return this.pressFor(w, target.x, target.y, holdSec, path);
  }

  /** 누르기. holdSec > 0 이면 그만큼 있다가 뗀다 (과충전) */
  private pressFor(w: World, x: number, y: number, holdSec: number, path: { x: number; y: number }[] = []): Command[] {
    if (holdSec > 0) {
      this.releaseAt = w.time + holdSec;
      this.paintPath = path.slice();
      return [{ t: 'press', x, y }];
    }
    return [{ t: 'press', x, y }, { t: 'release', x, y }];
  }

  /** 지금 쏠 곳. null 이면 더 기다린다 */
  private decide(w: World, g: number): { x: number; y: number } | null {
    const o = this.opts;
    const free = w.stats.freeTapDuringChain && w.explosions.length > 0;
    const danger = this.lowestInDanger(w, DANGER_DIST);
    this.urgent = !!danger;
    if (danger && g >= URGENT_FIRE) return danger;

    // 연쇄 잇기: 콤보가 곧 끊기려 하면 덜 찼어도 쏴서 잇는다
    const ce = o.comboExtend;
    if (ce && w.rules.combo && w.combo.kills >= ce.minKills && w.combo.timer > 0 && w.combo.timer < ce.timerBelow && g >= ce.minGauge) {
      const best = this.bestCluster(w, w.tapRadiusAt(g));
      if (best && best.score >= 1) return best;
    }

    // 과충전 규칙에서는 100% 에서 누르기 시작하고, 목표까지는 누르고 있는 시간으로 맞춘다
    const level = w.overloadable ? 1 : this.readyLevel(w);
    if (g < level && !free) {
      this.fullSince = -1;
      return null;
    }
    // 가득 찼으면(과충전 규칙은 100%) 더 기다려도 손해 → 아무 데나라도 쏜다
    if (this.fullSince < 0) this.fullSince = w.time;
    const mustFire = g >= (w.overloadable ? 1 : w.stats.gaugeMax);

    let zoneTop: number | undefined;
    if (o.brinkGreed && w.rules.brink && !(mustFire && w.time - this.fullSince > BRINK_PATIENCE)) {
      zoneTop = w.field.defenseLineY - BALANCE.experiment.brink.zone - 20;
    }
    const best = this.bestCluster(w, w.tapRadiusAt(g), zoneTop);
    if (!best) return null;
    if (best.score < (free ? 2 : this.minClusterScore) && !mustFire) return null;
    if (zoneTop !== undefined && best.score < 1) return null;
    return best;
  }

  /** 불씨 칠하기를 할 생각인가 (과충전 목표가 100% 여도 칠하려면 누르고 있어야 함) */
  private wantsPaint(w: World): boolean {
    const p = this.opts.paint;
    return !!w.rules.paint && (p === 'ring' || p === 'smart');
  }

  /** 불씨 칠하기: 목표 둘레를 한 바퀴 돌고 목표로 돌아오는 길 (smart 는 둘레에 칠할 적이 3마리 이상일 때만) */
  private planPaint(w: World, x: number, y: number): { x: number; y: number }[] {
    if (!this.wantsPaint(w)) return [];
    const r = w.tapRadiusAt(1);
    if (this.opts.paint === 'smart') {
      let ring = 0;
      for (const e of w.enemies) {
        if (e.dead || e.spark || e.def.deathBlast) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d > r && d <= r + PAINT_RING + e.radius) ring++;
      }
      if (ring < 3) return [];
    }
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      path.push({ x: x + Math.cos(a) * PAINT_RING, y: y + Math.sin(a) * PAINT_RING });
    }
    path.push({ x, y });
    return path;
  }

  /** 급하지 않을 때 이만큼 모이면 쏜다 */
  private readyLevel(w: World): number {
    const max = w.stats.gaugeMax;
    if (w.overloadable) {
      const pressured = this.opts.overchargeAdaptive && this.lowestInDanger(w, PRESSURE_DIST);
      return pressured ? 1 : Math.min(this.opts.overchargeAt ?? 1, max);
    }
    if (max > 1) return Math.min(max, OVERFILL_FIRE);
    return Math.min(max, this.fireAt);
  }

  private pickIndex(choices: readonly string[]): number {
    if (this.pick === 'random') return this.rng.int(choices.length);
    let best = 0;
    let bestScore = -1;
    choices.forEach((id, i) => {
      const def = getAugment(id);
      const score = RARITY_SCORE[def.rarity] + (def.evolution ? 3 : 0) + this.rng.next() * 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    return best;
  }

  private lowestInDanger(w: World, dist: number): Enemy | null {
    const dangerY = w.field.defenseLineY - dist;
    let lowest: Enemy | null = null;
    for (const e of w.enemies) if (!e.dead && e.y > dangerY && (!lowest || e.y > lowest.y)) lowest = e;
    return lowest;
  }

  /** 반경 r 로 쐈을 때 가장 많이 잡히는 적 위치 (폭발형·보스 가중, 아래쪽 약간 가중). minY 가 있으면 그 아래 적만 중심 후보 */
  private bestCluster(w: World, r: number, minY?: number): { x: number; y: number; score: number } | null {
    const visible = w.enemies.filter((e) => !e.dead && e.y > 0);
    const centers = minY === undefined ? visible : visible.filter((e) => e.y >= minY);
    if (centers.length === 0) return null;
    // 짝 폭발형을 아는 봇: 짝 자리 주변에 있는 적 수를 미리 센다
    const pairBonus = new Map<number, number>();
    if (this.opts.pairAware && w.rules.pairs) {
      for (const e of visible) {
        const m = e.partner;
        if (!m || m.dead) continue;
        let n = 0;
        for (const o of visible) if (o !== m && dist2(m.x, m.y, o.x, o.y) <= PAIR_REACH * PAIR_REACH) n++;
        pairBonus.set(e.id, n + 1);
      }
    }
    if (visible.length === 0) return null;
    let best = centers[0];
    let bestScore = -1;
    for (const c of centers) {
      let score = (c.y / w.field.defenseLineY) * 0.5;
      for (const e of visible) {
        const rr = r + e.radius;
        if (dist2(c.x, c.y, e.x, e.y) > rr * rr) continue;
        score += e.def.deathBlast ? (e.def.boss ? 3 : 2) : 1;
        score += pairBonus.get(e.id) ?? 0;
      }
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return { x: best.x, y: best.y, score: bestScore };
  }
}
