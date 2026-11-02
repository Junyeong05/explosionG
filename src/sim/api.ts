import type { Rng } from '../core/rng';
import type { SimEvent } from './events';
import type { PlayerStats } from './stats';
import type { DamageSource, Enemy, Explosion } from './types';

export interface ExplosionSpec {
  x: number;
  y: number;
  radius: number;
  damage: number;
  chainId: number;
  source: DamageSource;
  delay?: number;
  crit?: boolean;
}

export interface ZoneSpec {
  x: number;
  y: number;
  radius: number;
  dps: number;
  ttl: number;
  chainId: number;
  source: DamageSource;
}

export interface MineSpec {
  x: number;
  y: number;
  radius: number;
  damage: number;
  ttl: number;
}

export interface KillInfo {
  enemy: Readonly<Enemy>;
  chainId: number;
  /** 이 처치까지 포함한 연쇄 처치 수 */
  chainKills: number;
}

/**
 * 증강·보스 훅이 sim 에 접근하는 유일한 창구.
 *
 * 규칙: 훅 안에서 적에게 "즉시" 피해를 주지 않는다. 피해는 전부 spawnExplosion 으로 큐에 넣는다.
 *   → 훅이 훅을 부르는 재귀가 생기지 않고, 한 스텝의 처리량이 유한하다.
 */
export interface SimApi {
  readonly time: number;
  readonly wave: number;
  readonly stats: Readonly<PlayerStats>;
  /** 전투용 난수 스트림 */
  readonly rng: Rng;
  /** (x, y) 반경 r 과 겹치는 살아 있는 적 (새 배열) */
  enemiesNear(x: number, y: number, r: number): Enemy[];
  /** 화면 안의 살아 있는 적 (새 배열) */
  aliveEnemies(): Enemy[];
  spawnExplosion(spec: ExplosionSpec): void;
  spawnEnemy(kind: string, x: number, y: number, hpMul?: number): Enemy | null;
  newChain(): number;
  addZone(spec: ZoneSpec): void;
  addMine(spec: MineSpec): void;
  heal(amount: number): void;
  gainCharge(amount: number): void;
  /** 판 종료 정산에 더해지는 부품 */
  addBonusParts(amount: number): void;
  emit(ev: SimEvent): void;
}

export type { Explosion };
