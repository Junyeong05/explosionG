import type { AugmentDef } from './augments';

/**
 * 도파민 모드: 다 쏟아붓기 (docs/design/dopamine-catalog.md).
 *   - 난입 이벤트: 시간마다 갑자기 들이닥친다. 웨이브가 오를수록 종류가 하나씩 열리고 자주 온다.
 *   - 설치물: 레벨 업 카드로 얻고 판 내내 남는다. 판 후반엔 화면에 이것저것 다 깔린다.
 *   - 피버 타임: 짧은 시간에 많이 잡으면 터진다.
 * 동작은 sim/chaos.ts, 그리기는 render/chaosDraw.ts, 수치는 BALANCE.chaos.
 */

export type ChaosEventId =
  | 'meteor' | 'sheep' | 'banana' | 'airstrike' | 'cookie' | 'dino' | 'cows' | 'cannons'
  | 'donkey' | 'ufo' | 'jackpot' | 'tornado' | 'train' | 'dragon';

export interface ChaosEventDef {
  id: ChaosEventId;
  emoji: string;
  name: string;
  /** 이 웨이브부터 나온다 */
  fromWave: number;
  weight: number;
}

export const CHAOS_EVENTS: readonly ChaosEventDef[] = [
  { id: 'meteor', emoji: '☄️', name: '운석우', fromWave: 1, weight: 3 },
  { id: 'sheep', emoji: '🐑', name: '양 폭탄 부대', fromWave: 1, weight: 3 },
  { id: 'banana', emoji: '🍌', name: '바나나 폭탄', fromWave: 2, weight: 2 },
  { id: 'airstrike', emoji: '✈️', name: '공습', fromWave: 2, weight: 2 },
  { id: 'cookie', emoji: '🍪', name: '황금 쿠키', fromWave: 2, weight: 2 },
  { id: 'dino', emoji: '🦖', name: '공룡 떼 난입', fromWave: 3, weight: 2 },
  { id: 'cows', emoji: '🐄', name: '소 떼 돌진', fromWave: 3, weight: 2 },
  { id: 'cannons', emoji: '💥', name: '대포 일제사격', fromWave: 4, weight: 2 },
  { id: 'donkey', emoji: '🐴', name: '콘크리트 당나귀', fromWave: 4, weight: 1 },
  { id: 'ufo', emoji: '🛸', name: '외계인 납치', fromWave: 5, weight: 2 },
  { id: 'jackpot', emoji: '🎰', name: '잭팟 룰렛', fromWave: 5, weight: 1 },
  { id: 'tornado', emoji: '🌪️', name: '토네이도', fromWave: 6, weight: 1 },
  { id: 'train', emoji: '🚂', name: '폭주 기관차', fromWave: 6, weight: 1 },
  { id: 'dragon', emoji: '🐉', name: '드래곤 출현', fromWave: 7, weight: 1 },
];

export function chaosEvent(id: ChaosEventId): ChaosEventDef {
  return CHAOS_EVENTS.find((e) => e.id === id)!;
}

/** 설치물 = 도파민 모드에서만 나오는 증강. 효과는 sim/chaos.ts 가 보유 중첩 수를 보고 돌린다 */
export type InstallId =
  | 'chaos_cannon' | 'chaos_tesla' | 'chaos_barracks' | 'chaos_cat' | 'chaos_satellite'
  | 'chaos_eggs' | 'chaos_gate' | 'chaos_sheepfarm' | 'chaos_luck';

export const INSTALL_EMOJI: Record<InstallId, string> = {
  chaos_cannon: '💣',
  chaos_tesla: '⚡',
  chaos_barracks: '⛺',
  chaos_cat: '🐱',
  chaos_satellite: '🛰️',
  chaos_eggs: '🥚',
  chaos_gate: '✖️',
  chaos_sheepfarm: '🐑',
  chaos_luck: '🍀',
};

export const CHAOS_AUGMENTS: readonly AugmentDef[] = [
  { id: 'chaos_cannon', name: '💣 대포 포대', rarity: 'rare', archetypes: ['burst'], maxStacks: 3, desc: '양옆 대포가 적이 몰린 곳에 포탄을 쏜다. 겹칠수록 빨라짐' },
  { id: 'chaos_tesla', name: '⚡ 테슬라 코일', rarity: 'rare', archetypes: ['lightning'], maxStacks: 3, desc: '번개로 적 3마리를 지지고 폭약을 붙인다 (죽으면 폭발형처럼 터짐)' },
  { id: 'chaos_barracks', name: '⛺ 자폭 병사 막사', rarity: 'rare', archetypes: ['chain'], maxStacks: 3, desc: '병사가 줄지어 나가 적에게 안겨 터진다' },
  { id: 'chaos_cat', name: '🐱 고양이 마법사', rarity: 'rare', archetypes: ['zone'], maxStacks: 3, desc: '고양이가 쉬지 않고 불덩이를 던진다. 맞은 적은 불타고 옆으로 번진다' },
  { id: 'chaos_sheepfarm', name: '🐑 양 목장', rarity: 'rare', archetypes: ['chain'], maxStacks: 3, desc: '양이 계속 뛰쳐나가 적에게 박치기하고 터진다' },
  { id: 'chaos_luck', name: '🍀 네잎클로버', rarity: 'rare', archetypes: [], maxStacks: 3, desc: '난입 이벤트가 30% 더 자주 온다' },
  { id: 'chaos_satellite', name: '🛰️ 위성 레이저', rarity: 'epic', archetypes: ['burst'], maxStacks: 3, desc: '하늘에서 레이저 기둥이 적이 가장 많은 줄을 지진다' },
  { id: 'chaos_eggs', name: '🥚 공룡 알 둥지', rarity: 'epic', archetypes: ['chain'], maxStacks: 3, desc: '알이 부화할 때마다 공룡이 화면을 가로지르며 짓밟는다' },
  { id: 'chaos_gate', name: '✖️ 곱하기 게이트', rarity: 'epic', archetypes: ['chain'], maxStacks: 3, desc: '게이트를 지나간 포탄·불덩이·병사·양이 ×2로 늘어난다 (겹치면 ×3, ×4)' },
];
