import { getAugment, type Rarity } from '../data/augments';
import { dist2 } from '../core/math';
import { Rng } from '../core/rng';
import type { Command, Enemy } from './types';
import type { World } from './World';

export type PickStrategy = 'random' | 'rarity';

export interface BotOptions {
  seed: number;
  /** 탭 사이 최소 간격 (사람 반응 속도 흉내) */
  reactionSec?: number;
  /** 이 점수 이상 모인 곳이 있어야 탭 (충전이 꽉 찼거나 급하면 무시) */
  minClusterScore?: number;
  pick?: PickStrategy;
}

const RARITY_SCORE: Record<Rarity, number> = { normal: 1, rare: 2, epic: 3, prism: 5 };

/**
 * 자동 플레이 봇. 사람이 아니라 "밸런스 기준선"이다.
 * 같은 봇으로 수백 판을 돌려 "어느 웨이브에서 죽는지, 연쇄가 얼마나 나오는지"를 본다.
 * 봇의 난수는 sim 과 분리돼 있어 sim 결정론에 영향을 주지 않는다.
 */
export class Bot {
  private readonly rng: Rng;
  private cooldown = 0;
  private holdUntil = -1;
  private readonly reactionSec: number;
  private readonly minClusterScore: number;
  private readonly pick: PickStrategy;

  constructor(opts: BotOptions) {
    this.rng = new Rng(opts.seed ^ 0x5bd1e995);
    this.reactionSec = opts.reactionSec ?? 0.3;
    this.minClusterScore = opts.minClusterScore ?? 3;
    this.pick = opts.pick ?? 'rarity';
  }

  think(w: World, dt: number): Command[] {
    if (w.phase === 'choosing' && w.offer) return [{ t: 'choose', index: this.pickIndex(w.offer.choices) }];
    if (w.phase !== 'playing') return [];

    if (w.hold) {
      return w.time >= this.holdUntil ? [{ t: 'release', x: w.hold.x, y: w.hold.y }] : [];
    }

    this.cooldown -= dt;
    if (this.cooldown > 0) return [];
    const free = w.stats.freeTapDuringChain && w.explosions.length > 0;
    if (w.charges < 1 && !free) return [];

    const target = this.findTarget(w);
    if (!target) return [];
    const full = w.charges >= w.stats.maxCharges;
    if (!target.urgent && !full && !free && target.score < this.minClusterScore) return [];

    this.cooldown = this.reactionSec * this.rng.range(0.8, 1.3);
    if (w.stats.inputMode === 'supernova') {
      this.holdUntil = w.time + (target.urgent ? 0.15 : 1.0);
      return [{ t: 'press', x: target.x, y: target.y }];
    }
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

  private findTarget(w: World): { x: number; y: number; score: number; urgent: boolean } | null {
    const visible = w.enemies.filter((e) => !e.dead && e.y > 0);
    if (visible.length === 0) return null;

    // 방어선 근처는 무조건 처리
    const dangerY = w.field.defenseLineY - 70;
    let lowest: Enemy | null = null;
    for (const e of visible) if (e.y > dangerY && (!lowest || e.y > lowest.y)) lowest = e;
    if (lowest) return { x: lowest.x, y: lowest.y, score: 99, urgent: true };

    // 가장 많이 모인 곳 (폭발형·보스 가중)
    const r = w.stats.tapRadius;
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
    return { x: best.x, y: best.y, score: bestScore, urgent: false };
  }
}
