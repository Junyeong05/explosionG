import type { AugmentDef } from './augments';

/**
 * 도파민 모드 v2: 카테고리 무기고 (docs/design/dopamine-catalog.md).
 *
 * 플레이 피드백: "카테고리(포탑·소환수·손공격·마법…)를 나누고 그 안에 종류를 쫙 둔 다음,
 * 하나 골라 시작해서 플레이하며 하나씩 늘려 가는 느낌. 초반엔 다른 디펜스처럼 조촐하다가
 * 이것저것 업그레이드하게." → 뱀파이어 서바이버식: 시작 무기 1개, 레벨 업마다 새 무기 또는 레벨 업.
 *
 * 무기 하나 = 증강 하나 (중첩 = 레벨, 최대 5). 효과는 sim/chaos.ts 가 보유 레벨을 보고 돌린다.
 */

export type ArmCategory = 'hand' | 'turret' | 'summon' | 'magic' | 'passive';

export const CATEGORY_LABEL: Record<ArmCategory, string> = {
  hand: '손공격',
  turret: '포탑',
  summon: '소환수',
  magic: '마법',
  passive: '강화',
};

/** 무기 칸 (손공격·포탑·소환수·마법 합쳐서), 강화 칸 */
export const WEAPON_SLOTS = 6;
export const PASSIVE_SLOTS = 5;
export const MAX_LEVEL = 5;

/** 마법이 쓰는 큰 효과 (예전 난입 이벤트). 배너용 이모지·이름 */
export type ChaosEventId =
  | 'meteor' | 'sheep' | 'banana' | 'airstrike' | 'cookie' | 'dino' | 'cows' | 'cannons'
  | 'donkey' | 'ufo' | 'jackpot' | 'tornado' | 'train' | 'dragon';

export interface ChaosEventDef {
  id: ChaosEventId;
  emoji: string;
  name: string;
}

export const CHAOS_EVENTS: readonly ChaosEventDef[] = [
  { id: 'meteor', emoji: '☄️', name: '운석우' },
  { id: 'sheep', emoji: '🐑', name: '양 폭탄 부대' },
  { id: 'banana', emoji: '🍌', name: '바나나 폭탄' },
  { id: 'airstrike', emoji: '✈️', name: '공습' },
  { id: 'cookie', emoji: '🍪', name: '황금 쿠키' },
  { id: 'dino', emoji: '🦖', name: '공룡 떼' },
  { id: 'cows', emoji: '🐄', name: '소 떼 돌진' },
  { id: 'cannons', emoji: '💥', name: '대포 일제사격' },
  { id: 'donkey', emoji: '🐴', name: '콘크리트 당나귀' },
  { id: 'ufo', emoji: '🛸', name: '외계인 납치' },
  { id: 'jackpot', emoji: '🎰', name: '잭팟 룰렛' },
  { id: 'tornado', emoji: '🌪️', name: '토네이도' },
  { id: 'train', emoji: '🚂', name: '폭주 기관차' },
  { id: 'dragon', emoji: '🐉', name: '드래곤' },
];

export function chaosEvent(id: ChaosEventId): ChaosEventDef {
  return CHAOS_EVENTS.find((e) => e.id === id)!;
}

export interface ArmInfo {
  cat: ArmCategory;
  emoji: string;
  /** 시작 무기로 고를 수 있나 */
  starter?: boolean;
  /** 마법: 쓰는 큰 효과 */
  event?: ChaosEventId;
}

