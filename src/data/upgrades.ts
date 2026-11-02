import type { MetaModifiers } from '../sim/stats';

export type UpgradeId = 'firepower' | 'durability' | 'reroll' | 'headstart';

/** 영구 강화 (판 밖). 프로토 v2 구현분 4종. 출시 목표 8종. 비용은 ⚠ 임시값 */
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  maxLevel: number;
  /** 현재 레벨 → 다음 레벨 비용 (부품) */
  cost(level: number): number;
  apply(m: MetaModifiers, level: number): void;
}

export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'firepower', name: '화력', desc: '탭 폭발 피해 +8% (연쇄 피해도 함께 오름)',
    maxLevel: 10,
    cost: (l) => Math.round(20 * Math.pow(1.45, l)),
    apply: (m, l) => { m.tapDamageMul *= 1 + 0.08 * l; },
  },
  {
    id: 'durability', name: '내구', desc: '시작 LIFE +1',
    maxLevel: 3,
    cost: (l) => 60 * Math.pow(2, l),
    apply: (m, l) => { m.bonusLife += l; },
  },
  {
    id: 'reroll', name: '리롤', desc: '판당 증강 리롤 +1',
    maxLevel: 3,
    cost: (l) => 50 * Math.pow(2, l),
    apply: (m, l) => { m.rerolls += l; },
  },
  {
    id: 'headstart', name: '선행 증강', desc: '판 시작 시 증강 1개를 고르고 시작',
    maxLevel: 2,
    cost: (l) => Math.round(80 * Math.pow(2.5, l)),
    apply: (m, l) => { m.headStartPicks += l; },
  },
];

export function getUpgrade(id: UpgradeId): UpgradeDef {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`알 수 없는 영구 강화: ${id}`);
  return u;
}
