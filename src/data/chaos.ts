import type { AugmentDef } from './augments';
import { UP, type UpKey, type UpStep } from './chaosUp';

/**
 * 도파민 모드: 카테고리 무기고 (docs/design/dopamine-catalog.md).
 *
 * 플레이 피드백 순서:
 *   1. 카테고리를 나누고 하나 골라 시작해서 하나씩 늘려 가기 (뱀파이어 서바이버식)
 *   2. 무기 종류를 확 늘리기, 총은 총처럼 보이게, 무기 개수 제한 없애기
 *   3. 무기마다 사거리를 따로 (보통 화면 절반 안팎). 다 맨 끝까지 치니 적이 나오는 게 안 보였다
 *
 * 무기 하나 = 증강 하나 (중첩 = 레벨, 최대 5). 무기는 "행동 틀(kind) + 수치(p)" 로 정의하고,
 * 틀별 동작은 sim/chaos.ts, 그리기는 render/chaosDraw.ts.
 */

export type ArmCategory = 'hand' | 'gun' | 'turret' | 'summon' | 'magic' | 'passive';

export const CATEGORY_LABEL: Record<ArmCategory, string> = {
  hand: '손공격',
  gun: '총',
  turret: '포탑',
  summon: '소환수',
  magic: '마법',
  passive: '강화',
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
  | 'storm' | 'freezeAll' | 'quake' | 'nuke'
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
  ({ id: `arm_${id}`, cat, emoji, name, kind, cd, p, desc, starter, up: UP[id] ?? [] });

/** 사거리가 있는 갈래 (플레이 피드백: 총·대포 같은 것만 제한, 소환수·폭격·잭팟은 화면 어디든) */
export function hasRange(cat: ArmCategory): boolean {
  return cat === 'gun' || cat === 'turret';
}

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
  W('hand', 'zap', '⚡', '번개 손', 'tapZap', 0.6, { count: 3, dmg: 2, radius: 110 }, '탭 근처 3마리에 번개 + 폭약', true),
  W('hand', 'mine', '💣', '지뢰 손', 'tapMine', 1, { dmg: 3, radius: 48, count: 4 }, '탭한 자리에 지뢰, 밟으면 쾅', true),
  W('hand', 'slash', '🔪', '베기 손', 'tapSlash', 1.2, { dmg: 2.5, width: 12 }, '탭한 높이를 화면 가로로 벤다'),
  W('hand', 'flame', '🔥', '화염 손', 'tapZone', 0.8, { radius: 36, dps: 1.2, ttl: 2 }, '탭한 자리에 불바다'),
  W('hand', 'snipe', '🎯', '저격 손', 'tapSnipe', 1.5, { dmg: 8, radius: 90 }, '탭 근처에서 체력이 가장 많은 적 한 방'),
  W('hand', 'frostHand', '❄️', '얼음 손', 'tapBoom', 1.4, { radius: 60, dmg: 0.8, freeze: 2.5 }, '탭한 자리를 얼린다 (언 적은 피해 2.5배)'),
  W('hand', 'shock', '👊', '충격파 손', 'tapBoom', 1, { radius: 70, dmg: 1, knock: 320 }, '탭한 자리에서 적을 날려 보낸다'),
  W('hand', 'poison', '☠️', '독 손', 'tapZone', 1.5, { radius: 50, dps: 0.8, ttl: 4, color: '#7dff5a' }, '탭한 자리에 독구름'),
  W('hand', 'punch', '🥊', '펀치', 'tapBoom', 0.7, { radius: 26, dmg: 6 }, '좁고 아주 세게 한 대'),
  W('hand', 'grenade', '🧨', '수류탄 손', 'tapThrow', 1, { boom: 55, dmg: 3, emoji: '🧨' }, '아래에서 수류탄을 던져 탭한 자리에 쾅'),
  W('hand', 'strike', '🌩️', '낙뢰 손', 'tapStrike', 1.4, { width: 18, dmg: 2.2 }, '탭한 세로줄에 벼락'),
  W('hand', 'missile', '🚀', '미사일 손', 'tapMissiles', 1.6, { count: 3, dmg: 2, boom: 34, homing: 5, speed: 380 }, '탭한 쪽으로 유도 미사일 세 발'),
  W('hand', 'hole', '🕳️', '블랙홀 손', 'tapPull', 4, { radius: 80, ttl: 1.2, dmg: 2.2, boom: 60 }, '탭한 자리로 빨아들였다가 쾅'),
  W('hand', 'coins', '🪙', '동전 비', 'tapRain', 2, { count: 8, radius: 24, dmg: 1.5, emoji: '🪙' }, '탭한 자리 주변에 동전이 쏟아진다'),

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
  W('gun', 'laser', '🔴', '레이저 소총', 'beam', 0.8, { range: 320, dmg: 2, pierce: 2, width: 3, look: L_LASER, color: '#ff3cc8' }, '빛줄기, 두 마리 뚫음'),
  W('gun', 'railgun', '🔷', '레일건', 'beam', 2.6, { range: 480, dmg: 9, pierce: 99, width: 6, look: L_RAIL, color: '#3ce0ff' }, '한 줄을 통째로 꿰뚫는 빛'),
  W('gun', 'plasma', '🟣', '플라즈마건', 'gun', 0.7, { range: 260, dmg: 1.4, boom: 26, speed: 480, look: L_PLASMA, tracer: 'ball', color: '#b54dff', size: 4 }, '작게 터지는 에너지탄'),
  W('gun', 'crossbow', '🏹', '석궁', 'gun', 1.1, { range: 320, dmg: 3, pierce: 3, speed: 950, look: L_CROSSBOW, tracer: 'arrow', color: '#e8d8b0' }, '세 마리 꿰뚫는 화살'),
  W('gun', 'nailgun', '📌', '네일건', 'gun', 0.15, { range: 220, dmg: 0.45, pierce: 1, speed: 850, look: L_SMG, tracer: 'line', color: '#c8d0e8' }, '못을 빠르게 박는다'),
  W('gun', 'musket', '🎩', '머스킷', 'gun', 2.4, { range: 300, dmg: 6, speed: 900, look: L_RIFLE, tracer: 'line', color: '#ffffff' }, '한 발, 아주 세게, 연기 펑'),
  W('gun', 'water', '💦', '물대포', 'gun', 0.08, { range: 200, dmg: 0.12, knock: 260, speed: 520, look: L_WATER, tracer: 'ball', color: '#4dd2ff', size: 3 }, '피해는 쥐꼬리, 대신 적을 밀어낸다'),
  W('gun', 'freezegun', '🧊', '냉동총', 'gun', 0.35, { range: 240, dmg: 0.5, freeze: 0.8, speed: 700, look: L_LASER, tracer: 'ball', color: '#9fe8ff', size: 3 }, '맞은 적이 잠깐 언다'),
  W('gun', 'dart', '🦂', '독침총', 'gun', 0.5, { range: 260, dmg: 0.6, ignite: true, speed: 800, look: L_PISTOL, tracer: 'arrow', color: '#7dff5a' }, '맞은 적에 독(불)이 붙고 옆으로 번진다'),
  W('gun', 'teslagun', '🔌', '번개총', 'gun', 0.8, { range: 260, dmg: 1.2, chain: 3, speed: 900, look: L_PLASMA, tracer: 'ball', color: '#9fe8ff', size: 3 }, '맞힌 뒤 번개가 세 마리로 옮겨 간다'),
  W('gun', 'bouncer', '🏓', '튕기는 총', 'gun', 0.5, { range: 900, dmg: 1, bounce: 3, speed: 600, look: L_PISTOL, tracer: 'ball', color: '#ffd36b', size: 3 }, '탄이 벽에 세 번 튕긴다'),
  W('gun', 'popcorn', '🍿', '팝콘 기관총', 'gun', 0.4, { range: 240, dmg: 0.8, popcorn: true, speed: 700, look: L_SMG, tracer: 'emoji', emoji: '🍿', size: 12 }, '맞으면 팝콘이 네 개로 튄다'),
  W('gun', 'orbgun', '🌑', '블랙홀 건', 'gun', 3, { range: 260, dmg: 3, boom: 70, pullOrb: true, speed: 140, look: L_PLASMA, tracer: 'ball', color: '#5a3c8a', size: 8 }, '느린 구슬이 적을 빨아들이다 터진다'),
  W('gun', 'missilepod', '🛩️', '미사일 포대', 'gun', 2.6, { range: 360, dmg: 1.5, boom: 34, burst: 4, homing: 4, speed: 280, look: L_POD, tracer: 'rocket', color: '#ffb347' }, '유도 미사일 네 발'),

  // ── 포탑: 아래 칸에 서서 ───────────────────────────────────
  W('turret', 'cannon', '🏰', '대포', 'lob', 3, { range: 320, dmg: 2.5, boom: 46 }, '몰린 곳에 포탄', true),
  W('turret', 'mortar', '🏯', '박격포', 'lob', 4.5, { range: 380, dmg: 4, boom: 70, speed: 300 }, '멀리 높이, 크게 터진다'),
  W('turret', 'tesla', '🗼', '테슬라 코일', 'zap', 2.2, { range: 260, count: 3, dmg: 1.6, spark: true }, '세 마리를 지지고 폭약을 붙인다', true),
  W('turret', 'satellite', '🛰️', '위성 레이저', 'column', 7, { range: 320, dmg: 4, width: 20 }, '몰린 줄에 레이저 기둥'),
  W('turret', 'frost', '❄️', '냉각탑', 'frostArea', 5, { range: 280, radius: 55, dmg: 0.5, freeze: 2 }, '몰린 곳을 2초 얼린다'),
  W('turret', 'flametower', '♨️', '화염탑', 'zoneAt', 3, { range: 220, radius: 40, dps: 1.2, ttl: 3 }, '몰린 곳에 불바다'),
  W('turret', 'gas', '☁️', '독가스탑', 'zoneAt', 4, { range: 260, radius: 60, dps: 0.7, ttl: 5, color: '#7dff5a' }, '넓게 오래 가는 독구름'),
  W('turret', 'saw', '🪚', '회전톱', 'saw', 5, { range: 300, dmg: 1.5, ttl: 5, speed: 260 }, '톱날이 화면을 튕겨 다니며 썬다'),
  W('turret', 'magnet', '🧲', '자석탑', 'pullAt', 6, { range: 280, radius: 100, ttl: 1.2, dmg: 2, boom: 60 }, '적을 한데 모았다가 쾅'),
  W('turret', 'bolttower', '🌩️', '낙뢰탑', 'strikes', 1.8, { range: 300, count: 2, dmg: 2, width: 14 }, '사거리 안에 벼락 두 줄기'),
  W('turret', 'bubble', '🫧', '버블탑', 'bubble', 4, { range: 280, radius: 50, dmg: 3, ttl: 2 }, '거품에 가둬 띄웠다가 펑'),
  W('turret', 'bell', '🔔', '종탑', 'pulse', 4, { range: 160, dmg: 0.8, freeze: 0.4 }, '울릴 때마다 주변 적을 때리고 멈칫'),

  // ── 소환수 ─────────────────────────────────────────────────
  W('summon', 'soldier', '💂', '자폭 병사', 'walker', 3, { count: 1, speed: 90, boom: 46, dmg: 2.5, emoji: '💂' }, '걸어 나가 적에게 안겨 터진다', true),
  W('summon', 'sheep', '🐑', '양 떼', 'walker', 4, { count: 1, speed: 150, boom: 58, dmg: 3, emoji: '🐑' }, '뛰쳐나가 박치기하고 터진다', true),
  W('summon', 'chicken', '🐔', '닭', 'walker', 2.5, { count: 3, speed: 170, boom: 28, dmg: 1.2, emoji: '🐔' }, '닭 세 마리가 우르르, 작게 터진다'),
  W('summon', 'granny', '👵', '폭탄 할머니', 'walker', 7, { count: 1, speed: 45, boom: 95, dmg: 6, emoji: '👵' }, '느릿느릿, 크게 터진다'),
  W('summon', 'rats', '🐀', '쥐 떼', 'walker', 4, { count: 6, speed: 180, boom: 18, dmg: 1.2, emoji: '🐀' }, '쥐 여섯 마리가 흩어져 문다'),
  W('summon', 'bees', '🐝', '벌 떼', 'walker', 3, { count: 5, speed: 200, melee: 1, dmg: 1, spark: true, emoji: '🐝' }, '쏘고 폭약을 붙인다'),
  W('summon', 'dog', '🐕', '강아지', 'walker', 5, { count: 1, speed: 160, melee: 6, dmg: 1.8, emoji: '🐕' }, '여섯 번 물고 돌아간다'),
  W('summon', 'bear', '🐻', '곰', 'walker', 8, { count: 1, speed: 80, melee: 10, dmg: 3, size: 30, emoji: '🐻' }, '열 번 후려친다'),
  W('summon', 'robot', '🤖', '로봇', 'walker', 7, { count: 1, speed: 70, melee: 8, dmg: 2.5, boom: 60, emoji: '🤖' }, '여덟 번 때리고 자폭'),
  W('summon', 'knight', '🏇', '기사단', 'stamp', 9, { count: 4, speed: 220, dmg: 2, dir: 'up', emoji: '🏇' }, '기사 넷이 위로 돌격'),
  W('summon', 'dino', '🦖', '공룡', 'stamp', 12, { count: 2, speed: 230, dmg: 3, dir: 'side', emoji: '🦖' }, '화면을 가로지르며 짓밟는다'),
  W('summon', 'cows', '🐄', '소 떼', 'stamp', 10, { count: 3, speed: 240, dmg: 2.5, dir: 'up', emoji: '🐄' }, '방어선에서 위로 들이받는다'),
  W('summon', 'rhino', '🦏', '코뿔소', 'stamp', 9, { count: 1, speed: 300, dmg: 5, dir: 'side', size: 26, emoji: '🦏' }, '한 마리, 아주 세게 들이받는다'),
  W('summon', 'elephant', '🐘', '코끼리 떼', 'stamp', 14, { count: 3, speed: 140, dmg: 3, dir: 'up', size: 28, emoji: '🐘' }, '느리지만 다 깔아뭉갠다'),
  W('summon', 'penguin', '🐧', '펭귄 썰매', 'stamp', 6, { count: 4, speed: 320, dmg: 1, dir: 'up', freeze: 0.8, emoji: '🐧' }, '배로 미끄러지며 얼린다'),
  W('summon', 'cat', '🐱', '고양이 마법사', 'lob', 1.6, { range: 300, dmg: 1.5, boom: 34, ignite: true, emoji: '🔥' }, '불덩이를 던진다', true),
  W('summon', 'monkey', '🐒', '원숭이', 'lob', 2, { range: 280, dmg: 2, boom: 40, emoji: '🍌' }, '바나나를 던진다'),
  W('summon', 'octopus', '🐙', '문어', 'lob', 2.5, { range: 260, dmg: 0.8, boom: 50, freeze: 1.5, emoji: '💧' }, '먹물로 적을 굳힌다'),
  W('summon', 'wizard', '🧙', '마법사 할아버지', 'zap', 2, { range: 300, count: 2, dmg: 2 }, '지팡이 번개 두 줄기'),
  W('summon', 'archer', '🏹', '궁수', 'gun', 0.9, { range: 320, dmg: 1.6, pierce: 1, speed: 900, tracer: 'arrow', color: '#e8d8b0', slot: true }, '화살, 한 마리 뚫음'),
  W('summon', 'ninja', '🥷', '닌자', 'gun', 0.6, { range: 260, dmg: 1, count: 3, spread: 0.3, pierce: 2, speed: 700, tracer: 'emoji', emoji: '✴️', size: 10, slot: true }, '표창 세 개를 부채꼴로'),
  W('summon', 'drone', '🚁', '드론 편대', 'drone', 0.5, { range: 220, dmg: 0.9, speed: 800, tracer: 'line', color: '#9fe8ff' }, '드론이 떠서 돌며 쏜다'),
  W('summon', 'dragonling', '🐲', '새끼 용', 'event', 10, { event: 'dragon', range: 300 }, '날아가며 불을 뿜는다'),
  W('summon', 'eagle', '🦅', '독수리', 'drop', 6, { range: 320, dmg: 5, radius: 40, target: 'strong', emoji: '🦅' }, '가장 단단한 적에게 내리꽂는다'),

  // ── 마법: 쿨다운마다 저절로 ────────────────────────────────
  W('magic', 'meteor', '☄️', '운석우', 'event', 12, { event: 'meteor', range: 320 }, '운석이 쏟아진다', true),
  W('magic', 'airstrike', '✈️', '공습', 'event', 14, { event: 'airstrike', range: 320 }, '몰린 줄에 폭탄을 줄줄이'),
  W('magic', 'banana', '🍌', '바나나 폭탄', 'event', 10, { event: 'banana', range: 300 }, '터지고 갈라져 또 터진다'),
  W('magic', 'tornado', '🌪️', '토네이도', 'event', 16, { event: 'tornado', range: 300 }, '빨아들여 돌리다 폭발'),
  W('magic', 'ufo', '🛸', '외계인 납치', 'event', 18, { event: 'ufo', range: 320 }, '빔으로 들어 올렸다 한꺼번에 터뜨림'),
  W('magic', 'train', '🚂', '폭주 기관차', 'event', 15, { event: 'train', range: 300 }, '한 줄을 통째로 밀어버린다'),
  W('magic', 'donkey', '🐴', '콘크리트 당나귀', 'event', 14, { event: 'donkey', range: 320 }, '떨어져 다섯 번 튕기며 쾅'),
  W('magic', 'dragon', '🐉', '드래곤', 'event', 16, { event: 'dragon', range: 340 }, '날아가며 아래로 불'),
  W('magic', 'jackpot', '🎰', '잭팟 룰렛', 'event', 25, { event: 'jackpot', range: 320 }, '777이면 화면 폭파'),
  W('magic', 'nuke', '☢️', '핵', 'nuke', 45, { range: 360, dmg: 8 }, '사거리 안 전부 폭파'),
  W('magic', 'tsunami', '🌊', '해일', 'sweep', 20, { range: 300, dmg: 4, width: 50, dir: 'up', knock: 200, emoji: '🌊' }, '아래에서 위로 쓸어 올린다'),
  W('magic', 'blackhole', '🕳️', '블랙홀', 'pullAt', 24, { range: 320, radius: 130, ttl: 2.5, dmg: 4, boom: 95 }, '한 점으로 빨아들였다가 대폭발'),
  W('magic', 'storm', '⛈️', '번개 폭풍', 'storm', 18, { range: 320, ttl: 4, dmg: 2 }, '4초 동안 벼락이 쏟아진다'),
  W('magic', 'volcano', '🌋', '화산', 'rain', 16, { range: 300, count: 10, dmg: 2.5, radius: 40, fromBottom: true, ignite: true, emoji: '🔥' }, '바닥에서 용암이 솟구친다'),
  W('magic', 'whale', '🐋', '고래 낙하', 'drop', 16, { range: 320, dmg: 8, radius: 110, target: 'dense', emoji: '🐋', size: 70 }, '하늘에서 고래가 떨어진다'),
  W('magic', 'bowling', '🎳', '볼링공', 'sweep', 12, { range: 340, dmg: 5, width: 40, dir: 'up', emoji: '🎳', size: 40 }, '한 줄을 굴러 올라가며 스트라이크'),
  W('magic', 'acid', '🌧️', '산성비', 'rain', 14, { range: 300, count: 24, dmg: 0.8, radius: 18, ignite: true, emoji: '💧' }, '자잘한 비가 녹인다'),
  W('magic', 'icestorm', '🌨️', '얼음 폭풍', 'freezeAll', 22, { range: 300, dmg: 1, freeze: 2.5 }, '사거리 안 전부 얼린다'),
  W('magic', 'hammer', '🔨', '거대 망치', 'drop', 14, { range: 320, dmg: 7, radius: 90, target: 'dense', emoji: '🔨', size: 64 }, '쿵!'),
  W('magic', 'orbital', '📡', '궤도 폭격', 'columns', 18, { range: 320, count: 5, dmg: 4, width: 20 }, '레이저 기둥 다섯 줄'),
  W('magic', 'quake', '🌍', '지진', 'quake', 20, { range: 300, dmg: 1.8, freeze: 0.6 }, '화면 안 전부 흔들어 멈칫'),
  W('magic', 'stars', '🌠', '별똥별', 'rain', 12, { range: 320, count: 16, dmg: 1.6, radius: 30, emoji: '🌠' }, '별이 쏟아진다'),
  W('magic', 'santa', '🎅', '산타 썰매', 'event', 18, { event: 'airstrike', range: 320, emoji: '🎅' }, '선물 폭탄을 뿌리고 지나간다'),
  W('magic', 'pizza', '🍕', '피자 폭격', 'rain', 13, { range: 300, count: 10, dmg: 2, radius: 36, emoji: '🍕' }, '피자가 떨어져 터진다'),

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
  W('passive', 'explosive', '🧪', '폭약', 'passive', 0, {}, '맞힌 적에 8% 확률로 폭약 (죽으면 터짐)'),
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
  F(['railgun', 'tesla'], 'gun', 'railtesla', '⚡', '레일 테슬라', 'beam', 1.4, { range: 480, dmg: 7, pierce: 99, width: 7, chain: 4, look: L_RAIL, color: '#9fe8ff' }, '한 줄을 꿰뚫고, 맞은 적마다 번개가 네 번 옮겨 간다'),
  F(['rocket', 'mlrs'], 'gun', 'nukepod', '☢️', '핵미사일 포대', 'gun', 3, { range: 400, dmg: 3, boom: 72, burst: 8, homing: 4, speed: 320, look: L_MEGAPOD, tracer: 'rocket', color: '#ff3c6e' }, '큰 유도 미사일 여덟 발'),
  F(['flamer', 'tornado'], 'magic', 'firenado', '🔥', '화염 토네이도', 'event', 9, { event: 'tornado', ignite: true }, '빨아들인 적을 전부 불태우는 토네이도'),
  F(['cat', 'wizard'], 'summon', 'archcat', '😼', '대마법사 고양이', 'lob', 0.9, { dmg: 2.5, boom: 44, count: 2, ignite: true, chain: 3, emoji: '☄️' }, '불덩이 두 개, 떨어진 자리에서 번개가 세 번 옮겨 간다'),
  F(['meteor', 'whale'], 'magic', 'whalerain', '🐳', '고래 폭우', 'rain', 11, { count: 7, dmg: 5, radius: 80, emoji: '🐋', size: 46 }, '고래가 비처럼 쏟아진다'),
  F(['soldier', 'robot'], 'summon', 'mecha', '🦾', '메카 군단', 'walker', 4, { count: 3, speed: 110, melee: 6, dmg: 3, boom: 75, emoji: '🤖', size: 26 }, '로봇 셋이 줄지어 나가 여섯 번 때리고 자폭'),
  F(['banana', 'monkey'], 'summon', 'bananarepublic', '🍌', '바나나 공화국', 'event', 4, { event: 'banana', count: 4 }, '갈라지는 바나나 폭탄을 쉬지 않고'),
  F(['freezegun', 'frost'], 'gun', 'absolutezero', '🥶', '절대영도', 'gun', 0.18, { range: 300, dmg: 1, boom: 24, freeze: 1.5, speed: 800, look: L_FROST, tracer: 'ball', color: '#e8fbff', size: 4 }, '맞은 자리 주변을 얼려 버린다 (언 적은 모든 피해 2.5배)'),
  F(['sniper', 'amr'], 'gun', 'railsniper', '🎯', '철갑 저격', 'gun', 1.1, { range: 500, dmg: 14, pierce: 99, speed: 2600, target: 'strong', look: L_AMR, tracer: 'line', color: '#ffffff' }, '줄에 선 적을 전부 꿰뚫는 한 방을 자주'),
  F(['bolttower', 'storm'], 'magic', 'thundergod', '🌩️', '뇌신', 'storm', 7, { ttl: 6, dmg: 2.6 }, '6초 동안 벼락이 쉴 새 없이'),
  F(['bowling', 'train'], 'magic', 'strike', '🎳', '볼링 기관차', 'sweep', 9, { dmg: 8, width: 60, dir: 'up', emoji: '🎳', knock: 180 }, '화면 전체를 쓸어 올리는 스트라이크'),
  F(['jackpot', 'luck'], 'magic', 'lucky777', '🤑', '행운의 777', 'event', 12, { event: 'jackpot', count: 6 }, '777 확률이 크게 오른 잭팟'),
  F(['dragon', 'knight'], 'summon', 'dragonknight', '🐉', '드래곤 기사단', 'stamp', 7, { count: 5, speed: 240, dmg: 3, dir: 'up', ignite: true, emoji: '🐉', size: 22 }, '용 다섯이 위로 돌격하며 불을 붙인다'),
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
    name: `${w.emoji} ${w.name}`,
    desc: `${a.emoji} ${a.name} + ${b.emoji} ${b.name} → ${w.desc}${hasRange(w.cat) ? ` · 사거리 ${w.p.range ?? DEFAULT_RANGE}` : ''}`,
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
    return `🔗 + ${other.emoji}${other.name} → ${f.emoji}${f.name}`;
  }).join(', ');
}

export const ARSENAL: readonly AugmentDef[] = WEAPONS.map((w): AugmentDef => ({
  id: w.id,
  name: `${w.emoji} ${w.name}`,
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
