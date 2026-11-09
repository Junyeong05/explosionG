import type { AugmentDef } from './augments';
import { UP, UP_KIND, type UpKey, type UpStep } from './chaosUp';

/**
 * 도파민 모드: 카테고리 무기고 (docs/design/dopamine-catalog.md).
 *
 * 플레이 피드백 순서:
 *   1. 카테고리를 나누고 하나 골라 시작해서 하나씩 늘려 가기 (뱀파이어 서바이버식)
 *   2. 무기 종류를 확 늘리기, 총은 총처럼 보이게, 무기 개수 제한 없애기
 *   3. 무기마다 사거리를 따로 (보통 화면 절반 안팎). 다 맨 끝까지 치니 적이 나오는 게 안 보였다
 *   4. (11-08) 무기 종류와 갈래를 미친 듯이 늘리기. 갈래끼리 엮는 "실어 나르기"(docs/design/carry-links.md)의
 *      재료라서, 갈래는 "어떻게 때리나(전달 방식)"가 서로 다르게 나눴다
 *
 * 무기 하나 = 증강 하나 (중첩 = 레벨, 최대 5). 무기는 "행동 틀(kind) + 수치(p)" 로 정의하고,
 * 틀별 동작은 sim/chaos.ts, 그리기는 render/chaosDraw.ts.
 */

export type ArmCategory =
  | 'hand' | 'gun' | 'turret' | 'summon' | 'magic'
  | 'trap' | 'air' | 'charge' | 'sound' | 'spinner' | 'field' | 'ray' | 'throw' | 'swarm' | 'spirit'
  | 'passive';

export const CATEGORY_LABEL: Record<ArmCategory, string> = {
  hand: '손공격',
  gun: '총',
  turret: '포격',
  summon: '소환수',
  magic: '주문',
  trap: '함정',
  air: '공중',
  charge: '돌격',
  sound: '음파',
  spinner: '회전체',
  field: '장판',
  ray: '광선',
  throw: '투척',
  swarm: '떼',
  spirit: '정령',
  passive: '강화',
};

/** 공격하는 갈래 (강화 뺀 것). 시작 무기 고르기는 이 중 셋에서 한 장씩 */
export const ATTACK_CATEGORIES: readonly ArmCategory[] = [
  'hand', 'gun', 'turret', 'summon', 'magic',
  'trap', 'air', 'charge', 'sound', 'spinner', 'field', 'ray', 'throw', 'swarm', 'spirit',
];

/** 갈래 색 (무기 자리 빛, 오른쪽 위 무기 목록 고리) */
export const CATEGORY_COLOR: Record<ArmCategory, string> = {
  hand: '#4dd2ff',
  gun: '#ffe08a',
  turret: '#ffc94d',
  summon: '#7dff9a',
  magic: '#c77dff',
  trap: '#ff8a3c',
  air: '#9fd8ff',
  charge: '#ff6b6b',
  sound: '#ffd36b',
  spinner: '#e8e8f0',
  field: '#7dffd0',
  ray: '#ff3cc8',
  throw: '#d9a066',
  swarm: '#b8ff5a',
  spirit: '#b4a0ff',
  passive: '#ffc94d',
};

/** 무기·강화 칸 제한 없음 (플레이 피드백: 시원하게 다 풀자) */
export const WEAPON_SLOTS = Number.POSITIVE_INFINITY;
export const PASSIVE_SLOTS = Number.POSITIVE_INFINITY;
export const MAX_LEVEL = 5;
/** 사거리를 안 적은 자동 무기의 기본 사거리 (방어선에서 위로, 또는 무기 자리에서). 화면 높이 560 의 절반쯤 */
export const DEFAULT_RANGE = 280;

/** 마법·소환이 쓰는 큰 효과. 배너용 이모지·이름 */
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
  { id: 'sheep', emoji: '🐑', name: '숫양 돌격대' },
  { id: 'banana', emoji: '🍌', name: '분열 폭탄' },
  { id: 'airstrike', emoji: '✈️', name: '공습' },
  { id: 'cookie', emoji: '🍪', name: '황금 보급' },
  { id: 'dino', emoji: '🦖', name: '공룡 떼' },
  { id: 'cows', emoji: '🐄', name: '들소 돌진' },
  { id: 'cannons', emoji: '💥', name: '대포 일제사격' },
  { id: 'donkey', emoji: '🐴', name: '콘크리트 낙하' },
  { id: 'ufo', emoji: '🛸', name: '공중 부양' },
  { id: 'jackpot', emoji: '🎰', name: '운명의 수레바퀴' },
  { id: 'tornado', emoji: '🌪️', name: '토네이도' },
  { id: 'train', emoji: '🚂', name: '폭주 기관차' },
  { id: 'dragon', emoji: '🐉', name: '드래곤' },
];

export function chaosEvent(id: ChaosEventId): ChaosEventDef {
  return CHAOS_EVENTS.find((e) => e.id === id)!;
}

/** 총 모양 (벡터로 그림). 길이·굵기는 px */
export interface GunLook {
  /** 총열 길이·굵기, 몸통 길이·높이 */
  len: number;
  bw: number;
  body: number;
  bh: number;
  color: string;
  scope?: boolean;
  mag?: boolean;
  stock?: boolean;
  /** 총열 여러 개 (미니건) */
  barrels?: number;
  /** 굵은 통 (로켓·유탄) */
  tube?: boolean;
  /** 연료통 (화염방사기) */
  tank?: boolean;
  /** 빛나는 총 (에너지 무기) */
  glow?: string;
}

const L_PISTOL: GunLook = { len: 10, bw: 3, body: 8, bh: 6, color: '#9aa3b8', mag: true };
const L_REVOLVER: GunLook = { len: 13, bw: 3.5, body: 9, bh: 7, color: '#c9a86b' };
const L_SMG: GunLook = { len: 12, bw: 3, body: 12, bh: 6, color: '#5d6478', mag: true };
const L_RIFLE: GunLook = { len: 18, bw: 3, body: 14, bh: 6, color: '#6b7a5a', mag: true, stock: true };
const L_SHOTGUN: GunLook = { len: 18, bw: 5, body: 12, bh: 6, color: '#7a5a3c', stock: true };
const L_SNIPER: GunLook = { len: 26, bw: 2.5, body: 14, bh: 6, color: '#3c4a3c', scope: true, stock: true };
const L_AMR: GunLook = { len: 32, bw: 4, body: 16, bh: 7, color: '#2e3440', scope: true, stock: true };
const L_MINIGUN: GunLook = { len: 18, bw: 7, body: 12, bh: 10, color: '#4a4f63', barrels: 4 };
const L_TUBE: GunLook = { len: 22, bw: 8, body: 8, bh: 7, color: '#5a6b4a', tube: true };
const L_GRENADE: GunLook = { len: 14, bw: 7, body: 12, bh: 8, color: '#6b6b4a', tube: true, stock: true };
const L_FLAMER: GunLook = { len: 16, bw: 4, body: 10, bh: 7, color: '#8a4a2a', tank: true };
const L_LASER: GunLook = { len: 18, bw: 3, body: 14, bh: 6, color: '#e8e8f0', glow: '#ff3cc8' };
const L_RAIL: GunLook = { len: 28, bw: 4, body: 14, bh: 8, color: '#c8d0e8', glow: '#3ce0ff' };
const L_PLASMA: GunLook = { len: 14, bw: 6, body: 12, bh: 8, color: '#5a3c8a', glow: '#b54dff' };
const L_CROSSBOW: GunLook = { len: 14, bw: 3, body: 12, bh: 5, color: '#8a6a3c', stock: true };
const L_WATER: GunLook = { len: 14, bw: 6, body: 12, bh: 9, color: '#3c8aff', glow: '#4dd2ff', tank: true };
const L_POD: GunLook = { len: 12, bw: 12, body: 10, bh: 12, color: '#4a5a4a', tube: true };

export type WeaponKind =
  // 손공격 (탭)
  | 'bomb' | 'tapZap' | 'tapMine' | 'tapSlash' | 'tapZone' | 'tapSnipe' | 'tapBoom' | 'tapThrow'
  | 'tapStrike' | 'tapMissiles' | 'tapPull' | 'tapRain'
  // 자동
  | 'gun' | 'beam' | 'lob' | 'zap' | 'column' | 'strikes' | 'frostArea' | 'zoneAt' | 'saw' | 'pullAt'
  | 'bubble' | 'pulse' | 'walker' | 'stamp' | 'drone' | 'event' | 'rain' | 'drop' | 'sweep' | 'columns'
  | 'storm' | 'freezeAll' | 'quake' | 'nuke' | 'trap' | 'toss' | 'swarm' | 'spell'
  | 'passive';

export interface WeaponParams {
  /** 사거리 (px). 자리 있는 무기는 자리에서 반경, 마법·돌진은 방어선에서 위로 */
  range?: number;
  /** 피해 (D 배율) / 초당 피해 (지대) */
  dmg?: number;
  dps?: number;
  /** 한 번에 나가는 수 (탄·소환·낙하물) */
  count?: number;
  /** 연발 (같은 목표로 0.07초 간격) */
  burst?: number;
  /** 퍼짐 (라디안) */
  spread?: number;
  speed?: number;
  /** 관통 수 (99 = 다 뚫음) */
  pierce?: number;
  /** 맞으면 이 반경으로 폭발 (0 = 폭발 없음) */
  boom?: number;
  /** 반경·폭·높이 (지대·빔·쓸기) */
  radius?: number;
  width?: number;
  ttl?: number;
  target?: 'front' | 'near' | 'strong' | 'random' | 'dense';
  homing?: number;
  bounce?: number;
  ignite?: boolean;
  /** 얼림 (초) */
  freeze?: number;
  /** 밀어내기 (px/s) */
  knock?: number;
  /** 맞힌 뒤 번개가 옮겨 가는 수 */
  chain?: number;
  /** 폭약을 붙인다 (죽으면 폭발형처럼 터짐) */
  spark?: boolean;
  /** 맞으면 작은 탄 네 발로 튀김 */
  popcorn?: boolean;
  /** 느리게 날며 주변을 빨아들이는 구슬 */
  pullOrb?: boolean;
  /** 소환수: 0 이면 닿자마자 자폭, n 이면 n 번 때리고 사라짐 (boom 이 있으면 마지막에 자폭) */
  melee?: number;
  /** 돌진 방향 */
  dir?: 'side' | 'up';
  /** 주문 효과 (kind 'spell') */
  spell?: 'stop' | 'poly' | 'recall' | 'clone' | 'charm' | 'haste';
  /** 아래에서 위로 쏘아 올림 (화산) */
  fromBottom?: boolean;
  event?: ChaosEventId;
  /** 그리기 */
  look?: GunLook;
  tracer?: 'line' | 'ball' | 'flame' | 'arrow' | 'rocket' | 'emoji';
  color?: string;
  emoji?: string;
  size?: number;
  /** 총인데 벽이 아니라 아래 칸에 서는 것 (궁수·닌자) */
  slot?: boolean;
}

export interface WeaponSpec {
  id: string;
  cat: ArmCategory;
  emoji: string;
  name: string;
  desc: string;
  kind: WeaponKind;
  /** 기본 쿨다운 (초). 레벨마다 10% 짧아짐 */
  cd: number;
  starter?: boolean;
  p: WeaponParams;
  /** 레벨 업 효과 (Lv2, 3, 4, 5). data/chaosUp.ts */
  up: UpStep[];
  /** 융합 무기: 이 두 무기를 FUSE_LEVEL 이상 키우면 나오고, 얻으면 두 무기를 대신한다 */
  fusion?: [string, string];
}

const W = (cat: ArmCategory, id: string, emoji: string, name: string, kind: WeaponKind, cd: number, p: WeaponParams, desc: string, starter = false): WeaponSpec =>
  ({ id: `arm_${id}`, cat, emoji, name, kind, cd, p, desc, starter, up: UP[id] ?? UP_KIND[kind] ?? [] });

/** 사거리가 있는 갈래 (플레이 피드백: 총·대포 같은 것만 제한, 소환수·폭격·잭팟은 화면 어디든) */
export function hasRange(cat: ArmCategory): boolean {
  return RANGED.has(cat);
}
/** 자리에서 반경 안만 치는 갈래. 소환수·마법·공중·돌격은 화면 어디든, 손공격은 탭한 자리 */
const RANGED: ReadonlySet<ArmCategory> = new Set<ArmCategory>(['gun', 'turret', 'trap', 'sound', 'spinner', 'field', 'ray', 'throw', 'swarm', 'spirit']);