/** 무기 id → 카테고리·이모지. 순서 = 카테고리 안 표시 순서 */
export const ARMS: Record<string, ArmInfo> = {
  // 손공격: 탭하면 그 자리에서. 폭탄 말고는 각자 쿨다운
  arm_bomb: { cat: 'hand', emoji: '💥', starter: true },
  arm_zap: { cat: 'hand', emoji: '⚡', starter: true },
  arm_mine: { cat: 'hand', emoji: '💣', starter: true },
  arm_slash: { cat: 'hand', emoji: '🔪' },
  arm_flame: { cat: 'hand', emoji: '🔥' },
  arm_snipe: { cat: 'hand', emoji: '🎯' },
  // 포탑: 방어선 위 칸에 서서 알아서 쏜다
  arm_cannon: { cat: 'turret', emoji: '🏰', starter: true },
  arm_gun: { cat: 'turret', emoji: '🔫', starter: true },
  arm_tesla: { cat: 'turret', emoji: '🗼', starter: true },
  arm_laser: { cat: 'turret', emoji: '🛰️' },
  arm_frost: { cat: 'turret', emoji: '❄️' },
  // 소환수: 알아서 튀어나가 싸운다
  arm_soldier: { cat: 'summon', emoji: '💂', starter: true },
  arm_sheep: { cat: 'summon', emoji: '🐑', starter: true },
  arm_cat: { cat: 'summon', emoji: '🐱', starter: true },
  arm_dino: { cat: 'summon', emoji: '🦖' },
  arm_cows: { cat: 'summon', emoji: '🐄' },
  // 마법: 쿨다운마다 저절로, 화면이 뒤집어지는 한 방
  arm_meteor: { cat: 'magic', emoji: '☄️', starter: true, event: 'meteor' },
  arm_airstrike: { cat: 'magic', emoji: '✈️', event: 'airstrike' },
  arm_banana: { cat: 'magic', emoji: '🍌', event: 'banana' },
  arm_tornado: { cat: 'magic', emoji: '🌪️', event: 'tornado' },
  arm_ufo: { cat: 'magic', emoji: '🛸', event: 'ufo' },
  arm_train: { cat: 'magic', emoji: '🚂', event: 'train' },
  arm_donkey: { cat: 'magic', emoji: '🐴', event: 'donkey' },
  arm_dragon: { cat: 'magic', emoji: '🐉', event: 'dragon' },
  arm_jackpot: { cat: 'magic', emoji: '🎰', event: 'jackpot' },
  // 강화: 무기 전부에 걸림
  arm_power: { cat: 'passive', emoji: '💪' },
  arm_haste: { cat: 'passive', emoji: '⏱️' },
  arm_multi: { cat: 'passive', emoji: '➕' },
  arm_gate: { cat: 'passive', emoji: '✖️' },
  arm_luck: { cat: 'passive', emoji: '🍀' },
  arm_xp: { cat: 'passive', emoji: '🧲' },
};

export function armInfo(id: string): ArmInfo | undefined {
  return ARMS[id];
}

const arm = (id: string, name: string, desc: string, extra: Partial<AugmentDef> = {}): AugmentDef => ({
  id,
  name: `${ARMS[id].emoji} ${name}`,
  desc,
  rarity: 'normal',
  archetypes: [],
  maxStacks: MAX_LEVEL,
  tag: CATEGORY_LABEL[ARMS[id].cat],
  ...extra,
});

