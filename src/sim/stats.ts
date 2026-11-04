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
  /** 최종 기준 피해 D (덧셈 강화 × 피해 배율까지 반영된 값). 모든 폭발 피해의 기준 */
  tapDamage: number;
  /** 피해 배율 (곱연산, HUD 표시용). tapDamage 에 이미 곱해져 있다 */
  damageMult: number;
  /** 탭 폭발 가장자리 피해 배율 (1 = 균일) */
  tapEdgeMul: number;
  critChance: number;
  critMultiplier: number;
  chainRadius: number;
  /** 넘친 피해 중 연쇄로 이어지는 비율 (1 = 100%) */
  chainCarry: number;
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
    damageMult: 1,
    tapEdgeMul: B.tap.edgeDamageMul,
    critChance: 0,
    critMultiplier: B.tap.critMultiplier,
    chainRadius: B.chain.radius,
    chainCarry: B.chain.carry,
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

/** runMult = 판 동안 쌓인 배율 (보스 처치·연쇄 공명). 증강의 배율과 곱해져 tapDamage 에 들어간다 */
export function computeStats(meta: Readonly<MetaModifiers>, augments: readonly StackedAugment[], runMult = 1): PlayerStats {
  const s = baseStats();
  s.tapDamage *= meta.tapDamageMul;
  s.maxLife += meta.bonusLife;
  for (const a of augments) a.def.modifyStats?.(s, a.stacks);
  s.damageMult *= runMult;
  s.tapDamage *= s.damageMult;
  return s;
}
