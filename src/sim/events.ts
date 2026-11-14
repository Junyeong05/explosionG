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
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean; /** 도파민 모드: 낸 무기 id */ src?: string }
  | { type: 'shieldBreak'; x: number; y: number }
  | { type: 'kill'; x: number; y: number; kind: string; chainKills: number; boss: boolean }
  /** links = 연쇄 폭발 수 (0 이면 연쇄 없이 탭이 직접 잡은 것뿐) */
  | { type: 'chainEnd'; chainId: number; kills: number; links: number }
  /** 연쇄 환급으로 게이지 증가. x, y 는 환급을 만든 처치 위치 */
  | { type: 'refund'; x: number; y: number; chainKills: number }
  | { type: 'leak'; x: number; damage: number }
  | { type: 'wave'; wave: number }
  | { type: 'bossSpawn'; id: string; final: boolean }
  | { type: 'bossSummon'; x: number; y: number }
  | { type: 'bossKill'; x: number; y: number; final: boolean }
  | { type: 'gaugeFull' }
  /** 과충전 폭주 (게이지 0, 잠깐 못 쏨) */
  | { type: 'overload' }
  /** 짝 폭발: (x1, y1) 이 터져서 짝 (x2, y2) 도 터짐 */
  | { type: 'pairBlast'; x1: number; y1: number; x2: number; y2: number; color: number }
  /** 도파민 모드: 난입 시작 (id = ChaosEventId), 피버, 황금 쿠키, 잭팟, 핵, 곱하기 게이트 */
  | { type: 'chaos'; id: string; x: number; y: number }
  | { type: 'fever'; on: boolean }
  | { type: 'cookie'; x: number; y: number; buff: string }
  | { type: 'slot'; reels: string[] }
  | { type: 'nuke' }
  | { type: 'gate'; x: number; y: number; mult: number }
  /** 도파민 모드: 총이 쏨 (총구 불꽃·탄피), 마법 무기 발동 (배너), 화면 흔들림 */
  | { type: 'gunFire'; x: number; y: number; angle: number; big: boolean }
  | { type: 'magic'; id: string; x: number; y: number }
  /** 합성 v2: 이 판에서 처음 해낸 짝 (이름만 보여 준다, 규칙 문장은 숨김) */
  | { type: 'fusion'; name: string; a: string; b: string; x: number; y: number }
  /** 합성 v4 극적 반응: 그 자리에 반응 이름이 뜬다 */
  | { type: 'react'; text: string; color: string; x: number; y: number }
  /** 제어 저항: 계속 묶이던 적이 잠깐 풀린다 */
  | { type: 'resist'; x: number; y: number }
  | { type: 'shake'; power: number }
  /** 11-07 실험 묶음 */
  | { type: 'launch'; x1: number; y1: number; x2: number; y2: number; dur: number }
  | { type: 'beat' }
  | { type: 'beatShot'; x: number; y: number; on: boolean }
  | { type: 'sweetShot'; x: number; y: number }
  | { type: 'freeze'; x: number; y: number }
  | { type: 'seed'; x: number; y: number }
  | { type: 'seedBlast'; x: number; y: number }
  | { type: 'mineBlast'; x: number; y: number; radius: number }
  | { type: 'rowBlast'; y: number; half: number }
  | { type: 'golden'; x: number; y: number; ok: boolean }
  /** 쌓이는 바닥: 적이 바닥(더미)에 쌓임 */
  | { type: 'land'; x: number; y: number; rows: number }
  /** 벼랑 끝 처치 */
  | { type: 'brink'; x: number; y: number }
  /** 연쇄 잇기 콤보가 끊김 (kills = 그 콤보의 처치 수) */
  | { type: 'comboEnd'; kills: number }
  /** 피해 배율이 올랐다 (value = 새 배율) */
  | { type: 'mult'; value: number }
  | { type: 'levelUp'; level: number }
  | { type: 'offer'; kind: OfferKind }
  | { type: 'augment'; id: string; rarity: Rarity }
  | { type: 'bolt'; kind: 'lightning' | 'shard'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'runEnd'; result: RunResult };

export type SimEventType = SimEvent['type'];