export const ARSENAL: readonly AugmentDef[] = [
  arm('arm_bomb', '폭탄 탭', '게이지를 모아 탭한 자리를 터뜨린다 (100%에서 꾹 누르면 과충전). 레벨 업: 반경 +10%, 3·5레벨에 연쇄 +1', {
    modifyStats: (s, n) => {
      s.tapRadius *= 1 + 0.1 * (n - 1);
      s.chainDepthBonus += (n >= 3 ? 1 : 0) + (n >= 5 ? 1 : 0);
    },
  }),
  arm('arm_zap', '번개 손', '탭한 자리 근처 적 3마리에게 번개 (0.6초마다). 레벨 업: 더 세게, 짝수 레벨마다 +1마리'),
  arm('arm_mine', '지뢰 손', '탭한 자리에 지뢰를 박는다 (1초마다, 최대 4개). 적이 밟으면 쾅. 레벨 업: 더 세게, 더 많이'),
  arm('arm_slash', '베기 손', '탭한 높이를 화면 가로로 벤다 (1.2초마다). 레벨 업: 더 두껍고 세게'),
  arm('arm_flame', '화염 손', '탭한 자리에 불바다를 남긴다 (0.8초마다). 레벨 업: 더 넓고 오래'),
  arm('arm_snipe', '저격', '탭한 근처에서 체력이 가장 많은 적을 저격 (1.5초마다). 보스 잡이. 레벨 업: 더 세게'),
  arm('arm_cannon', '대포', '적이 몰린 곳에 포탄 (3초마다). 레벨 업: 더 자주, 3·5레벨에 한 발 더'),
  arm('arm_gun', '기관총', '가장 가까운 적을 쉬지 않고 쏜다. 레벨 업: 더 빠르게'),
  arm('arm_tesla', '테슬라 코일', '번개로 적 3마리를 지지고 폭약을 붙인다 (죽으면 터짐). 레벨 업: 더 자주, 더 많이'),
  arm('arm_laser', '위성 레이저', '적이 가장 많은 줄에 레이저 기둥 (7초마다). 레벨 업: 더 자주, 더 세게'),
  arm('arm_frost', '냉각탑', '적이 몰린 곳을 2초 얼리며 살짝 피해 (5초마다). 언 적은 모든 피해 2.5배. 레벨 업: 더 자주, 더 넓게'),
  arm('arm_soldier', '자폭 병사', '병사가 걸어 나가 적에게 안겨 터진다 (3초마다). 레벨 업: 더 자주, 더 세게'),
  arm('arm_sheep', '양 떼', '양이 뛰쳐나가 박치기하고 터진다 (4초마다). 레벨 업: 더 자주, 3·5레벨에 한 마리 더'),
  arm('arm_cat', '고양이 마법사', '불덩이를 던져 불을 붙인다 (1.6초마다). 불은 옆으로 번진다. 레벨 업: 더 빠르게'),
  arm('arm_dino', '공룡', '공룡이 화면을 가로지르며 짓밟는다 (12초마다). 레벨 업: 더 자주, 더 많이'),
  arm('arm_cows', '소 떼', '소 떼가 방어선에서 위로 들이받는다 (10초마다). 레벨 업: 더 많이'),
  arm('arm_meteor', '운석우', '운석이 적 머리 위로 쏟아진다 (12초마다). 레벨 업: 더 자주, 더 많이'),
  arm('arm_airstrike', '공습', '비행기가 몰린 줄에 폭탄을 줄줄이 (14초마다)'),
  arm('arm_banana', '바나나 폭탄', '터지고 다섯 개로 갈라져 또 터진다 (10초마다)'),
  arm('arm_tornado', '토네이도', '적을 빨아들여 돌리다 가운데서 폭발 (16초마다)'),
  arm('arm_ufo', '외계인 납치', 'UFO 빔이 한 줄을 들어 올렸다가 한꺼번에 터뜨린다 (18초마다)'),
  arm('arm_train', '폭주 기관차', '한 줄을 통째로 밀어버린다 (15초마다)'),
  arm('arm_donkey', '콘크리트 당나귀', '하늘에서 떨어져 적에 튕기며 다섯 번 쾅 (14초마다)'),
  arm('arm_dragon', '드래곤', '날아가며 아래로 불을 뿜는다 (16초마다)'),
  arm('arm_jackpot', '잭팟 룰렛', '슬롯이 돈다 (25초마다). 777이면 화면 전체 폭파, 같은 그림 셋이면 그 마법 두 번'),
  arm('arm_power', '화력', '모든 무기 피해 +12%', { modifyStats: (s, n) => { s.tapDamage *= 1 + 0.12 * n; } }),
  arm('arm_haste', '속사', '모든 무기 쿨다운 -8%'),
  arm('arm_multi', '다중', '포탄·병사·양·운석 같은 발사 수 +1 (1·3·5레벨)'),
  arm('arm_gate', '곱하기 게이트', '게이트를 지나간 포탄·불덩이·병사·양이 ×2 (레벨마다 ×3, ×4 …)'),
  arm('arm_luck', '행운', '황금 쿠키가 자주 뜨고, 피버가 쉽게 터진다'),
  arm('arm_xp', '경험치 자석', '경험치 +20%'),
];

/** 예전 이름 호환 (세이브의 판 기록에 남은 id) */
export const CHAOS_AUGMENTS = ARSENAL;
