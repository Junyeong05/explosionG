import { BALANCE } from '../data/balance';
import type { AugmentDef } from '../data/augments';

export type InputMode = 'tap' | 'supernova';

/**
 * 판 안의 플레이어 능력치. 기본값 → 영구 강화 → 증강 순으로 매번 다시 계산한다.
 * (증강을 얻을 때만 재계산하므로 비용 걱정 없음)
 */
export interface PlayerStats {
  maxCharges: number;
  rechargeSec: number;
  tapRadius: number;
  tapDamage: number;
  critChance: number;
  critMultiplier: number;
  chainRadius: number;
  chainDamageRatio: number;
  chainMultiplierPerKill: number;
  chainDelaySec: number;
  maxLife: number;
  /** 프리즘 증강이 조작을 바꾼다: 초신성 = 누르고 떼기 */
  inputMode: InputMode;
  /** 무한 연쇄: 연쇄가 진행 중이면 탭이 충전을 쓰지 않음 */
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
    maxCharges: B.tap.maxCharges,
    rechargeSec: B.tap.rechargeSec,
    tapRadius: B.tap.radius,
    tapDamage: B.tap.damage,
    critChance: 0,
    critMultiplier: B.tap.critMultiplier,
    chainRadius: B.chain.radius,
    chainDamageRatio: B.chain.damageRatio,
    chainMultiplierPerKill: B.chain.multiplierPerKill,
    chainDelaySec: B.chain.delaySec,
    maxLife: B.life.start,
    inputMode: 'tap',
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