/** 수치가 비어 있을 때 레벨 업 효과를 더하는 기준값 (한 번에 1발, 사거리 기본값 등) */
const UP_BASE: Partial<Record<UpKey, number>> = { count: 1, burst: 1, range: DEFAULT_RANGE, speed: 100 };

/** 레벨 L 일 때 실제 수치: 기본 p 에 Lv2~L 효과를 쌓은 것 + 피해·쿨다운 배율 */
export function effective(spec: WeaponSpec, L: number): { p: WeaponParams; dmg: number; cd: number } {
  const p = { ...spec.p } as WeaponParams & Record<string, number | undefined>;
  let dmg = 1;
  let cd = 1;
  for (let i = 0; i < Math.min(L - 1, spec.up.length); i++) {
    for (const [k, v] of Object.entries(spec.up[i].d) as [UpKey, number][]) {
      if (k === 'dmg') dmg *= 1 + v;
      else if (k === 'cd') cd *= v;
      else {
        const cur = (p[k] as number | undefined) ?? UP_BASE[k] ?? 0;
        p[k] = k === 'spread' || k === 'speed' ? cur * v : cur + v;
      }
    }
  }
  return { p, dmg, cd };
}

export const WEAPONS: readonly WeaponSpec[] = [
  // ── 손공격: 탭한 자리에서 (사거리 없음) ──────────────────────
  W('hand', 'bomb', '💥', '폭탄 탭', 'bomb', 0, {}, '게이지를 모아 탭한 자리를 터뜨린다 (100%에서 꾹 누르면 과충전). 레벨: 반경, 3·5레벨 연쇄 +1', true),
  W('hand', 'zap', '⚡', '번개 손', 'tapZap', 0.6, { count: 3, dmg: 2, radius: 110 }, '탭 근처 3마리에 번개', true),
  W('hand', 'mine', '💣', '지뢰 손', 'tapMine', 1, { dmg: 3, radius: 48, count: 4 }, '탭한 자리에 지뢰, 밟으면 쾅', true),
  W('hand', 'slash', '🔪', '베기 손', 'tapSlash', 1.2, { dmg: 2.5, width: 12 }, '탭한 높이를 화면 가로로 벤다'),
  W('hand', 'flame', '🔥', '화염 손', 'tapZone', 0.8, { radius: 36, dps: 1.2, ttl: 2 }, '탭한 자리에 불바다'),
  W('hand', 'snipe', '🎯', '저격 손', 'tapSnipe', 1.5, { dmg: 8, radius: 90 }, '탭 근처에서 체력이 가장 많은 적 한 방'),
  W('hand', 'frostHand', '❄️', '얼음 손', 'tapBoom', 1.4, { radius: 60, dmg: 0.8, freeze: 2.5 }, '탭한 자리를 얼린다 (언 적은 피해 2.5배)'),
  W('hand', 'shock', '👊', '충격파 손', 'tapBoom', 1, { radius: 70, dmg: 1, knock: 320 }, '탭한 자리에서 적을 날려 보낸다'),
  W('hand', 'poison', '☠️', '독 손', 'tapZone', 1.5, { radius: 50, dps: 0.8, ttl: 4, color: '#7dff5a' }, '탭한 자리에 독구름'),
  W('hand', 'punch', '🥊', '충격 타격', 'tapBoom', 0.7, { radius: 26, dmg: 6 }, '좁고 아주 세게 한 대'),
  W('hand', 'grenade', '🧨', '수류탄 손', 'tapThrow', 1, { boom: 55, dmg: 3, emoji: '🧨' }, '아래에서 수류탄을 던져 탭한 자리에 쾅'),
  W('hand', 'strike', '🌩️', '낙뢰 손', 'tapStrike', 1.4, { width: 18, dmg: 2.2 }, '탭한 세로줄에 벼락'),
  W('hand', 'missile', '🚀', '미사일 손', 'tapMissiles', 1.6, { count: 3, dmg: 2, boom: 34, homing: 5, speed: 380 }, '탭한 쪽으로 유도 미사일 세 발'),
  W('hand', 'hole', '🕳️', '블랙홀 손', 'tapPull', 4, { radius: 50, ttl: 1.2, dmg: 2.2, boom: 40 }, '탭한 자리로 빨아들였다가 쾅'),
  W('hand', 'coins', '🪙', '파편 비', 'tapRain', 2, { count: 8, radius: 24, dmg: 1.5, emoji: '🪙' }, '탭한 자리 주변에 동전이 쏟아진다'),

  // ── 총: 벽에 붙어 사거리 안의 적을 쏜다 ─────────────────────
  W('gun', 'pistol', '🔫', '권총', 'gun', 0.55, { range: 260, dmg: 1.4, speed: 760, look: L_PISTOL, tracer: 'line', color: '#ffe08a' }, '무난한 한 발씩', true),
  W('gun', 'revolver', '🤠', '리볼버', 'gun', 1, { range: 280, dmg: 3, pierce: 1, speed: 900, look: L_REVOLVER, tracer: 'line', color: '#ffd36b' }, '느리지만 묵직, 한 마리 뚫음'),
  W('gun', 'dual', '✌️', '쌍권총', 'gun', 0.3, { range: 240, dmg: 0.8, count: 2, spread: 0.12, speed: 760, look: L_PISTOL, tracer: 'line', color: '#ffe08a' }, '두 발씩 빠르게'),
  W('gun', 'smg', '💨', '기관단총', 'gun', 0.12, { range: 230, dmg: 0.4, spread: 0.14, speed: 800, look: L_SMG, tracer: 'line', color: '#ffe08a' }, '가까운 적에게 탄을 쏟아붓는다', true),
  W('gun', 'rifle', '🪖', '돌격소총', 'gun', 0.7, { range: 300, dmg: 0.9, burst: 3, speed: 900, look: L_RIFLE, tracer: 'line', color: '#fff0b0' }, '세 발 점사'),
  W('gun', 'shotgun', '🦌', '산탄총', 'gun', 1.1, { range: 190, dmg: 0.8, count: 7, spread: 0.5, speed: 700, look: L_SHOTGUN, tracer: 'line', color: '#ffb347' }, '가까이 오면 한 방에 쓸어버린다', true),
  W('gun', 'double', '🔱', '더블배럴', 'gun', 1.7, { range: 170, dmg: 0.8, count: 12, spread: 0.65, speed: 700, look: L_SHOTGUN, tracer: 'line', color: '#ffb347' }, '산탄 두 배'),
  W('gun', 'sniper', '🔭', '저격총', 'gun', 2, { range: 420, dmg: 8, pierce: 2, speed: 1600, target: 'strong', look: L_SNIPER, tracer: 'line', color: '#ffffff' }, '멀리서 가장 단단한 적을 꿰뚫는다'),
  W('gun', 'amr', '🦾', '대물저격총', 'gun', 3.2, { range: 460, dmg: 11, pierce: 99, speed: 2200, target: 'strong', look: L_AMR, tracer: 'line', color: '#ffffff' }, '줄에 선 적을 전부 뚫는 한 방'),
  W('gun', 'minigun', '🌀', '미니건', 'gun', 0.06, { range: 250, dmg: 0.3, spread: 0.16, speed: 900, look: L_MINIGUN, tracer: 'line', color: '#ffe08a' }, '쉬지 않고 갈긴다'),
  W('gun', 'gatling', '⚙️', '개틀링', 'gun', 0.09, { range: 260, dmg: 0.3, count: 2, spread: 0.1, speed: 900, look: L_MINIGUN, tracer: 'line', color: '#ffd36b' }, '두 줄로 갈긴다'),
  W('gun', 'glauncher', '🥚', '유탄발사기', 'gun', 1.4, { range: 280, dmg: 2, boom: 42, speed: 420, look: L_GRENADE, tracer: 'ball', color: '#9aa35a', size: 4 }, '맞으면 터지는 유탄'),
  W('gun', 'rocket', '🚀', '로켓 런처', 'gun', 2.2, { range: 320, dmg: 3, boom: 60, speed: 330, homing: 2.5, look: L_TUBE, tracer: 'rocket', color: '#ff7a3c' }, '유도 로켓, 크게 터진다'),
  W('gun', 'mlrs', '🎆', '다연장 로켓', 'gun', 3.5, { range: 340, dmg: 1.6, boom: 40, burst: 6, homing: 3, speed: 300, look: L_POD, tracer: 'rocket', color: '#ff7a3c' }, '로켓 여섯 발 연속'),
  W('gun', 'flamer', '🔥', '화염방사기', 'gun', 0.05, { range: 140, dmg: 0.22, spread: 0.35, speed: 260, pierce: 99, ignite: true, look: L_FLAMER, tracer: 'flame', color: '#ff8a3c' }, '짧고 뜨겁게, 불이 옆으로 번진다'),
  W('ray', 'laser', '🔴', '레이저 소총', 'beam', 0.8, { range: 320, dmg: 2, pierce: 2, width: 3, look: L_LASER, color: '#ff3cc8' }, '빛줄기, 두 마리 뚫음'),
  W('ray', 'railgun', '🔷', '레일건', 'beam', 2.6, { range: 480, dmg: 9, pierce: 99, width: 6, look: L_RAIL, color: '#3ce0ff' }, '한 줄을 통째로 꿰뚫는 빛'),
  W('gun', 'plasma', '🟣', '플라즈마건', 'gun', 0.7, { range: 260, dmg: 1.4, boom: 26, speed: 480, look: L_PLASMA, tracer: 'ball', color: '#b54dff', size: 4 }, '작게 터지는 에너지탄'),
  W('gun', 'crossbow', '🏹', '석궁', 'gun', 1.1, { range: 320, dmg: 3, pierce: 3, speed: 950, look: L_CROSSBOW, tracer: 'arrow', color: '#e8d8b0' }, '세 마리 꿰뚫는 화살'),
  W('gun', 'nailgun', '📌', '네일건', 'gun', 0.15, { range: 220, dmg: 0.45, pierce: 1, speed: 850, look: L_SMG, tracer: 'line', color: '#c8d0e8' }, '못을 빠르게 박는다'),
  W('gun', 'musket', '🎩', '머스킷', 'gun', 2.4, { range: 300, dmg: 6, speed: 900, look: L_RIFLE, tracer: 'line', color: '#ffffff' }, '한 발, 아주 세게, 연기 펑'),
  W('gun', 'water', '💦', '고압 수포', 'gun', 0.08, { range: 200, dmg: 0.12, knock: 260, speed: 520, look: L_WATER, tracer: 'ball', color: '#4dd2ff', size: 3 }, '피해는 쥐꼬리, 대신 적을 밀어낸다'),
  W('gun', 'freezegun', '🧊', '냉동총', 'gun', 0.35, { range: 240, dmg: 0.5, freeze: 0.8, speed: 700, look: L_LASER, tracer: 'ball', color: '#9fe8ff', size: 3 }, '맞은 적이 잠깐 언다'),
  W('gun', 'dart', '🦂', '독침총', 'gun', 0.5, { range: 260, dmg: 0.6, ignite: true, speed: 800, look: L_PISTOL, tracer: 'arrow', color: '#7dff5a' }, '맞은 적에 독(불)이 붙고 옆으로 번진다'),
  W('gun', 'teslagun', '🔌', '번개총', 'gun', 0.8, { range: 260, dmg: 1.2, chain: 3, speed: 900, look: L_PLASMA, tracer: 'ball', color: '#9fe8ff', size: 3 }, '맞힌 뒤 번개가 세 마리로 옮겨 간다'),
  W('gun', 'bouncer', '🏓', '도탄총', 'gun', 0.5, { range: 900, dmg: 1, bounce: 3, speed: 600, look: L_PISTOL, tracer: 'ball', color: '#ffd36b', size: 3 }, '탄이 벽에 세 번 튕긴다'),
  W('gun', 'popcorn', '🍿', '파쇄 기관총', 'gun', 0.4, { range: 240, dmg: 0.8, popcorn: true, speed: 700, look: L_SMG, tracer: 'emoji', emoji: '🍿', size: 12 }, '맞으면 파편 넷으로 튄다'),
  W('gun', 'orbgun', '🌑', '블랙홀 건', 'gun', 3, { range: 260, dmg: 3, boom: 45, pullOrb: true, speed: 140, look: L_PLASMA, tracer: 'ball', color: '#5a3c8a', size: 8 }, '느린 구슬이 적을 빨아들이다 터진다'),
  W('gun', 'missilepod', '🛩️', '미사일 포대', 'gun', 2.6, { range: 360, dmg: 1.5, boom: 34, burst: 4, homing: 4, speed: 280, look: L_POD, tracer: 'rocket', color: '#ffb347' }, '유도 미사일 네 발'),

  // ── 포탑: 아래 칸에 서서 ───────────────────────────────────
  W('turret', 'cannon', '🏰', '대포', 'lob', 3, { range: 320, dmg: 2.5, boom: 46 }, '몰린 곳에 포탄'),
  W('turret', 'mortar', '🏯', '박격포', 'lob', 4.5, { range: 380, dmg: 4, boom: 70, speed: 300 }, '멀리 높이, 크게 터진다'),
  W('ray', 'tesla', '🗼', '테슬라 코일', 'zap', 2.2, { range: 260, count: 3, dmg: 1.6 }, '세 마리를 지진다', true),
  W('air', 'satellite', '🛰️', '위성 레이저', 'column', 7, { range: 320, dmg: 4, width: 20 }, '몰린 줄에 레이저 기둥'),
  W('field', 'frost', '❄️', '냉각탑', 'frostArea', 5, { range: 280, radius: 55, dmg: 0.5, freeze: 2 }, '몰린 곳을 2초 얼린다'),
  W('field', 'flametower', '♨️', '화염탑', 'zoneAt', 3, { range: 220, radius: 40, dps: 1.2, ttl: 3 }, '몰린 곳에 불바다'),
  W('field', 'gas', '☁️', '독가스탑', 'zoneAt', 4, { range: 260, radius: 60, dps: 0.7, ttl: 5, color: '#7dff5a' }, '넓게 오래 가는 독구름'),
  W('spinner', 'saw', '🪚', '회전톱', 'saw', 5, { range: 300, dmg: 1.5, ttl: 5, speed: 260 }, '톱날이 화면을 튕겨 다니며 썬다'),
  W('field', 'magnet', '🧲', '자석탑', 'pullAt', 6, { range: 280, radius: 100, ttl: 1.2, dmg: 2, boom: 60 }, '적을 한데 모았다가 쾅'),
  W('air', 'bolttower', '🌩️', '낙뢰탑', 'strikes', 1.8, { range: 300, count: 2, dmg: 2, width: 14 }, '사거리 안에 벼락 두 줄기'),
  W('field', 'bubble', '🫧', '거품 발생기', 'bubble', 4, { range: 280, radius: 50, dmg: 3, ttl: 2 }, '거품에 가둬 띄웠다가 펑'),
  W('sound', 'bell', '🔔', '종탑', 'pulse', 4, { range: 160, dmg: 0.8, freeze: 0.4 }, '울릴 때마다 주변 적을 때리고 멈칫'),

  // ── 소환수 ─────────────────────────────────────────────────
  W('summon', 'soldier', '💂', '자폭 병사', 'walker', 3, { count: 1, speed: 90, boom: 46, dmg: 2.5, emoji: '💂' }, '걸어 나가 적에게 안겨 터진다', true),
  W('summon', 'sheep', '🐑', '숫양 돌격대', 'walker', 4, { count: 1, speed: 150, boom: 58, dmg: 3, emoji: '🐑' }, '뛰쳐나가 박치기하고 터진다', true),
  W('summon', 'chicken', '🐔', '폭탄 까마귀', 'walker', 2.5, { count: 3, speed: 170, boom: 28, dmg: 1.2, emoji: '🐔' }, '닭 세 마리가 우르르, 작게 터진다'),
  W('summon', 'granny', '👵', '폭파 공병', 'walker', 7, { count: 1, speed: 45, boom: 95, dmg: 6, emoji: '👵' }, '느릿느릿, 크게 터진다'),
  W('summon', 'rats', '🐀', '역병 쥐떼', 'walker', 4, { count: 6, speed: 180, boom: 18, dmg: 1.2, emoji: '🐀' }, '쥐 여섯 마리가 흩어져 문다'),
  W('summon', 'bees', '🐝', '말벌 떼', 'walker', 3, { count: 5, speed: 200, melee: 1, dmg: 1.2, emoji: '🐝' }, '벌 다섯 마리가 흩어져 쏜다'),
  W('summon', 'dog', '🐕', '군견', 'walker', 5, { count: 1, speed: 160, melee: 6, dmg: 1.8, emoji: '🐕' }, '여섯 번 물고 돌아간다'),
  W('summon', 'bear', '🐻', '전투 곰', 'walker', 8, { count: 1, speed: 80, melee: 10, dmg: 3, size: 30, emoji: '🐻' }, '열 번 후려친다'),
  W('summon', 'robot', '🤖', '전투 로봇', 'walker', 7, { count: 1, speed: 70, melee: 8, dmg: 2.5, boom: 60, emoji: '🤖' }, '여덟 번 때리고 자폭'),
  W('charge', 'knight', '🏇', '기사단', 'stamp', 9, { count: 4, speed: 220, dmg: 2, dir: 'up', emoji: '🏇' }, '기사 넷이 위로 돌격'),
  W('charge', 'dino', '🦖', '공룡', 'stamp', 12, { count: 2, speed: 230, dmg: 3, dir: 'side', emoji: '🦖' }, '화면을 가로지르며 짓밟는다'),
  W('charge', 'cows', '🐄', '들소 떼', 'stamp', 10, { count: 3, speed: 240, dmg: 2.5, dir: 'up', emoji: '🐄' }, '방어선에서 위로 들이받는다'),
  W('charge', 'rhino', '🦏', '코뿔소', 'stamp', 9, { count: 1, speed: 300, dmg: 5, dir: 'side', size: 26, emoji: '🦏' }, '한 마리, 아주 세게 들이받는다'),
  W('charge', 'elephant', '🐘', '전투 코끼리', 'stamp', 14, { count: 3, speed: 140, dmg: 3, dir: 'up', size: 28, emoji: '🐘' }, '느리지만 다 깔아뭉갠다'),
  W('charge', 'penguin', '🐧', '빙판 돌격대', 'stamp', 6, { count: 4, speed: 320, dmg: 1, dir: 'up', freeze: 0.8, emoji: '🐧' }, '배로 미끄러지며 얼린다'),
  W('throw', 'cat', '🐱', '화염 술사', 'toss', 1.6, { range: 300, dmg: 1.5, boom: 34, ignite: true, emoji: '🔥' }, '불덩이를 던진다', true),
  W('throw', 'monkey', '🐒', '투척병', 'toss', 2, { range: 280, dmg: 2, boom: 40, emoji: '🍌' }, '수류탄을 던진다'),
  W('throw', 'octopus', '🐙', '점액 투척병', 'toss', 2.5, { range: 260, dmg: 0.8, boom: 50, freeze: 1.5, emoji: '💧' }, '먹물로 적을 굳힌다'),
  W('ray', 'wizard', '🧙', '뇌전 술사', 'zap', 2, { range: 300, count: 2, dmg: 2 }, '지팡이 번개 두 줄기'),
  W('gun', 'archer', '🏹', '궁수', 'gun', 0.9, { range: 320, dmg: 1.6, pierce: 1, speed: 900, tracer: 'arrow', color: '#e8d8b0', slot: true }, '화살, 한 마리 뚫음'),
  W('gun', 'ninja', '🥷', '표창수', 'gun', 0.6, { range: 260, dmg: 1, count: 3, spread: 0.3, pierce: 2, speed: 700, tracer: 'emoji', emoji: '✴️', size: 10, slot: true }, '표창 세 개를 부채꼴로'),
  W('spirit', 'drone', '🚁', '드론 편대', 'drone', 0.5, { range: 220, dmg: 0.9, speed: 800, tracer: 'line', color: '#9fe8ff' }, '드론이 떠서 돌며 쏜다'),
  W('charge', 'dragonling', '🐲', '와이번', 'event', 10, { event: 'dragon', range: 300 }, '날아가며 불을 뿜는다'),
  W('air', 'eagle', '🦅', '독수리', 'drop', 6, { range: 320, dmg: 5, radius: 40, target: 'strong', emoji: '🦅' }, '가장 단단한 적에게 내리꽂는다'),

  // ── 마법: 쿨다운마다 저절로 ────────────────────────────────
  W('air', 'meteor', '☄️', '운석우', 'event', 12, { event: 'meteor', range: 320 }, '운석이 쏟아진다', true),
  W('air', 'airstrike', '✈️', '공습', 'event', 14, { event: 'airstrike', range: 320 }, '몰린 줄에 폭탄을 줄줄이'),
  W('throw', 'banana', '🍌', '분열 폭탄', 'event', 10, { event: 'banana', range: 300 }, '터지고 갈라져 또 터진다'),
  W('charge', 'tornado', '🌪️', '토네이도', 'event', 16, { event: 'tornado', range: 300 }, '빨아들여 돌리다 폭발'),
  W('magic', 'ufo', '🛸', '공중 부양', 'event', 18, { event: 'ufo', range: 320 }, '빔으로 들어 올렸다 한꺼번에 터뜨림'),
  W('charge', 'train', '🚂', '폭주 기관차', 'event', 15, { event: 'train', range: 300 }, '한 줄을 통째로 밀어버린다'),
  W('air', 'donkey', '🐴', '콘크리트 낙하', 'event', 14, { event: 'donkey', range: 320 }, '떨어져 다섯 번 튕기며 쾅'),
  W('charge', 'dragon', '🐉', '드래곤', 'event', 16, { event: 'dragon', range: 340 }, '날아가며 아래로 불'),
  W('magic', 'jackpot', '🎰', '운명의 수레바퀴', 'event', 25, { event: 'jackpot', range: 320 }, '777이면 화면 폭파'),
  W('air', 'nuke', '☢️', '핵', 'nuke', 45, { range: 360, dmg: 8 }, '사거리 안 전부 폭파'),
  W('charge', 'tsunami', '🌊', '해일', 'sweep', 20, { range: 300, dmg: 4, width: 50, dir: 'up', knock: 200, emoji: '🌊' }, '아래에서 위로 쓸어 올린다'),
  W('magic', 'blackhole', '🕳️', '블랙홀', 'pullAt', 24, { range: 320, radius: 70, ttl: 2.5, dmg: 4, boom: 55 }, '한 점으로 빨아들였다가 대폭발'),
  W('air', 'storm', '⛈️', '번개 폭풍', 'storm', 18, { range: 320, ttl: 4, dmg: 2 }, '4초 동안 벼락이 쏟아진다'),
  W('air', 'volcano', '🌋', '화산', 'rain', 16, { range: 300, count: 10, dmg: 2.5, radius: 40, fromBottom: true, ignite: true, emoji: '🔥' }, '바닥에서 용암이 솟구친다'),
  W('air', 'whale', '🐋', '중력 폭탄', 'drop', 16, { range: 320, dmg: 8, radius: 110, target: 'dense', emoji: '🐋', size: 70 }, '몰린 곳을 짓누르는 중력 폭탄'),
  W('charge', 'bowling', '🎳', '철구', 'sweep', 12, { range: 340, dmg: 5, width: 40, dir: 'up', emoji: '🎳', size: 40 }, '한 줄을 굴러 올라가며 스트라이크'),
  W('air', 'acid', '🌧️', '산성비', 'rain', 14, { range: 300, count: 24, dmg: 0.8, radius: 18, ignite: true, emoji: '💧' }, '자잘한 비가 녹인다'),
  W('magic', 'icestorm', '🌨️', '얼음 폭풍', 'freezeAll', 22, { range: 300, dmg: 1, freeze: 2.5 }, '사거리 안 전부 얼린다'),
  W('air', 'hammer', '🔨', '거대 망치', 'drop', 14, { range: 320, dmg: 7, radius: 90, target: 'dense', emoji: '🔨', size: 64 }, '쿵!'),
  W('air', 'orbital', '📡', '궤도 폭격', 'columns', 18, { range: 320, count: 5, dmg: 4, width: 20 }, '레이저 기둥 다섯 줄'),
  W('sound', 'quake', '🌍', '지진', 'quake', 20, { range: 300, dmg: 1.8, freeze: 0.6 }, '화면 안 전부 흔들어 멈칫'),
  W('air', 'stars', '🌠', '유성 파편', 'rain', 12, { range: 320, count: 16, dmg: 1.6, radius: 30, emoji: '🌠' }, '별이 쏟아진다'),
  W('air', 'santa', '🎅', '야간 폭격', 'event', 18, { event: 'airstrike', range: 320, emoji: '🎅' }, '폭탄을 뿌리고 지나간다'),
  W('air', 'pizza', '🍕', '소이 폭격', 'rain', 13, { range: 300, count: 10, dmg: 2, radius: 36, emoji: '🍕' }, '소이탄이 떨어져 터진다'),

  // ════ 11-08 무기 확장: 기존 갈래에 더 ════════════════════════
  // ── 손공격 +11 ──
  W('hand', 'h_chain', '⛓️', '사슬 번개 손', 'tapZap', 0.9, { count: 5, dmg: 1.3, radius: 140 }, '탭 근처 다섯 마리에 번개'),
  W('hand', 'h_kick', '🦶', '충격 발파', 'tapBoom', 0.8, { radius: 40, dmg: 3, knock: 260 }, '좁게 세게 차서 날려 보낸다'),
  W('hand', 'h_lava', '🫕', '용암 손', 'tapZone', 1.1, { radius: 44, dps: 1.5, ttl: 2.5, color: '#ff5a2a' }, '탭한 자리에 용암'),
  W('hand', 'h_honey', '🍯', '점착 손', 'tapBoom', 1.6, { radius: 70, dmg: 0.4, freeze: 1.6 }, '끈적하게 붙잡아 멈춘다'),
  W('hand', 'h_star', '⭐', '성광 투척', 'tapThrow', 0.9, { boom: 40, dmg: 2.4, emoji: '⭐' }, '아래에서 별을 던져 쾅'),
  W('hand', 'h_blades', '🤺', '쌍검 손', 'tapSlash', 1, { dmg: 1.8, width: 20 }, '탭한 높이를 두껍게 벤다'),
  W('hand', 'h_rocks', '🪨', '바위 손', 'tapRain', 2.2, { count: 4, radius: 40, dmg: 1.8, emoji: '🪨' }, '탭한 자리에 바위 네 개'),
  W('hand', 'h_fireworks', '🎇', '소이 미사일 손', 'tapMissiles', 1.8, { count: 5, dmg: 1.2, boom: 26, homing: 4, speed: 360 }, '유도 불꽃 다섯 발'),
  W('hand', 'h_trident', '🔱', '삼지창 손', 'tapStrike', 1.6, { width: 26, dmg: 2.6 }, '탭한 세로줄을 넓게 찍는다'),
  W('hand', 'h_gravity', '⚫', '중력 손', 'tapPull', 3.5, { radius: 70, ttl: 1.4, dmg: 2, boom: 50 }, '넓게 빨아들였다가 쾅'),
  W('hand', 'h_pointer', '🔦', '조준 레이저 손', 'tapSnipe', 1.1, { dmg: 5, radius: 120 }, '탭 근처 가장 단단한 적을 지진다'),

  // ── 총 +15 ──
  W('gun', 'g_magnum', '🐂', '매그넘', 'gun', 1.3, { range: 280, dmg: 4.5, pierce: 1, speed: 1000, look: L_REVOLVER, tracer: 'line', color: '#ffd36b' }, '한 방이 아주 세다'),
  W('gun', 'g_burst', '🔰', '3점사 권총', 'gun', 0.8, { range: 260, dmg: 0.8, burst: 3, speed: 850, look: L_PISTOL, tracer: 'line', color: '#ffe08a' }, '세 발씩 끊어 쏜다'),
  W('gun', 'g_lmg', '🧱', '경기관총', 'gun', 0.1, { range: 270, dmg: 0.4, spread: 0.12, speed: 900, look: L_RIFLE, tracer: 'line', color: '#ffe08a' }, '멀리까지 꾸준히 갈긴다'),
  W('gun', 'g_carbine', '🪵', '카빈', 'gun', 0.5, { range: 300, dmg: 1.5, pierce: 1, speed: 950, look: L_RIFLE, tracer: 'line', color: '#fff0b0' }, '가볍고 정확하다'),
  W('gun', 'g_slug', '🐌', '슬러그 산탄총', 'gun', 1.4, { range: 220, dmg: 5, pierce: 2, speed: 800, look: L_SHOTGUN, tracer: 'line', color: '#ffb347' }, '산탄 대신 큰 한 알'),
  W('gun', 'g_autoshot', '🔩', '자동 산탄총', 'gun', 0.6, { range: 180, dmg: 0.6, count: 5, spread: 0.45, speed: 700, look: L_SHOTGUN, tracer: 'line', color: '#ffb347' }, '산탄을 빠르게 연속으로'),
  W('gun', 'g_dmr', '🎐', '지정사수 소총', 'gun', 1.1, { range: 380, dmg: 4, pierce: 1, speed: 1400, target: 'strong', look: L_SNIPER, tracer: 'line', color: '#ffffff' }, '단단한 적을 자주 저격'),
  W('gun', 'g_harpoon', '🪝', '작살총', 'gun', 1.6, { range: 280, dmg: 3.5, pierce: 3, knock: 120, speed: 700, look: L_CROSSBOW, tracer: 'arrow', color: '#c8d0e8' }, '꿰뚫고 밀어낸다'),
  W('gun', 'g_flare', '🌟', '조명탄총', 'gun', 1.2, { range: 300, dmg: 1.6, boom: 30, ignite: true, speed: 500, look: L_GRENADE, tracer: 'ball', color: '#ffeb3c', size: 4 }, '맞은 자리를 태운다'),
  W('gun', 'g_coldrifle', '🌬️', '냉기 소총', 'gun', 0.6, { range: 280, dmg: 0.9, freeze: 0.5, pierce: 1, speed: 900, look: L_LASER, tracer: 'line', color: '#9fe8ff' }, '뚫고 지나가며 얼린다'),
  W('ray', 'g_pulse', '💠', '펄스 소총', 'beam', 1, { range: 300, dmg: 2.4, pierce: 3, width: 4, look: L_LASER, color: '#3cffd0' }, '세 마리를 꿰는 빛'),
  W('gun', 'g_arc', '🔗', '아크 건', 'gun', 1, { range: 250, dmg: 1, chain: 4, speed: 900, look: L_PLASMA, tracer: 'ball', color: '#bfe8ff', size: 3 }, '번개가 네 마리로 옮겨 간다'),
  W('gun', 'g_spread', '✳️', '확산총', 'gun', 0.9, { range: 240, dmg: 1, count: 5, spread: 0.9, speed: 700, look: L_SMG, tracer: 'ball', color: '#ff9ad5', size: 3 }, '부채꼴로 넓게'),
  W('gun', 'g_ricochet', '🎱', '반사 권총', 'gun', 0.7, { range: 900, dmg: 1.2, bounce: 2, pierce: 1, speed: 700, look: L_REVOLVER, tracer: 'ball', color: '#ffe08a', size: 3 }, '벽에 튕기고 뚫는다'),
  W('gun', 'g_candy', '🧸', '분열탄 권총', 'gun', 0.25, { range: 220, dmg: 0.6, popcorn: true, speed: 600, look: L_PISTOL, tracer: 'emoji', emoji: '🍬', size: 10 }, '맞으면 네 조각으로 갈라진다'),

  // ── 포탑 +10 ──
  W('turret', 't_howitzer', '🎖️', '곡사포', 'lob', 5, { range: 420, dmg: 5, boom: 80, speed: 280 }, '아주 멀리, 아주 크게'),
  W('turret', 't_flak', '🛡️', '대공포', 'lob', 1.2, { range: 340, dmg: 1, boom: 26, count: 2, speed: 600 }, '작은 포탄 두 발씩 자주'),
  W('ray', 't_battery', '🔋', '축전탑', 'zap', 1.4, { range: 240, count: 2, dmg: 1.4 }, '두 마리를 자주 지진다'),
  W('field', 't_inferno', '🏮', '지옥불탑', 'zoneAt', 2.4, { range: 200, radius: 34, dps: 1.8, ttl: 2, color: '#ff5a2a' }, '좁고 뜨거운 불바다'),
  W('field', 't_icewall', '🗻', '빙벽탑', 'frostArea', 4, { range: 300, radius: 70, dmg: 0.4, freeze: 1.6 }, '넓게 얼린다'),
  W('gun', 't_ballista', '⚔️', '노포', 'gun', 1.6, { range: 360, dmg: 4, pierce: 4, speed: 1000, tracer: 'arrow', color: '#e8d8b0', slot: true }, '큰 화살이 네 마리를 꿴다'),
  W('air', 't_torii', '⛩️', '번개 문', 'strikes', 2, { range: 300, count: 2, dmg: 1.8, width: 14 }, '벼락 두 줄기'),
  W('sound', 't_fountain', '⛲', '수압 분사기', 'pulse', 2, { range: 170, dmg: 0.5, freeze: 0.5, knock: 100, color: '#4dd2ff' }, '물보라로 밀고 멈칫'),
  W('turret', 't_catapult', '🪵', '투석기', 'lob', 3.5, { range: 360, dmg: 3.5, boom: 56, speed: 360, emoji: '🪨' }, '바위를 날린다'),
  W('field', 't_blacktower', '🏴', '검은 탑', 'pullAt', 7, { range: 300, radius: 110, ttl: 1.4, dmg: 2.4, boom: 60 }, '넓게 모았다가 쾅'),
  W('turret', 't_incendiary', '🔥', '소이포', 'lob', 3.2, { range: 340, dmg: 2, boom: 48, ignite: true }, '터진 자리가 불탄다'),
  W('turret', 't_frostshell', '❄️', '냉각포', 'lob', 3.6, { range: 340, dmg: 1.6, boom: 52, freeze: 1.2 }, '터진 자리가 언다'),
  W('turret', 't_cluster', '🔻', '산탄포', 'lob', 3.4, { range: 340, dmg: 2, boom: 34, count: 3 }, '포탄 세 발이 흩어져 떨어진다'),
  W('turret', 't_shockshell', '💡', '전기포', 'lob', 3, { range: 320, dmg: 2.6, boom: 40, chain: 2 }, '터진 자리에서 번개가 옮겨 간다'),
  W('turret', 't_fortress', '🏛️', '요새포', 'lob', 7, { range: 440, dmg: 7, boom: 96, speed: 260 }, '아주 크게 한 방'),
  W('turret', 't_rapid', '🧰', '연발포', 'lob', 1.6, { range: 300, dmg: 1.2, boom: 30, count: 2, speed: 560 }, '작은 포탄을 자주'),

  // ── 소환수 +12 ──
  W('summon', 'su_wolf', '🐺', '늑대 무리', 'walker', 4, { count: 3, speed: 190, melee: 3, dmg: 1.4, emoji: '🐺' }, '셋이 몰려가 세 번씩 문다'),
  W('summon', 'su_fox', '🦊', '불여우', 'walker', 3, { count: 1, speed: 210, melee: 5, dmg: 1.2, ignite: true, emoji: '🦊' }, '물면 여우불이 붙는다'),
  W('summon', 'su_gorilla', '🦍', '철권 고릴라', 'walker', 9, { count: 1, speed: 90, melee: 8, dmg: 3.5, size: 30, emoji: '🦍' }, '여덟 번 내리친다'),
  W('charge', 'su_tiger', '🐅', '호랑이', 'stamp', 8, { count: 1, speed: 340, dmg: 4, dir: 'side', size: 28, emoji: '🐅' }, '빠르게 가로지른다'),
  W('summon', 'su_zombie', '🧟', '좀비 떼', 'walker', 5, { count: 4, speed: 60, melee: 6, dmg: 1, emoji: '🧟' }, '느릿느릿, 오래 물고 늘어진다'),
  W('summon', 'su_crab', '🦀', '강철 게', 'walker', 3, { count: 2, speed: 120, melee: 4, dmg: 1.4, emoji: '🦀' }, '옆걸음으로 가서 집는다'),
  W('summon', 'su_turtle', '🐢', '폭뢰 거북', 'walker', 6, { count: 1, speed: 50, boom: 80, dmg: 5, emoji: '🐢' }, '느리지만 크게 터진다'),
  W('charge', 'su_unicorn', '🦄', '뿔 기병', 'stamp', 10, { count: 1, speed: 320, dmg: 4, dir: 'up', size: 26, emoji: '🦄' }, '뿔로 위까지 꿰뚫는다'),
  W('charge', 'su_shark', '🦈', '상어', 'stamp', 9, { count: 2, speed: 300, dmg: 3, dir: 'side', emoji: '🦈' }, '두 마리가 가로질러 문다'),
  W('air', 'su_owl', '🦉', '야간 맹금', 'drop', 5, { range: 320, dmg: 3.5, radius: 34, target: 'strong', emoji: '🦉' }, '단단한 적에게 내리꽂는다'),
  W('summon', 'su_pigs', '🐖', '폭약 하이에나', 'walker', 5, { count: 3, speed: 140, boom: 36, dmg: 1.6, emoji: '🐖' }, '돌진해서 터진다'),
  W('summon', 'su_kangaroo', '🦘', '파쇄 골렘', 'walker', 5, { count: 1, speed: 170, melee: 6, dmg: 2, emoji: '🦘' }, '여섯 번 주먹질'),

  // ── 마법 +12 ──
  W('air', 'm_hellrain', '🔥', '지옥불 비', 'rain', 14, { range: 320, count: 18, dmg: 1.6, radius: 30, ignite: true, emoji: '🔥' }, '불덩이가 쏟아져 태운다'),
  W('charge', 'm_avalanche', '🏔️', '눈사태', 'sweep', 18, { range: 300, dmg: 3, width: 60, dir: 'up', freeze: 1.2, emoji: '🏔️' }, '쓸어 올리며 얼린다'),
  W('air', 'm_zeus', '🌩️', '천둥 신', 'storm', 20, { range: 320, ttl: 5, dmg: 2.4 }, '5초 동안 벼락'),
  W('air', 'm_rockfall', '⛰️', '낙석', 'rain', 13, { range: 320, count: 8, dmg: 3, radius: 44, emoji: '🪨' }, '큰 바위가 떨어진다'),
  W('magic', 'm_timestop', '⏳', '시간 정지', 'spell', 22, { spell: 'stop', ttl: 2.5 }, '사거리 안 적 전부가 멈춘다'),
  W('magic', 'm_poly', '🌀', '변이', 'spell', 12, { spell: 'poly', count: 4, ttl: 4 }, '앞줄 넷을 작은 덩어리로: 아주 느리고 받는 피해 ×2'),
  W('magic', 'm_polyX', '🌌', '대변이', 'spell', 24, { spell: 'poly', count: 10, ttl: 5 }, '앞줄 열을 변이'),
  W('magic', 'm_recall', '↩️', '되돌리기', 'spell', 14, { spell: 'recall', count: 5 }, '앞줄 다섯을 화면 위로 순간이동'),
  W('magic', 'm_recallX', '🔄', '대되돌리기', 'spell', 26, { spell: 'recall', count: 12 }, '앞줄 열둘을 화면 위로'),
  W('magic', 'm_clone', '🪞', '분신', 'spell', 16, { spell: 'clone', count: 1, ttl: 5 }, '내 무기 하나가 5초 동안 두 배로 자주 쏜다'),
  W('magic', 'm_cloneX', '🎭', '대분신', 'spell', 28, { spell: 'clone', count: 3, ttl: 5 }, '내 무기 셋이 두 배로'),
  W('magic', 'm_charm', '💘', '매혹', 'spell', 14, { spell: 'charm', count: 3, ttl: 5 }, '앞줄 셋이 잠깐 우리 편: 거슬러 올라가며 부딪친 적을 친다'),
  W('magic', 'm_charmX', '💞', '집단 매혹', 'spell', 26, { spell: 'charm', count: 7, ttl: 5 }, '앞줄 일곱이 우리 편'),
  W('magic', 'm_haste', '⏩', '가속', 'spell', 20, { spell: 'haste', ttl: 4 }, '4초 동안 모든 무기 쿨다운 ×0.6'),
  W('air', 'm_frogs', '🐸', '독침 비', 'rain', 11, { range: 320, count: 20, dmg: 1, radius: 22, emoji: '🐸' }, '독침이 쏟아진다'),
  W('air', 'm_cards', '🃏', '칼날 비', 'rain', 10, { range: 320, count: 22, dmg: 0.9, radius: 18, emoji: '🃏' }, '칼날이 흩날려 꽂힌다'),
  W('air', 'm_supernova', '🌅', '초신성', 'nuke', 50, { range: 380, dmg: 8.5 }, '사거리 안 전부 태워 버린다'),
  W('magic', 'm_wormhole', '♾️', '웜홀', 'pullAt', 20, { range: 320, radius: 90, ttl: 3, dmg: 5, boom: 70 }, '오래 빨아들였다가 대폭발'),
  W('air', 'm_comet', '💫', '혜성', 'drop', 14, { range: 340, dmg: 9, radius: 100, target: 'dense', emoji: '💫', size: 60 }, '몰린 곳에 혜성'),
  W('air', 'm_lasergrid', '🔳', '레이저 그물', 'columns', 16, { range: 320, count: 7, dmg: 3, width: 14 }, '레이저 기둥 일곱 줄'),
  W('charge', 'm_flood', '🚿', '홍수', 'sweep', 16, { range: 300, dmg: 3.5, width: 60, dir: 'up', knock: 260, emoji: '💦' }, '물이 쓸어 올려 밀어낸다'),

  // ════ 11-08 새 갈래 ═══════════════════════════════════════
  // ── 함정: 적이 올 길에 깔아 두고, 밟으면 터진다 ──
  W('trap', 'tr_mines', '💣', '지뢰밭', 'trap', 2.5, { range: 260, count: 2, dmg: 3, boom: 44, emoji: '💣' }, '지뢰 두 개를 깔아 둔다', true),
  W('trap', 'tr_bear', '🪤', '덫', 'trap', 2, { range: 240, count: 1, dmg: 6, boom: 18, freeze: 1.5, emoji: '🪤' }, '밟으면 꽉 물고 멈춘다'),
  W('trap', 'tr_spikes', '📍', '가시 바닥', 'trap', 1.6, { range: 260, count: 2, dmg: 1.4, boom: 26, melee: 4, emoji: '📍' }, '네 번 밟혀도 남는다', true),
  W('trap', 'tr_glue', '🫙', '점착 지대', 'trap', 3, { range: 260, count: 2, dmg: 0.4, boom: 40, freeze: 1.2, melee: 3, emoji: '🫙' }, '넓게 붙잡는다'),
  W('trap', 'tr_ember', '🕯️', '불씨 함정', 'trap', 2.5, { range: 260, count: 2, dmg: 1.5, boom: 36, ignite: true, emoji: '🕯️' }, '밟으면 불이 붙는다'),
  W('trap', 'tr_ice', '🧊', '얼음 함정', 'trap', 3, { range: 260, count: 2, dmg: 0.8, boom: 40, freeze: 2, emoji: '🧊', color: '#9fe8ff' }, '밟으면 얼어붙는다'),
  W('trap', 'tr_spring', '🪀', '발사판', 'trap', 2.2, { range: 260, count: 2, dmg: 1, boom: 34, knock: 320, emoji: '🪀' }, '밟으면 튕겨 날아간다'),
  W('trap', 'tr_tnt', '🧨', '폭약 상자', 'trap', 4, { range: 280, count: 1, dmg: 6, boom: 80, emoji: '🧨' }, '크게 터진다'),
  W('trap', 'tr_claymore', '📦', '클레이모어', 'trap', 3, { range: 260, count: 1, dmg: 4, boom: 60, emoji: '📦' }, '넓게 터진다'),
  W('trap', 'tr_peel', '🍌', '미끄럼 기름', 'trap', 1.5, { range: 240, count: 3, dmg: 0.6, boom: 20, freeze: 0.8, emoji: '🍌' }, '미끄러져 넘어진다'),
  W('trap', 'tr_shock', '⚡', '전기 바닥', 'trap', 2.5, { range: 260, count: 2, dmg: 1.2, boom: 30, melee: 3, emoji: '⚡', color: '#9fe8ff' }, '세 번까지 지진다'),
  W('trap', 'tr_lego', '🧩', '마름쇠', 'trap', 1, { range: 240, count: 3, dmg: 0.8, boom: 14, melee: 2, emoji: '🧩' }, '밟으면 아프다'),
  W('trap', 'tr_crackers', '🎆', '소이 상자', 'trap', 3, { range: 280, count: 1, dmg: 2, boom: 50, ignite: true, emoji: '🎆', color: '#ff9ad5' }, '터지며 불꽃이 붙는다'),
  W('trap', 'tr_poison', '🧪', '독 함정', 'trap', 2.8, { range: 260, count: 2, dmg: 1, boom: 40, ignite: true, melee: 2, emoji: '🧪', color: '#7dff5a' }, '두 번 독을 뿜는다'),
  W('trap', 'tr_nuke', '☢️', '핵지뢰', 'trap', 12, { range: 300, count: 1, dmg: 10, boom: 120, emoji: '☢️' }, '하나, 아주 크게'),
  W('trap', 'tr_cactus', '🌵', '가시덩굴', 'trap', 2, { range: 250, count: 2, dmg: 1.2, boom: 22, melee: 5, emoji: '🌵' }, '다섯 번 찌른다'),
  W('trap', 'tr_cheese', '🧀', '압착 덫', 'trap', 1.4, { range: 240, count: 2, dmg: 2.2, boom: 20, emoji: '🧀' }, '작게 세게'),

  // ── 공중: 하늘에서 떨어뜨린다 (화면 어디든) ──
  W('air', 'a_bomber', '🛫', '폭격기', 'rain', 10, { range: 320, count: 8, dmg: 2.2, radius: 34, emoji: '💣' }, '폭탄 여덟 개를 뿌린다', true),
  W('air', 'a_para', '🪂', '낙하산 폭탄', 'rain', 9, { range: 320, count: 6, dmg: 2.5, radius: 38, emoji: '🪂' }, '낙하산 폭탄 여섯 개'),
  W('air', 'a_anchor', '⚓', '닻 낙하', 'drop', 8, { range: 320, dmg: 6, radius: 70, target: 'dense', emoji: '⚓', size: 44 }, '몰린 곳에 닻'),
  W('air', 'a_piano', '🎹', '강철 추 낙하', 'drop', 10, { range: 320, dmg: 7, radius: 80, target: 'dense', emoji: '🎹', size: 48 }, '몰린 곳에 쿵'),
  W('air', 'a_toilet', '🚽', '파쇄 낙하체', 'drop', 7, { range: 320, dmg: 5, radius: 60, emoji: '🚽', size: 40 }, '하늘에서 쇳덩이가'),
  W('air', 'a_hail', '🌨️', '우박', 'rain', 9, { range: 300, count: 20, dmg: 0.9, radius: 18, freeze: 0.5, emoji: '🧊' }, '자잘하게 쏟아지며 얼린다'),
  W('air', 'a_thundercloud', '🌥️', '뇌운', 'strikes', 2.2, { range: 340, count: 3, dmg: 1.8, width: 14 }, '벼락 세 줄기'),
  W('air', 'a_galaxy', '🌌', '은하 레이저', 'columns', 16, { range: 320, count: 4, dmg: 4.5, width: 18 }, '레이저 기둥 네 줄'),
  W('air', 'a_boulders', '🗻', '바위 비', 'rain', 11, { range: 320, count: 12, dmg: 2, radius: 30, emoji: '🪨' }, '바위가 쏟아진다'),
  W('air', 'a_chili', '🌶️', '네이팜', 'rain', 10, { range: 300, count: 12, dmg: 1.4, radius: 28, ignite: true, emoji: '🌶️' }, '매운 고추가 태운다', true),
  W('air', 'a_cluster', '🎊', '집속탄', 'rain', 12, { range: 320, count: 18, dmg: 1.2, radius: 24, emoji: '🎊' }, '작은 폭탄 열여덟 개'),
  W('air', 'a_gifts', '🎁', '보급 폭탄', 'drop', 6, { range: 320, dmg: 4, radius: 55, count: 2, emoji: '🎁', size: 36 }, '보급 상자 둘이 쾅'),
  W('air', 'a_ducks', '🦆', '급강하 편대', 'rain', 8, { range: 320, count: 6, dmg: 2, radius: 30, emoji: '🦆' }, '편대가 내리꽂힌다'),
  W('air', 'a_moon', '🌕', '위성 추락', 'drop', 30, { range: 340, dmg: 14, radius: 150, target: 'dense', emoji: '🌕', size: 90 }, '위성이 떨어진다'),
  W('air', 'a_sunray', '☀️', '햇빛 집중', 'columns', 12, { range: 320, count: 3, dmg: 4, width: 24 }, '굵은 빛기둥 세 줄'),
  W('air', 'a_balloons', '🎈', '부유 기뢰', 'rain', 7, { range: 300, count: 10, dmg: 1, radius: 22, emoji: '🎈' }, '떠내려와 펑'),
  W('air', 'a_boltrain', '🌦️', '번개비', 'strikes', 1.5, { range: 320, count: 2, dmg: 1.6, width: 12 }, '자주 내리치는 벼락'),

  // ── 돌격: 달려서 쓸고 간다 (화면 어디든) ──
  W('charge', 'c_tractor', '🚜', '분쇄 트랙터', 'stamp', 9, { count: 1, speed: 160, dmg: 5, dir: 'up', size: 28, emoji: '🚜' }, '느리게 위까지 밀고 간다', true),
  W('charge', 'c_bikers', '🏍️', '폭주족', 'stamp', 6, { count: 3, speed: 380, dmg: 1.6, dir: 'side', emoji: '🏍️' }, '셋이 빠르게 가로지른다', true),
  W('charge', 'c_bumper', '🚗', '장갑차', 'stamp', 5, { count: 2, speed: 300, dmg: 2, dir: 'side', knock: 120, emoji: '🚗' }, '들이받아 밀어낸다'),
  W('charge', 'c_bus', '🚌', '수송 장갑차', 'stamp', 12, { count: 1, speed: 220, dmg: 6, dir: 'side', size: 34, emoji: '🚌' }, '크게 가로지른다'),
  W('charge', 'c_firetruck', '🚒', '방수 장갑차', 'stamp', 10, { count: 1, speed: 240, dmg: 3, dir: 'up', knock: 200, emoji: '🚒' }, '위로 밀어 올린다'),
  W('charge', 'c_ambulance', '🚑', '돌격 차량', 'stamp', 8, { count: 1, speed: 340, dmg: 3.5, dir: 'side', emoji: '🚑' }, '아주 빠르게 가로지른다'),
  W('charge', 'c_roller', '🛞', '롤러', 'sweep', 14, { range: 320, dmg: 4, width: 46, dir: 'up', emoji: '🛞', size: 36 }, '한 줄을 깔아뭉갠다'),
  W('charge', 'c_dozer', '🏗️', '불도저', 'sweep', 16, { range: 300, dmg: 3, width: 60, dir: 'up', knock: 260, emoji: '🏗️' }, '화면 전체를 밀어 올린다'),
  W('charge', 'c_horses', '🐎', '말 떼', 'stamp', 9, { count: 5, speed: 280, dmg: 1.6, dir: 'up', emoji: '🐎' }, '다섯 마리가 위로 달린다'),
  W('charge', 'c_boars', '🐗', '멧돼지', 'stamp', 6, { count: 2, speed: 320, dmg: 2.6, dir: 'side', emoji: '🐗' }, '두 마리가 들이받는다'),
  W('charge', 'c_skate', '🛹', '고속 바이크', 'stamp', 4, { count: 2, speed: 360, dmg: 1.4, dir: 'up', emoji: '🛹' }, '자주, 빠르게'),
  W('charge', 'c_sled', '🛷', '설상 돌격정', 'stamp', 6, { count: 3, speed: 330, dmg: 1, freeze: 0.8, dir: 'up', emoji: '🛷' }, '미끄러지며 얼린다'),
  W('charge', 'c_rocketcart', '🛺', '로켓 썰매', 'stamp', 7, { count: 2, speed: 420, dmg: 2, dir: 'side', ignite: true, emoji: '🛺' }, '불을 뿜으며 가로지른다'),
  W('charge', 'c_mammoth', '🦣', '매머드', 'stamp', 15, { count: 1, speed: 130, dmg: 7, dir: 'up', size: 36, emoji: '🦣' }, '하나, 아주 무겁게'),
  W('charge', 'c_surf', '🏄', '해일 돌격', 'sweep', 12, { range: 300, dmg: 3, width: 50, dir: 'up', knock: 150, emoji: '🏄' }, '파도를 타고 쓸어 올린다'),
  W('charge', 'c_tram', '🚃', '전동차', 'stamp', 11, { count: 3, speed: 260, dmg: 2.5, dir: 'side', emoji: '🚃' }, '세 칸이 줄지어 가로지른다'),

  // ── 음파: 자리에서 둥글게 퍼진다 ──
  W('sound', 's_speaker', '🔊', '음파 스피커', 'pulse', 2, { range: 170, dmg: 1.4, knock: 120, color: '#ffd36b' }, '쿵쿵 울려 밀어낸다'),
  W('sound', 's_drum', '🥁', '공명 북', 'pulse', 3, { range: 190, dmg: 0.6, freeze: 0.3, color: '#ffb347' }, '둥 울려 멈칫'),
  W('sound', 's_guitar', '🎸', '앰프', 'pulse', 1.2, { range: 170, dmg: 1.1, color: '#ff3cc8' }, '짧고 자주', true),
  W('sound', 's_trumpet', '🎺', '전투 나팔', 'pulse', 2.4, { range: 210, dmg: 1.3, knock: 200, color: '#ffe08a' }, '세게 불어 날린다'),
  W('sound', 's_megaphone', '📢', '확성기', 'pulse', 3, { range: 230, dmg: 0.6, freeze: 0.6, color: '#ffffff' }, '넓게 외쳐 얼어붙게'),
  W('sound', 's_sax', '🎷', '저음 공명기', 'pulse', 1.8, { range: 180, dmg: 1, color: '#c77dff' }, '부드럽게 꾸준히'),
  W('sound', 's_violin', '🎻', '고주파 발진기', 'pulse', 1, { range: 140, dmg: 0.6, color: '#ff9ad5' }, '좁고 아주 자주'),
  W('sound', 's_janggu', '🪘', '전쟁 북', 'pulse', 2.6, { range: 200, dmg: 0.5, freeze: 0.4, color: '#ff8a3c' }, '덩 울려 멈칫'),
  W('sound', 's_orchestra', '🎼', '음향 포', 'pulse', 5, { range: 260, dmg: 2, color: '#9fe8ff' }, '크게 한 번'),
  W('sound', 's_siren', '🚨', '사이렌', 'pulse', 3.5, { range: 240, dmg: 0.5, freeze: 0.8, color: '#ff3c3c' }, '넓게 울려 얼어붙게'),
  W('sound', 's_woofer', '📻', '서브우퍼', 'pulse', 2.2, { range: 180, dmg: 1.5, knock: 160, color: '#5a3c8a' }, '낮게 울려 밀어낸다'),
  W('sound', 's_howl', '🎙️', '하울링 증폭기', 'pulse', 1.6, { range: 190, dmg: 1.2, ignite: true, color: '#ff5a2a' }, '귀가 타는 하울링', true),
  W('sound', 's_flute', '🪈', '최면 피리', 'pulse', 1.4, { range: 170, dmg: 0.4, freeze: 0.3, color: '#7dff9a' }, '가늘게 홀린다'),
  W('sound', 's_accordion', '🪗', '압축 음파기', 'pulse', 2, { range: 190, dmg: 1, color: '#ffd36b' }, '넓게 꾸준히'),

  // ── 회전체: 날아다니며 튕기고 썬다 ──
  W('spinner', 'sp_boomerang', '🪃', '부메랑', 'saw', 3, { range: 300, dmg: 0.84, ttl: 3, speed: 320, emoji: '🪃' }, '돌며 튕겨 다닌다', true),
  W('spinner', 'sp_disc', '💿', '원반', 'saw', 3.5, { range: 300, dmg: 0.96, ttl: 4, speed: 280, emoji: '💿' }, '오래 튕겨 다닌다', true),
  W('spinner', 'sp_yoyo', '🔘', '쌍날 원반', 'saw', 2, { range: 240, dmg: 0.6, ttl: 2.5, speed: 360, count: 2, emoji: '🔘' }, '두 개가 짧게'),
  W('spinner', 'sp_star', '⭐', '대형 표창', 'saw', 4, { range: 320, dmg: 1.2, ttl: 4, speed: 300, emoji: '⭐' }, '크게 돌며 벤다'),
  W('spinner', 'sp_firewheel', '🎡', '화염륜', 'saw', 5, { range: 300, dmg: 0.72, ttl: 5, speed: 240, ignite: true, emoji: '🎡' }, '지나가며 태운다'),
  W('spinner', 'sp_icering', '💍', '얼음 고리', 'saw', 5, { range: 300, dmg: 0.54, ttl: 5, speed: 240, freeze: 0.6, emoji: '💍' }, '지나가며 얼린다'),
  W('spinner', 'sp_soccer', '⚽', '철퇴구', 'saw', 3, { range: 320, dmg: 1.08, ttl: 4, speed: 340, emoji: '⚽' }, '튕기며 걷어찬다'),
  W('spinner', 'sp_basket', '🏀', '강철 구', 'saw', 3.5, { range: 320, dmg: 1.32, ttl: 3, speed: 300, emoji: '🏀' }, '묵직하게 튕긴다'),
  W('spinner', 'sp_frisbee', '🥏', '칼날 원반', 'saw', 2.5, { range: 300, dmg: 0.72, ttl: 3.5, speed: 380, emoji: '🥏' }, '빠르게 날아다닌다'),
  W('spinner', 'sp_donut', '🍩', '고리 칼날', 'saw', 3, { range: 280, dmg: 0.6, ttl: 4, speed: 260, count: 2, emoji: '🍩' }, '두 개가 굴러다닌다'),
  W('spinner', 'sp_saturn', '🪐', '궤도 고리', 'saw', 8, { range: 320, dmg: 1.5, ttl: 6, speed: 200, emoji: '🪐' }, '크게 오래'),
  W('spinner', 'sp_compass', '🧭', '십자 칼날', 'saw', 4, { range: 300, dmg: 0.9, ttl: 4, speed: 300, emoji: '🧭' }, '날카롭게 돈다'),
  W('spinner', 'sp_wheel', '☸️', '법륜', 'saw', 6, { range: 320, dmg: 1.2, ttl: 5, speed: 260, count: 2, emoji: '☸️' }, '바퀴 둘이 돈다'),
  W('spinner', 'sp_goldcd', '📀', '황금 원반', 'saw', 4.5, { range: 300, dmg: 1.2, ttl: 4, speed: 300, emoji: '📀' }, '번쩍이며 벤다'),

  // ── 장판: 바닥에 깔린다 ──
  W('field', 'f_lava', '🟧', '용암 웅덩이', 'zoneAt', 3, { range: 240, radius: 44, dps: 1.6, ttl: 3, color: '#ff5a2a' }, '몰린 곳에 용암', true),
  W('field', 'f_swamp', '🟩', '독늪', 'zoneAt', 4, { range: 260, radius: 64, dps: 0.8, ttl: 5, color: '#7dff5a' }, '넓고 오래 가는 독'),
  W('field', 'f_ice', '🟦', '빙판', 'frostArea', 4, { range: 280, radius: 64, dmg: 0.4, freeze: 1.6 }, '넓게 얼린다'),
  W('field', 'f_electric', '🟨', '전기장', 'zoneAt', 3, { range: 240, radius: 50, dps: 1.2, ttl: 3, color: '#ffeb3c' }, '지지직'),
  W('field', 'f_tar', '⬛', '타르', 'frostArea', 5, { range: 260, radius: 70, dmg: 0.3, freeze: 2.2 }, '오래 붙잡는다'),
  W('field', 'f_soap', '🧼', '거품 늪', 'bubble', 4, { range: 280, radius: 46, dmg: 2.6, ttl: 2 }, '거품에 가뒀다가 펑'),
  W('field', 'f_quicksand', '🏜️', '모래늪', 'pullAt', 6, { range: 280, radius: 90, ttl: 1.6, dmg: 1.6, boom: 40 }, '빨려 들어갔다가 쾅'),
  W('field', 'f_whirlpool', '💧', '소용돌이', 'pullAt', 7, { range: 300, radius: 110, ttl: 1.8, dmg: 2, boom: 50 }, '넓게 빨아들인다'),
  W('field', 'f_flowers', '🌸', '독 포자밭', 'zoneAt', 3, { range: 240, radius: 56, dps: 0.9, ttl: 4, color: '#ff9ad5' }, '꽃가루로 녹인다'),
  W('field', 'f_firering', '⭕', '불고리', 'zoneAt', 4, { range: 260, radius: 70, dps: 1, ttl: 2.5, color: '#ff8a3c' }, '크게 둘러 태운다'),
  W('field', 'f_acid', '🟪', '산성 웅덩이', 'zoneAt', 3.5, { range: 240, radius: 40, dps: 2, ttl: 2, color: '#b54dff' }, '좁고 독하게'),
  W('field', 'f_snow', '⛄', '눈밭', 'frostArea', 3, { range: 260, radius: 50, dmg: 0.6, freeze: 1 }, '자주 얼린다'),
  W('field', 'f_jelly', '🍮', '점액 감옥', 'bubble', 5, { range: 280, radius: 60, dmg: 3.4, ttl: 2.5 }, '크게 가뒀다가 펑'),
  W('field', 'f_gravity', '🔲', '중력장', 'pullAt', 5, { range: 260, radius: 80, ttl: 1.2, dmg: 1.4, boom: 45 }, '자주 모은다'),
  W('field', 'f_holy', '✨', '성역', 'zoneAt', 6, { range: 280, radius: 80, dps: 1.4, ttl: 4, color: '#fff7a8' }, '크고 밝은 장판', true),

  // ── 광선: 한 줄로 쏜다 ──
  W('ray', 'r_flashlight', '🔦', '집속 조명', 'beam', 0.8, { range: 260, dmg: 2.4, pierce: 2, width: 6, color: '#fff7a8' }, '두 마리를 꿰는 빛'),
  W('ray', 'r_prism', '🔺', '프리즘', 'beam', 1.5, { range: 300, dmg: 1.8, pierce: 3, width: 4, color: '#ff9ad5' }, '세 마리를 꿰는 빛'),
  W('ray', 'r_magnifier', '🔍', '태양 렌즈', 'beam', 1.2, { range: 240, dmg: 1.2, pierce: 1, width: 5, ignite: true, color: '#ffb347' }, '햇빛을 모아 태운다'),
  W('ray', 'r_freeze', '💎', '냉동 광선', 'beam', 1.4, { range: 280, dmg: 1, pierce: 2, width: 5, freeze: 0.8, color: '#9fe8ff' }, '꿰며 얼린다'),
  W('ray', 'r_death', '💀', '죽음의 광선', 'beam', 4, { range: 360, dmg: 10, pierce: 99, width: 8, color: '#7dff5a' }, '한 줄을 통째로'),
  W('ray', 'r_eyes', '👁️', '감시 레이저', 'beam', 0.6, { range: 240, dmg: 1, pierce: 1, width: 3, color: '#ff3c3c' }, '가늘고 자주'),
  W('ray', 'r_ion', '🧬', '이온 광선', 'beam', 1.6, { range: 300, dmg: 1.6, pierce: 2, width: 4, chain: 2, color: '#9fe8ff' }, '맞은 적에서 번개가 튄다'),
  W('ray', 'r_rainbow', '🌈', '분광 광선', 'beam', 2, { range: 320, dmg: 2.5, pierce: 4, width: 7, color: '#ff9ad5' }, '굵게 네 마리를 꿴다'),
  W('air', 'r_sunbeam', '🌞', '태양 기둥', 'column', 6, { range: 320, dmg: 4, width: 24 }, '몰린 줄에 빛기둥'),
  W('ray', 'r_mirror', '🪞', '거울 반사', 'beam', 1, { range: 280, dmg: 1.6, pierce: 2, width: 3, color: '#e8e8f0' }, '날카로운 반사광'),
  W('ray', 'r_signal', '🚦', '표적 레이저', 'beam', 1.1, { range: 260, dmg: 1.5, pierce: 1, width: 5, color: '#3cff6e' }, '표적을 찍어 쏜다'),
  W('air', 'r_moonbeam', '🌙', '달빛 기둥', 'column', 8, { range: 320, dmg: 5, width: 18 }, '몰린 줄에 달빛'),
  W('ray', 'r_hyper', '🔆', '하이퍼 빔', 'beam', 5, { range: 400, dmg: 12, pierce: 99, width: 12, color: '#fff7a8' }, '아주 굵은 한 줄'),
  W('ray', 'r_cutter', '✂️', '플라즈마 커터', 'beam', 0.4, { range: 180, dmg: 0.8, pierce: 2, width: 3, ignite: true, color: '#b54dff' }, '짧게 자르며 태운다'),

  // ── 투척: 자리에서 포물선으로 던진다 ──
  W('throw', 'th_curling', '🥌', '쇳덩이', 'toss', 2, { range: 280, dmg: 4.5, boom: 30, emoji: '🥌' }, '무거운 돌을 던진다'),
  W('throw', 'th_melon', '🍉', '파쇄 수류탄', 'toss', 2.4, { range: 280, dmg: 3, boom: 48, emoji: '🍉' }, '퍽 터진다'),
  W('throw', 'th_pan', '🍳', '철판 투척', 'toss', 1.6, { range: 260, dmg: 5.25, boom: 22, emoji: '🍳' }, '땡! 세게'),
  W('throw', 'th_axe', '🪓', '도끼', 'toss', 1.8, { range: 280, dmg: 6, boom: 18, emoji: '🪓' }, '좁게 아주 세게'),
  W('throw', 'th_molotov', '🍾', '화염병', 'toss', 2.6, { range: 280, dmg: 2.4, boom: 44, ignite: true, emoji: '🍾' }, '깨지며 불이 붙는다'),
  W('throw', 'th_snowball', '☃️', '얼음 덩이', 'toss', 1.5, { range: 260, dmg: 1.5, boom: 34, freeze: 1, emoji: '☃️' }, '맞으면 언다'),
  W('throw', 'th_pot', '🪴', '벽돌', 'toss', 2, { range: 260, dmg: 3.75, boom: 30, emoji: '🪴' }, '위에서 화분이'),
  W('throw', 'th_tomato', '🍅', '산성 병', 'toss', 0.8, { range: 240, dmg: 1.5, boom: 20, emoji: '🍅' }, '자주 던진다'),
  W('throw', 'th_garlic', '🧄', '최루탄', 'toss', 2.2, { range: 260, dmg: 2.1, boom: 40, ignite: true, emoji: '🧄' }, '맵게 태운다'),
  W('throw', 'th_volley', '🏐', '쌍 수류탄', 'toss', 1.4, { range: 300, dmg: 3.6, boom: 24, count: 2, emoji: '🏐' }, '두 개씩 내리꽂는다', true),
  W('throw', 'th_pinata', '🪅', '집속 수류탄', 'toss', 3, { range: 280, dmg: 3, boom: 50, count: 2, emoji: '🪅' }, '터지며 파편이 쏟아진다', true),
  W('throw', 'th_barrel', '🛢️', '기름통', 'toss', 3.5, { range: 280, dmg: 4.5, boom: 64, ignite: true, emoji: '🛢️' }, '크게 터져 불바다'),
  W('throw', 'th_cake', '🎂', '냉각탄', 'toss', 2.5, { range: 260, dmg: 2.4, boom: 56, freeze: 0.8, emoji: '🎂' }, '맞으면 얼어붙는다'),
  W('throw', 'th_moai', '🗿', '석상 투척', 'toss', 6, { range: 320, dmg: 10.5, boom: 70, speed: 320, emoji: '🗿' }, '아주 무겁게'),
  W('throw', 'th_spoons', '🥄', '투척 단검', 'toss', 0.6, { range: 240, dmg: 1.35, boom: 14, count: 2, emoji: '🥄' }, '두 개씩 자주'),

  // ── 떼: 작은 것이 떼로 몰려가 쫓는다 ──
  W('swarm', 'sw_mosquito', '🦟', '모기 떼', 'swarm', 3.5, { ttl: 4, range: 280, dmg: 0.5, count: 3, spread: 1.2, homing: 5, speed: 260, tracer: 'emoji', emoji: '🦟', size: 9 }, '셋씩 날아가 쫓아 문다', true),
  W('swarm', 'sw_flies', '🪰', '쇠파리 떼', 'swarm', 3.5, { ttl: 4, range: 260, dmg: 0.4, count: 4, spread: 1.4, homing: 4, speed: 240, tracer: 'emoji', emoji: '🪰', size: 8 }, '넷씩 몰려간다'),
  W('swarm', 'sw_butterfly', '🦋', '독나방 떼', 'swarm', 3.5, { ttl: 4, range: 300, dmg: 0.6, count: 3, spread: 1, homing: 3, speed: 200, freeze: 0.3, tracer: 'emoji', emoji: '🦋', size: 10 }, '홀려서 멈칫'),
  W('swarm', 'sw_sparrows', '🐦', '까마귀 떼', 'swarm', 3.5, { ttl: 4, range: 300, dmg: 0.8, count: 3, spread: 0.9, homing: 4, speed: 320, tracer: 'emoji', emoji: '🐦', size: 10 }, '셋씩 빠르게 쫓는다', true),
  W('swarm', 'sw_piranha', '🐟', '피라냐 떼', 'swarm', 3.5, { ttl: 4, range: 260, dmg: 0.7, count: 3, spread: 1, homing: 5, speed: 280, tracer: 'emoji', emoji: '🐟', size: 10 }, '물어뜯으러 몰려간다'),
  W('swarm', 'sw_ants', '🐜', '개미 떼', 'swarm', 3.5, { ttl: 4, count: 8, speed: 120, melee: 2, dmg: 0.6, emoji: '🐜', size: 12 }, '여덟 마리가 기어가 문다'),
  W('swarm', 'sw_spiders', '🕷️', '거미 떼', 'swarm', 3.5, { ttl: 4, count: 5, speed: 150, melee: 3, dmg: 0.5, freeze: 0.4, emoji: '🕷️', size: 14 }, '거미줄로 묶는다'),
  W('swarm', 'sw_ladybug', '🐞', '폭탄 딱정벌레', 'swarm', 3.5, { ttl: 4, range: 280, dmg: 1, count: 2, spread: 0.8, homing: 4, speed: 260, boom: 16, tracer: 'emoji', emoji: '🐞', size: 10 }, '쫓아가 톡 터진다'),
  W('swarm', 'sw_beetles', '🪲', '불딱정벌레', 'swarm', 3.5, { ttl: 4, range: 280, dmg: 0.5, count: 3, spread: 1.2, homing: 4, speed: 240, ignite: true, tracer: 'emoji', emoji: '🪲', size: 9 }, '물면 불이 붙는다'),
  W('swarm', 'sw_doves', '🕊️', '칼새 떼', 'swarm', 3.5, { ttl: 4, range: 320, dmg: 1, count: 4, spread: 1, homing: 3, speed: 300, tracer: 'emoji', emoji: '🕊️', size: 11 }, '넷씩 날아간다'),
  W('swarm', 'sw_snakes', '🐍', '뱀 떼', 'swarm', 3.5, { ttl: 4, count: 4, speed: 140, melee: 3, dmg: 1, ignite: true, emoji: '🐍', size: 14 }, '물면 독이 퍼진다'),
  W('swarm', 'sw_bats', '🦇', '박쥐 떼', 'swarm', 3.5, { ttl: 4, range: 280, dmg: 0.6, count: 4, spread: 1.3, homing: 5, speed: 300, tracer: 'emoji', emoji: '🦇', size: 10 }, '넷씩 휘감는다'),
  W('swarm', 'sw_locusts', '🦗', '메뚜기 떼', 'swarm', 3.5, { ttl: 4, count: 10, speed: 200, melee: 1, dmg: 0.5, emoji: '🦗', size: 11 }, '열 마리가 뒤덮는다'),
  W('swarm', 'sw_jelly', '🪼', '해파리 떼', 'swarm', 3.5, { ttl: 4, range: 260, dmg: 0.8, count: 3, spread: 1, homing: 2, speed: 160, chain: 2, tracer: 'emoji', emoji: '🪼', size: 11 }, '닿으면 찌릿, 옆으로 옮겨 간다'),

  // ── 정령: 떠다니며 쏜다 ──
  W('spirit', 'sl_fairy', '🧚', '빛 정령', 'drone', 0.6, { range: 240, dmg: 0.8, speed: 700, tracer: 'ball', color: '#ff9ad5', size: 3, emoji: '🧚' }, '떠다니며 빛을 쏜다', true),
  W('spirit', 'sl_ghost', '👻', '유령', 'drone', 0.8, { range: 240, dmg: 1, pierce: 2, speed: 600, tracer: 'ball', color: '#e8e8f0', size: 3, emoji: '👻' }, '꿰뚫는 혼을 쏜다', true),
  W('spirit', 'sl_pumpkin', '🎃', '화염 정령', 'drone', 1, { range: 240, dmg: 1, ignite: true, speed: 600, tracer: 'ball', color: '#ff8a3c', size: 4, emoji: '🎃' }, '불씨를 쏜다'),
  W('spirit', 'sl_frost', '💙', '얼음 정령', 'drone', 0.9, { range: 240, dmg: 0.7, freeze: 0.5, speed: 650, tracer: 'ball', color: '#9fe8ff', size: 3, emoji: '💙' }, '얼음 조각을 쏜다'),
  W('spirit', 'sl_spark', '💛', '번개 정령', 'drone', 1.1, { range: 240, dmg: 0.9, chain: 2, speed: 800, tracer: 'ball', color: '#ffeb3c', size: 3, emoji: '💛' }, '번개가 옮겨 간다'),
  W('spirit', 'sl_angel', '👼', '천사', 'drone', 1.2, { range: 280, dmg: 1.6, pierce: 1, speed: 900, tracer: 'arrow', color: '#fff7a8', emoji: '👼' }, '빛 화살'),
  W('spirit', 'sl_imp', '😈', '소악마', 'drone', 0.9, { range: 240, dmg: 1.2, ignite: true, speed: 700, tracer: 'ball', color: '#ff3c3c', size: 3, emoji: '😈' }, '지옥불을 쏜다'),
  W('spirit', 'sl_alien', '👽', '탐사 드론', 'drone', 0.5, { range: 240, dmg: 0.6, speed: 800, tracer: 'line', color: '#7dff5a', emoji: '👽' }, '레이저를 자주'),
  W('spirit', 'sl_eye', '🧿', '감시의 눈', 'drone', 1.5, { range: 300, dmg: 2.5, pierce: 3, speed: 1200, target: 'strong', tracer: 'line', color: '#3ce0ff', emoji: '🧿' }, '단단한 적을 꿰뚫는다'),
  W('spirit', 'sl_queen', '👑', '군주 정령', 'drone', 0.7, { range: 240, dmg: 0.7, homing: 4, speed: 400, tracer: 'ball', color: '#ffd36b', size: 3, emoji: '👑' }, '쫓아가는 빛'),
  W('spirit', 'sl_crystal', '🔮', '수정 정령', 'drone', 1.4, { range: 260, dmg: 1.4, boom: 24, speed: 500, tracer: 'ball', color: '#c77dff', size: 4, emoji: '🔮' }, '작게 터지는 구슬'),
  W('spirit', 'sl_genie', '🧞', '마인', 'drone', 1.6, { range: 280, dmg: 2, boom: 30, speed: 600, tracer: 'ball', color: '#3ce0ff', size: 5, emoji: '🧞' }, '크게 터지는 구슬'),

  // ── 강화 ───────────────────────────────────────────────────
  W('passive', 'power', '💪', '화력', 'passive', 0, {}, '모든 피해 +12%'),
  W('passive', 'haste', '⏱️', '속사', 'passive', 0, {}, '모든 쿨다운 -8%'),
  W('passive', 'multi', '➕', '다중', 'passive', 0, {}, '탄·소환·낙하물 수 +1 (1·3·5레벨)'),
  W('passive', 'gate', '✖️', '곱하기 게이트', 'passive', 0, {}, '게이트를 지난 포탄·탄·병사·양이 ×2 (레벨마다 ×3, ×4 …)'),
  W('passive', 'luck', '🍀', '행운', 'passive', 0, {}, '황금 쿠키가 자주, 피버가 쉽게'),
  W('passive', 'xp', '🧲', '경험치 자석', 'passive', 0, {}, '경험치 +20%'),
  W('passive', 'range', '🔭', '사거리', 'passive', 0, {}, '자동 무기 사거리 +12%'),
  W('passive', 'pierce', '🗡️', '관통', 'passive', 0, {}, '총알이 한 마리 더 뚫는다'),
  W('passive', 'velocity', '💨', '탄속', 'passive', 0, {}, '탄이 15% 빠르게'),
  W('passive', 'area', '🌀', '범위', 'passive', 0, {}, '무기 폭발 반경 +10%'),
  W('passive', 'crit', '🎲', '치명타', 'passive', 0, {}, '무기 피해 6% 확률로 ×2.5'),
  W('passive', 'retrigger', '🔁', '다시 터짐', 'passive', 0, {}, '무기 폭발이 6% 확률로 한 번 더'),
  W('passive', 'explosive', '🧪', '약점 공략', 'passive', 0, {}, '불타거나 언 적에게 무기 피해 +12%'),
  W('passive', 'duration', '⌛', '지속', 'passive', 0, {}, '지대·소환 지속 +15%'),
  W('passive', 'gunsmith', '🔧', '총기 개조', 'passive', 0, {}, '총 쿨다운 -8%'),
  W('passive', 'summoner', '📯', '소환술', 'passive', 0, {}, '소환수 피해 +20%'),
  W('passive', 'archmage', '📜', '대마법사', 'passive', 0, {}, '마법 쿨다운 -8%'),
];

