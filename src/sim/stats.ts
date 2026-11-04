import { BALANCE } from '../data/balance';
import type { AugmentDef } from '../data/augments';

/**
 * 판 안의 플레이어 능력치. 기본값 → 영구 강화 → 증강 순으로 매번 다시 계산한다.
 * (증강을 얻을 때만 재계산하므로 비용 걱정 없음)
 */
export interface PlayerStats {
  /** 게이지 0 → 100% 시간 (초) */
  gaugeFillSec: number;
  /** 게이지 상한 (1 = 100%. 초신성이면 2.5) */
  gaugeMax: number;
  /** 발사 후 남는 게이지 */
  gaugeLeftover: number;
  tapRadius: number;
  tapDamage: number;
  critChance: number;
  critMultiplier: number;
  chainRadius: number;
  chainDamageRatio: number;
  chainMultiplierPerKill: number;
  chainDelaySec: number;
  /** 일반 적도 죽을 때 터지는가 (기본은 deathBlast 가 있는 폭발형·보스만) */
  chainOnAllKills: boolean;
  /** 한 연쇄에서 이 수만큼 처치할 때마다 게이지 +chainRefundGauge (0 이면 없음) */
  chainRefundKills: number;
  chainRefundGauge: number;
  maxLife: number;
  /** 무한 연쇄: 연쇄가 진행 중이면 탭이 게이지를 쓰지 않음 */
  freeTapDuringChain: boolean;
}

/** 판 밖(영구 강화)에서 들어오는 보정 */
export interface MetaModifiers {
  tapDamageMul: number;
  bonusLife: number;
  rerolls: number;
  headStartPicks: number;
}

export const NO_META: Readonly<MetaModifiers> = Object.freeze({
  tapDamageMul: 1,
  bonusLife: 0,
  rerolls: 0,
  headStartPicks: 0,
});

export function baseStats(): PlayerStats {
  const B = BALANCE;
  return {
    gaugeFillSec: B.tap.gauge.fillSec,
    gaugeMax: 1,
    gaugeLeftover: 0,
    tapRadius: B.tap.radius,
    tapDamage: B.tap.damage,
    critChance: 0,
    critMultiplier: B.tap.critMultiplier,
    chainRadius: B.chain.radius,
    chainDamageRatio: B.chain.damageRatio,
    chainMultiplierPerKill: B.chain.multiplierPerKill,
    chainDelaySec: B.chain.delaySec,
    chainOnAllKills: false,
    chainRefundKills: B.chain.refundEveryKills,
    chainRefundGauge: B.chain.refundGauge,
    maxLife: B.life.start,
    freeTapDuringChain: false,
  };
}

export interface StackedAugment {
  def: AugmentDef;
  stacks: number;
}

export function computeStats(meta: Readonly<MetaModifiers>, augments: readonly StackedAugment[]): PlayerStats {
  const s = baseStats();
  s.tapDamage *= meta.tapDamageMul;
  s.maxLife += meta.bonusLife;
  for (const a of augments) a.def.modifyStats?.(s, a.stacks);
  return s;
}
