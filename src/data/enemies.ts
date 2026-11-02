import type { SimApi } from '../sim/api';
import type { Enemy } from '../sim/types';

export type EnemyKind = 'normal' | 'explosive' | 'rusher' | 'armored' | 'shielded' | 'splitter' | 'splitling';
export type EnemyShape = 'square' | 'octagon' | 'triangle' | 'diamond' | 'hexagon';
/** 색맹 대응: 색 + 모양 + 표식 세 가지로 구분 (기획서 "가독성") */
export type EnemyMark = 'dot' | 'thick' | 'ring';

export interface BossTraits {
  /** 보스 HP 바에 뜨는 이름 */
  title: string;
  /** 피해를 받을 때마다 호출 (패턴 구현 지점) */
  onDamaged?(api: SimApi, self: Enemy): void;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** 이 웨이브부터 일반 스폰 풀에 섞인다. 0 이면 직접 스폰되지 않음 (분열체·보스) */
  unlockWave: number;
  spawnWeight: number;
  /** HP = enemyHp(현재 웨이브) × hpMul */
  hpMul: number;
  /** 하강 속도 (논리 단위/초) */
  speed: number;
  radius: number;
  xp: number;
  /** 방어선을 넘었을 때 깎는 LIFE */
  leak: number;
  color: string;
  shape: EnemyShape;
  mark?: EnemyMark;
  /** 죽을 때 생기는 연쇄 폭발 보정 */
  deathBlast?: { radiusMul: number; damageMul: number };
  /** 탭이 아닌 피해(연쇄·잔불·번개 등)를 받을 때 배율 */
  indirectDamageTakenMul?: number;
  /** 폭발을 막는 보호막 횟수 */
  shields?: number;
  /** 죽을 때 분열 */
  splitInto?: { kind: EnemyKind; count: number; spread: number };
  boss?: BossTraits;
}

/** 기획서 "적·보스와 난이도" 표 (속도·크기·가중치는 ⚠ 임시값) */
export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  normal: {
    id: 'normal', name: '일반', unlockWave: 1, spawnWeight: 10,
    hpMul: 1, speed: 30, radius: 11, xp: 1, leak: 1,
    color: '#ff4d6d', shape: 'square',
  },
  explosive: {
    id: 'explosive', name: '폭발형', unlockWave: 2, spawnWeight: 3,
    hpMul: 1, speed: 28, radius: 12, xp: 1, leak: 1,
    color: '#ff9a3c', shape: 'octagon', mark: 'dot',
    // 죽을 때 연쇄 폭발 반경 1.8배, 피해 2배
    deathBlast: { radiusMul: 1.8, damageMul: 2 },
  },
  rusher: {
    id: 'rusher', name: '돌격형', unlockWave: 3, spawnWeight: 3,
    hpMul: 0.5, speed: 78, radius: 9, xp: 1, leak: 1,
    color: '#ffe14d', shape: 'triangle',
  },
  armored: {
    id: 'armored', name: '장갑', unlockWave: 4, spawnWeight: 2.5,
    hpMul: 1.6, speed: 22, radius: 13, xp: 2, leak: 1,
    color: '#4d7cff', shape: 'square', mark: 'thick',
    // 연쇄 피해 절반 → 직접 탭
    indirectDamageTakenMul: 0.5,
  },
  shielded: {
    id: 'shielded', name: '보호막', unlockWave: 5, spawnWeight: 2.5,
    hpMul: 1, speed: 26, radius: 12, xp: 2, leak: 1,
    color: '#3cf0e0', shape: 'diamond', mark: 'ring',
    // 첫 폭발을 막음 → 탭 두 번 또는 연쇄 두 번
    shields: 1,
  },
  splitter: {
    id: 'splitter', name: '분열', unlockWave: 6, spawnWeight: 2,
    hpMul: 1.4, speed: 24, radius: 14, xp: 2, leak: 1,
    color: '#b05cff', shape: 'hexagon',
    // 죽으면 작은 적 3마리 (자기 연쇄 폭발 반경 안에 떨어지게 spread < 46)
    splitInto: { kind: 'splitling', count: 3, spread: 20 },
  },
  splitling: {
    id: 'splitling', name: '분열체', unlockWave: 0, spawnWeight: 0,
    hpMul: 0.35, speed: 40, radius: 7, xp: 1, leak: 1,
    color: '#d49cff', shape: 'triangle',
  },
};

export const REGULAR_ENEMIES: readonly EnemyDef[] = Object.values(ENEMIES).filter((d) => d.unlockWave > 0);