/** 융합에 필요한 두 무기의 레벨 (3 은 무기가 100종이 넘어 봇 10판에서 한 번도 안 나왔다) */
export const FUSE_LEVEL = 2;

const L_MEGA: GunLook = { len: 20, bw: 9, body: 14, bh: 11, color: '#3a3f55', barrels: 6 };
const L_MEGAPOD: GunLook = { len: 14, bw: 14, body: 12, bh: 14, color: '#5a3c3c', tube: true, glow: '#ff7a3c' };
const L_FROST: GunLook = { len: 18, bw: 5, body: 14, bh: 8, color: '#c8e8ff', glow: '#9fe8ff' };
const F = (from: [string, string], cat: ArmCategory, id: string, emoji: string, name: string, kind: WeaponKind, cd: number, p: WeaponParams, desc: string): WeaponSpec => ({
  id: `fus_${id}`, cat, emoji, name, kind, cd, p, desc, fusion: [`arm_${from[0]}`, `arm_${from[1]}`],
  up: [S('피해 +30%', { dmg: 0.3 }), S('쿨다운 -15%', { cd: 0.85 }), S('피해 +40%', { dmg: 0.4 }), S('쿨다운 -20%', { cd: 0.8 })],
});
function S(label: string, d: UpStep['d']): UpStep {
  return { label, d };
}

