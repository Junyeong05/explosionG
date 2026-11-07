import { BALANCE } from '../data/balance';
import { AUGMENTS, FALLBACK_AUGMENTS, getAugment, type AugmentDef, type AugmentState, type Rarity } from '../data/augments';
import type { Rng } from '../core/rng';
import type { KillInfo, SimApi } from './api';
import type { Explosion, OfferKind } from './types';

export interface OwnedAugment {
  def: AugmentDef;
  stacks: number;
  state: AugmentState;
  /** 진화로 대체되면 false (능력치·훅 모두 꺼짐) */
  active: boolean;
}

const ROLLABLE_RARITIES: readonly Exclude<Rarity, 'prism'>[] = ['normal', 'rare', 'epic'];

/** 판 안에서 보유한 증강, 선택지 뽑기, 훅 호출 */
export class AugmentManager {
  private readonly owned = new Map<string, OwnedAugment>();
  private activeCache: OwnedAugment[] | null = null;
  readonly history: string[] = [];

  constructor(
    private readonly rng: Rng,
    private readonly pool: readonly AugmentDef[] = AUGMENTS,
  ) {}

  stacks(id: string): number {
    const o = this.owned.get(id);
    return o && o.active ? o.stacks : 0;
  }

  active(): readonly OwnedAugment[] {
    if (!this.activeCache) this.activeCache = [...this.owned.values()].filter((o) => o.active);
    return this.activeCache;
  }

  prismCount(): number {
    let n = 0;
    for (const o of this.owned.values()) if (o.def.rarity === 'prism') n++;
    return n;
  }

  isAvailable(def: AugmentDef): boolean {
    if (def.fallback) return false;
    const o = this.owned.get(def.id);
    if (o && (!o.active || o.stacks >= def.maxStacks)) return false;
    if (def.rarity === 'prism' && this.prismCount() >= BALANCE.augment.maxPrismPerRun) return false;
    if (def.evolution) return def.evolution.requires.every((r) => this.stacks(r) > 0);
    return true;
  }

  /**
   * 선택지 뽑기.
   *  - 보스 보상: 프리즘 1개 보장 (판당 최대 1개를 아직 안 채웠으면)
   *  - 진화 조건 충족 시 75% 확률로 진화 1개
   *  - 나머지: 노말 : 레어 : 에픽 = BALANCE.augment.rarityWeights (에픽은 epicFromLevel 부터, 보스 보상은 예외)
   *  - 그래도 모자라면 대체 선택지(응급 수리)
   */
  /** level = 지금 레벨 (에픽 해금 판정). 없으면 제한 없음 */
  roll(kind: OfferKind, level = Number.POSITIVE_INFINITY): string[] {
    const A = BALANCE.augment;
    const n = A.offerCount;
    const epicOk = kind === 'boss' || level >= A.epicFromLevel;
    const avail = this.pool.filter((d) => this.isAvailable(d) && (epicOk || d.rarity !== 'epic' || !!d.evolution));
    const out: AugmentDef[] = [];

    if (kind === 'boss') {
      const prisms = avail.filter((d) => d.rarity === 'prism');
      if (prisms.length > 0) out.push(this.rng.pick(prisms));
    }

    const evolutions = avail.filter((d) => d.evolution);
    if (evolutions.length > 0 && out.length < n && this.rng.chance(A.evolutionChance)) {
      out.push(this.rng.pick(evolutions));
    }

    const regular = avail.filter((d) => !d.evolution && d.rarity !== 'prism');
    while (out.length < n) {
      const remaining = regular.filter((d) => !out.includes(d));
      if (remaining.length === 0) break;
      const rarities = ROLLABLE_RARITIES.filter((r) => remaining.some((d) => d.rarity === r));
      const rarity = this.rng.weighted(rarities, (r) => A.rarityWeights[r]) ?? rarities[0];
      out.push(this.rng.pick(remaining.filter((d) => d.rarity === rarity)));
    }

    for (const fb of FALLBACK_AUGMENTS) {
      if (out.length >= n) break;
      out.push(fb);
    }
    return out.map((d) => d.id);
  }

  acquire(id: string, api: SimApi): AugmentDef {
    const def = getAugment(id);
    let o = this.owned.get(id);
    if (!o) {
      o = { def, stacks: 0, state: {}, active: true };
      this.owned.set(id, o);
    }
    o.stacks++;
    this.history.push(id);
    if (def.evolution) {
      for (const r of def.evolution.replaces) {
        const ro = this.owned.get(r);
        if (ro) ro.active = false;
      }
    }
    this.activeCache = null;
    def.onAcquire?.(api, o.stacks, o.state);
    return def;
  }

  onKill(api: SimApi, kill: KillInfo): void {
    for (const o of this.active()) o.def.hooks?.onKill?.(api, kill, o.stacks, o.state);
  }

  onExplosion(api: SimApi, ex: Readonly<Explosion>): void {
    for (const o of this.active()) o.def.hooks?.onExplosion?.(api, ex, o.stacks, o.state);
  }

  onTick(api: SimApi, dt: number): void {
    for (const o of this.active()) o.def.hooks?.onTick?.(api, dt, o.stacks, o.state);
  }
}
