import type { DamageSource, OfferKind, RunResult } from './types';
import type { Rarity } from '../data/augments';

/**
 * sim → 연출(렌더·사운드·진동·슬로모션) 단방향 이벤트.
 * 연출 쪽은 이벤트만 보고 반응하고, sim 상태를 바꾸지 않는다.
 */
export type SimEvent =
  /** power = 쏜 게이지 (1 = 100%) */
  | { type: 'tap'; x: number; y: number; free: boolean; power: number }
  | { type: 'dryTap'; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; radius: number; source: DamageSource; chainId: number; chainKills: number; crit: boolean }
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean }
  | { type: 'shieldBreak'; x: number; y: number }
  | { type: 'kill'; x: number; y: number; kind: string; chainKills: number; boss: boolean }
  | { type: 'chainEnd'; chainId: number; kills: number }
  /** 연쇄 환급으로 게이지 증가. x, y 는 환급을 만든 처치 위치 */
  | { type: 'refund'; x: number; y: number; chainKills: number }
  | { type: 'leak'; x: number; damage: number }
  | { type: 'wave'; wave: number }
  | { type: 'bossSpawn'; id: string; final: boolean }
  | { type: 'bossSummon'; x: number; y: number }
  | { type: 'bossKill'; x: number; y: number; final: boolean }
  | { type: 'gaugeFull' }
  | { type: 'levelUp'; level: number }
  | { type: 'offer'; kind: OfferKind }
  | { type: 'augment'; id: string; rarity: Rarity }
  | { type: 'bolt'; kind: 'lightning' | 'shard'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'runEnd'; result: RunResult };

export type SimEventType = SimEvent['type'];