/**
 * 융합 무기 (플레이 피드백: "무기 융합 같은 거 없을까, 그냥 많이 날아다니기만 하는데 그런 게 있으면 좋겠다").
 * 정해진 두 무기를 둘 다 FUSE_LEVEL 이상 키우면 레벨 업에 융합 카드가 꼭 한 장 나온다.
 * 고르면 두 무기는 그대로 두고 융합 무기가 하나 더 생긴다 (플레이 피드백: 무기 개수가 왕창 늘어나는 게 이 게임의 정체성).
 */
export const FUSIONS: readonly WeaponSpec[] = [
  F(['cannon', 'mortar'], 'turret', 'barrage', '🎇', '무한 포격', 'lob', 0.9, { range: 400, dmg: 3, boom: 62, count: 2 }, '포탄을 쉬지 않고 두 발씩 퍼붓는다'),
  F(['railgun', 'tesla'], 'ray', 'railtesla', '⚡', '레일 테슬라', 'beam', 1.4, { range: 480, dmg: 7, pierce: 99, width: 7, chain: 4, look: L_RAIL, color: '#9fe8ff' }, '한 줄을 꿰뚫고, 맞은 적마다 번개가 네 번 옮겨 간다'),
  F(['rocket', 'mlrs'], 'gun', 'nukepod', '☢️', '핵미사일 포대', 'gun', 3, { range: 400, dmg: 3, boom: 72, burst: 8, homing: 4, speed: 320, look: L_MEGAPOD, tracer: 'rocket', color: '#ff3c6e' }, '큰 유도 미사일 여덟 발'),
  F(['flamer', 'tornado'], 'charge', 'firenado', '🔥', '화염 토네이도', 'event', 9, { event: 'tornado', ignite: true }, '빨아들인 적을 전부 불태우는 토네이도'),
  F(['cat', 'wizard'], 'throw', 'archcat', '😼', '대화염 술사', 'toss', 0.9, { dmg: 2.5, boom: 44, count: 2, ignite: true, chain: 3, emoji: '☄️' }, '불덩이 두 개, 떨어진 자리에서 번개가 세 번 옮겨 간다'),
  F(['meteor', 'whale'], 'air', 'whalerain', '🐳', '중력 폭우', 'rain', 11, { count: 7, dmg: 5, radius: 80, emoji: '🐋', size: 46 }, '중력 폭탄이 비처럼 쏟아진다'),
  F(['soldier', 'robot'], 'summon', 'mecha', '🦾', '메카 군단', 'walker', 4, { count: 3, speed: 110, melee: 6, dmg: 3, boom: 75, emoji: '🤖', size: 26 }, '로봇 셋이 줄지어 나가 여섯 번 때리고 자폭'),
  F(['banana', 'monkey'], 'throw', 'bananarepublic', '🍌', '연쇄 분열탄', 'event', 4, { event: 'banana', count: 4 }, '갈라지는 분열탄을 쉬지 않고'),
  F(['freezegun', 'frost'], 'gun', 'absolutezero', '🥶', '절대영도', 'gun', 0.18, { range: 300, dmg: 1, boom: 24, freeze: 1.5, speed: 800, look: L_FROST, tracer: 'ball', color: '#e8fbff', size: 4 }, '맞은 자리 주변을 얼려 버린다 (언 적은 모든 피해 2.5배)'),
  F(['sniper', 'amr'], 'gun', 'railsniper', '🎯', '철갑 저격', 'gun', 1.1, { range: 500, dmg: 14, pierce: 99, speed: 2600, target: 'strong', look: L_AMR, tracer: 'line', color: '#ffffff' }, '줄에 선 적을 전부 꿰뚫는 한 방을 자주'),
  F(['bolttower', 'storm'], 'air', 'thundergod', '🌩️', '뇌신', 'storm', 7, { ttl: 6, dmg: 2.6 }, '6초 동안 벼락이 쉴 새 없이'),
  F(['bowling', 'train'], 'charge', 'strike', '🎳', '철구 열차', 'sweep', 9, { dmg: 8, width: 60, dir: 'up', emoji: '🎳', knock: 180 }, '화면 전체를 쓸어 올리는 스트라이크'),
  F(['jackpot', 'luck'], 'magic', 'lucky777', '🤑', '운명의 777', 'event', 12, { event: 'jackpot', count: 6 }, '777 확률이 크게 오른 잭팟'),
  F(['dragon', 'knight'], 'charge', 'dragonknight', '🐉', '드래곤 기사단', 'stamp', 7, { count: 5, speed: 240, dmg: 3, dir: 'up', ignite: true, emoji: '🐉', size: 22 }, '용 다섯이 위로 돌격하며 불을 붙인다'),
  F(['minigun', 'gatling'], 'gun', 'fortress', '🏯', '미니건 요새', 'gun', 0.04, { range: 280, dmg: 0.45, count: 2, spread: 0.12, speed: 950, look: L_MEGA, tracer: 'line', color: '#ffe08a' }, '여섯 총열이 쉬지 않고 두 줄로'),
];

