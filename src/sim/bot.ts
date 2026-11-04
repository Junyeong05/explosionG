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
}

const RARITY_SCORE: Record<Rarity, number> = { normal: 1, rare: 2, epic: 3, prism: 5 };
/** 방어선에서 이 거리 안으로 들어온 적이 있으면 급함 */
const DANGER_DIST = 70;
/** 급할 때는 게이지가 이만큼만 있어도 쏜다 */
const URGENT_FIRE = 0.5;
/** 초신성(과충전)이면 상한까지 기다리지 않고 이만큼에서 쏜다 */
const OVERFILL_FIRE = 1.8;

/**
 * 자동 플레이 봇. 사람이 아니라 "밸런스 기준선"이다.
 * 같은 봇으로 수백 판을 돌려 "어느 웨이브에서 죽는지, 연쇄가 얼마나 나오는지"를 본다.
 * 봇의 난수는 sim 과 분리돼 있어 sim 결정론에 영향을 주지 않는다.
 *
 * 모으는 탭 전략: 급하면(방어선 근처) 조금만 모여도 가장 아래 적을 쏘고,
 * 아니면 fireAt 까지 모았다가 지금 반경으로 가장 많이 잡히는 곳을 쏜다.
 */
export class Bot {
  private readonly rng: Rng;
  private cooldown = 0;
  private readonly reactionSec: number;
  private readonly fireAt: number;
  private readonly minClusterScore: number;
  private readonly pick: PickStrategy;

  constructor(opts: BotOptions) {
    this.rng = new Rng(opts.seed ^ 0x5bd1e995);
    this.reactionSec = opts.reactionSec ?? 0.3;
    this.fireAt = opts.fireAt ?? 1;
    this.minClusterScore = opts.minClusterScore ?? 3;
    this.pick = opts.pick ?? 'rarity';
  }

  think(w: World, dt: number): Command[] {
    if (w.phase === 'choosing' && w.offer) return [{ t: 'choose', index: this.pickIndex(w.offer.choices) }];
    if (w.phase !== 'playing') return [];

    this.cooldown -= dt;
    if (this.cooldown > 0) return [];
    const g = w.gauge;
    if (g < BALANCE.tap.gauge.minFire) return [];
    const free = w.stats.freeTapDuringChain && w.explosions.length > 0;

    let target: { x: number; y: number } | null = null;
    const danger = this.lowestInDanger(w);
    if (danger && g >= URGENT_FIRE) target = danger;
    else {
      const max = w.stats.gaugeMax;
      const ready = g >= Math.min(max, max > 1 ? OVERFILL_FIRE : this.fireAt);
      if (!ready && !free) return [];
      const best = this.bestCluster(w, w.tapRadiusAt(g));
      if (!best) return [];
      const atCap = g >= max;
      if (best.score < (free ? 2 : this.minClusterScore) && !atCap) return [];
      target = best;
    }

    this.cooldown = this.reactionSec * this.rng.range(0.8, 1.3);
    return [{ t: 'press', x: target.x, y: target.y }, { t: 'release', x: target.x, y: target.y }];
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

  private lowestInDanger(w: World): Enemy | null {
    const dangerY = w.field.defenseLineY - DANGER_DIST;
    let lowest: Enemy | null = null;
    for (const e of w.enemies) if (!e.dead && e.y > dangerY && (!lowest || e.y > lowest.y)) lowest = e;
    return lowest;
  }

  /** 반경 r 로 쐈을 때 가장 많이 잡히는 적 위치 (폭발형·보스 가중, 아래쪽 약간 가중) */
  private bestCluster(w: World, r: number): { x: number; y: number; score: number } | null {
    const visible = w.enemies.filter((e) => !e.dead && e.y > 0);
    if (visible.length === 0) return null;
    let best = visible[0];
    let bestScore = -1;
    for (const c of visible) {
      let score = (c.y / w.field.defenseLineY) * 0.5;
      for (const e of visible) {
        const rr = r + e.radius;
        if (dist2(c.x, c.y, e.x, e.y) > rr * rr) continue;
        score += e.def.deathBlast ? (e.def.boss ? 3 : 2) : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return { x: best.x, y: best.y, score: bestScore };
  }
}