export const ARMS: Record<string, WeaponSpec> = Object.fromEntries([...WEAPONS, ...FUSIONS].map((w) => [w.id, w]));

export function armInfo(id: string): WeaponSpec | undefined {
  return ARMS[id];
}

/** 이 무기와 짝을 이루는 융합 (재료 → 융합 무기들) */
export function fusionsOf(id: string): WeaponSpec[] {
  return FUSIONS.filter((f) => f.fusion!.includes(id));
}

const fusionCard = (w: WeaponSpec): AugmentDef => {
  const [a, b] = w.fusion!.map((id) => ARMS[id]);
  return {
    id: w.id,
    name: w.name,
    desc: `${a.name} + ${b.name} → ${w.desc}${hasRange(w.cat) ? ` · 사거리 ${w.p.range ?? DEFAULT_RANGE}` : ''}`,
    levelDesc: (next: number) => `레벨 업: ${w.up[next - 2]?.label ?? ''}`,
    rarity: 'prism',
    archetypes: [],
    maxStacks: MAX_LEVEL,
    tag: `융합 · ${CATEGORY_LABEL[w.cat]}`,
  };
};

/** 카드 설명 끝에 붙는 융합 재료 표시 ("🔗 + 🏯 박격포 → 🎇 무한 포격") */
function fusionHint(id: string): string {
  const fs = FUSIONS.filter((f) => f.fusion!.includes(id));
  if (fs.length === 0) return '';
  return ' · ' + fs.map((f) => {
    const other = ARMS[f.fusion!.find((x) => x !== id)!];
    return `+ ${other.name} → 융합 ${f.name}`;
  }).join(', ');
}

export const ARSENAL: readonly AugmentDef[] = WEAPONS.map((w): AugmentDef => ({
  id: w.id,
  name: w.name,
  desc: (hasRange(w.cat) ? `${w.desc} · 사거리 ${w.p.range ?? DEFAULT_RANGE}` : w.desc) + fusionHint(w.id),
  levelDesc: w.up.length ? (next: number) => `레벨 업: ${w.up[next - 2]?.label ?? ''}` : undefined,
  rarity: 'normal' as const,
  archetypes: [],
  maxStacks: MAX_LEVEL,
  tag: CATEGORY_LABEL[w.cat],
  modifyStats:
    w.id === 'arm_bomb'
      ? (s, n) => {
          s.tapRadius *= 1 + 0.1 * (n - 1);
          s.chainDepthBonus += (n >= 3 ? 1 : 0) + (n >= 5 ? 1 : 0);
        }
      : w.id === 'arm_power'
        ? (s, n) => { s.tapDamage *= 1 + 0.12 * n; }
        : undefined,
})).concat(FUSIONS.map(fusionCard));

/** 예전 이름 호환 */
export const CHAOS_AUGMENTS = ARSENAL;
