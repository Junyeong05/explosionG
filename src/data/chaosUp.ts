/**
 * 도파민 모드 무기별 레벨 업 효과 (Lv2, 3, 4, 5).
 * 플레이 피드백: "각 무기들도 업그레이드 요소가 살짝씩은 달라야" → 산탄총은 산탄 수, 저격총은 관통,
 * 소환수는 마릿수, 마법은 규모처럼 무기마다 오르는 게 다르다.
 *
 * 더하는 값: count·burst·pierce·boom·radius·width·range·ttl·freeze·knock·chain·melee·bounce·homing.
 * 곱하는 값: dmg (1 + x 배), cd·spread·speed (그 배).
 */
export type UpKey =
  | 'dmg' | 'cd' | 'count' | 'burst' | 'pierce' | 'boom' | 'radius' | 'width' | 'range' | 'ttl'
  | 'freeze' | 'knock' | 'chain' | 'melee' | 'bounce' | 'homing' | 'spread' | 'speed';

export interface UpStep {
  label: string;
  d: Partial<Record<UpKey, number>>;
}

const S = (label: string, d: UpStep['d']): UpStep => ({ label, d });
const pct = (x: number) => Math.round(x * 100);
const dmg = (x: number, what = '피해') => S(`${what} +${pct(x)}%`, { dmg: x });
const rate = (x: number) => S(`연사 +${pct(x)}%`, { cd: 1 / (1 + x) });
const cool = (x: number) => S(`쿨다운 -${pct(x)}%`, { cd: 1 - x });
const more = (k: number, what: string) => S(`${what} +${k}`, { count: k });
const pierce = (k: number) => S(`관통 +${k}`, { pierce: k });
const boom = (k: number) => S(`폭발 범위 +${k}`, { boom: k });
const radius = (k: number, what = '범위') => S(`${what} +${k}`, { radius: k });
const width = (k: number, what = '굵기') => S(`${what} +${k}`, { width: k });
const range = (k: number) => S(`사거리 +${k}`, { range: k });
const ttl = (k: number, what = '지속') => S(`${what} +${k}초`, { ttl: k });
const freeze = (k: number, what = '얼림') => S(`${what} +${k}초`, { freeze: k });
const burst = (k: number, what = '연발') => S(`${what} +${k}`, { burst: k });
const knock = (k: number) => S(`밀어내기 +${k}`, { knock: k });
const chain = (k: number) => S(`번개 옮겨가기 +${k}`, { chain: k });
const melee = (k: number, what: string) => S(`${what} +${k}번`, { melee: k });
const bounce = (k: number) => S(`튕김 +${k}`, { bounce: k });
const tight = (x: number) => S(`퍼짐 -${pct(x)}%`, { spread: 1 - x });
const fast = (x: number, what = '속도') => S(`${what} +${pct(x)}%`, { speed: 1 + x });
const both = (a: UpStep, b: UpStep): UpStep => S(`${a.label} · ${b.label}`, { ...a.d, ...b.d });

/** 무기별 Lv2~5 효과 (키 = id 에서 arm_ 뺀 것) */
export const UP: Record<string, UpStep[]> = {
  // 손공격
  bomb: [S('반경 +10%', {}), S('반경 +10% · 연쇄 +1', {}), S('반경 +10%', {}), S('반경 +10% · 연쇄 +1', {})],
  zap: [more(1, '대상'), dmg(0.25), more(2, '대상'), both(radius(30), dmg(0.25))],
  mine: [both(more(1, '최대 지뢰'), radius(6, '폭발 범위')), dmg(0.3), more(2, '최대 지뢰'), both(radius(12, '폭발 범위'), dmg(0.3))],
  slash: [width(4, '두께'), dmg(0.3), width(6, '두께'), dmg(0.4)],
  flame: [radius(8), ttl(1), radius(10), dmg(0.4, '초당 피해')],
  snipe: [dmg(0.3), cool(0.2), dmg(0.4), radius(40, '찾는 범위')],
  frostHand: [freeze(0.5), radius(12), freeze(0.5), dmg(1)],
  shock: [knock(80), radius(12), dmg(0.6), knock(120)],
  poison: [radius(10), ttl(1.5), dmg(0.4, '초당 피해'), radius(15)],
  punch: [dmg(0.3), cool(0.2), dmg(0.4), radius(10)],
  grenade: [boom(10), dmg(0.3), cool(0.2), boom(15)],
  strike: [width(6, '폭'), dmg(0.3), width(8, '폭'), dmg(0.4)],
  missile: [more(1, '미사일'), dmg(0.25), more(2, '미사일'), boom(10)],
  hole: [radius(12), dmg(0.25), ttl(0.4, '빨아들이는 시간'), boom(15)],
  coins: [more(3, '동전'), dmg(0.3), more(5, '동전'), radius(8, '폭발 범위')],

  // 총
  pistol: [dmg(0.25), rate(0.15), pierce(1), more(1, '한 번에 탄')],
  revolver: [dmg(0.3), pierce(1), dmg(0.3), rate(0.25)],
  dual: [rate(0.15), dmg(0.25), more(1, '한 번에 탄'), rate(0.2)],
  smg: [rate(0.15), dmg(0.25), tight(0.3), rate(0.2)],
  rifle: [burst(1, '점사'), dmg(0.25), pierce(1), burst(2, '점사')],
  shotgun: [more(2, '산탄'), dmg(0.25), more(3, '산탄'), both(range(40), tight(0.2))],
  double: [more(3, '산탄'), dmg(0.25), rate(0.2), more(4, '산탄')],
  sniper: [pierce(1), dmg(0.3), pierce(2), rate(0.25)],
  amr: [dmg(0.3), rate(0.15), dmg(0.4), range(60)],
  minigun: [rate(0.15), dmg(0.25), tight(0.3), rate(0.2)],
  gatling: [more(1, '총열'), dmg(0.25), rate(0.15), more(1, '총열')],
  glauncher: [boom(8), dmg(0.25), more(1, '한 번에 유탄'), boom(10)],
  rocket: [boom(10), S('유도 강하게', { homing: 2 }), burst(1, '로켓'), dmg(0.4)],
  mlrs: [burst(2, '로켓'), boom(6), dmg(0.25), burst(3, '로켓')],
  flamer: [range(25), dmg(0.3), S('불길 넓게', { spread: 1.3 }), range(35)],
  laser: [pierce(1), dmg(0.3), width(2), pierce(2)],
  railgun: [dmg(0.3), width(3), rate(0.2), dmg(0.4)],
  plasma: [boom(6), dmg(0.25), more(1, '한 번에 탄'), boom(8)],
  crossbow: [pierce(1), dmg(0.3), more(1, '한 번에 화살'), pierce(2)],
  nailgun: [rate(0.15), pierce(1), dmg(0.3), rate(0.2)],
  musket: [dmg(0.4), rate(0.2), pierce(2), dmg(0.5)],
  water: [knock(80), rate(0.15), more(1, '물줄기'), knock(120)],
  freezegun: [freeze(0.3), rate(0.15), dmg(0.5), freeze(0.5)],
  dart: [dmg(0.3), rate(0.2), pierce(1), dmg(0.4)],
  teslagun: [chain(1), dmg(0.25), chain(2), rate(0.2)],
  bouncer: [bounce(1), dmg(0.25), bounce(2), more(1, '한 번에 탄')],
  popcorn: [dmg(0.25), rate(0.15), more(1, '한 번에 탄'), rate(0.2)],
  orbgun: [boom(15), dmg(0.4), rate(0.2), boom(20)],
  missilepod: [burst(1, '미사일'), boom(6), dmg(0.25), burst(2, '미사일')],

  // 포탑
  cannon: [more(1, '포탄'), boom(8), dmg(0.3), more(1, '포탄')],
  mortar: [boom(12), dmg(0.3), more(1, '포탄'), boom(15)],
  tesla: [more(1, '대상'), dmg(0.3), more(2, '대상'), cool(0.2)],
  satellite: [width(4), dmg(0.3), cool(0.2), width(6)],
  frost: [radius(12), freeze(0.5), radius(15), dmg(1)],
  flametower: [radius(8), ttl(1), dmg(0.4, '초당 피해'), radius(12)],
  gas: [radius(10), ttl(2), dmg(0.4, '초당 피해'), radius(15)],
  saw: [more(1, '톱날'), dmg(0.3), ttl(2), more(1, '톱날')],
  magnet: [radius(20), boom(15), dmg(0.4), cool(0.2)],
  bolttower: [more(1, '벼락'), dmg(0.3), more(2, '벼락'), cool(0.2)],
  bubble: [radius(12), dmg(0.4), ttl(0.5, '띄우는 시간'), radius(15)],
  bell: [range(30), dmg(0.4), freeze(0.3, '멈칫'), range(40)],

  // 소환수
  soldier: [more(1, '병사'), dmg(0.3), cool(0.2), more(2, '병사')],
  sheep: [more(1, '양'), boom(10), more(1, '양'), dmg(0.4)],
  chicken: [more(2, '닭'), dmg(0.3), more(2, '닭'), cool(0.2)],
  granny: [boom(15), dmg(0.4), more(1, '할머니'), fast(0.4, '걸음')],
  rats: [more(3, '쥐'), dmg(0.3), more(4, '쥐'), cool(0.2)],
  bees: [more(2, '벌'), melee(1, '쏘기'), more(3, '벌'), dmg(0.4)],
  dog: [melee(3, '물기'), dmg(0.3), more(1, '강아지'), melee(4, '물기')],
  bear: [melee(4, '후려치기'), dmg(0.3), more(1, '곰'), dmg(0.4)],
  robot: [melee(3, '때리기'), boom(15), dmg(0.3), more(1, '로봇')],
  knight: [more(2, '기사'), dmg(0.3), more(2, '기사'), cool(0.2)],
  dino: [more(1, '공룡'), dmg(0.3), more(2, '공룡'), cool(0.2)],
  cows: [more(1, '소'), dmg(0.3), more(2, '소'), cool(0.2)],
  rhino: [dmg(0.4), more(1, '코뿔소'), cool(0.2), dmg(0.5)],
  elephant: [more(1, '코끼리'), dmg(0.3), cool(0.2), more(2, '코끼리')],
  penguin: [more(2, '펭귄'), freeze(0.4), more(2, '펭귄'), dmg(0.4)],
  cat: [more(1, '불덩이'), boom(6), cool(0.2), more(1, '불덩이')],
  monkey: [more(1, '바나나'), dmg(0.3), boom(8), more(1, '바나나')],
  octopus: [more(1, '먹물'), freeze(0.5, '굳히기'), boom(10), more(1, '먹물')],
  wizard: [more(1, '번개'), dmg(0.3), more(2, '번개'), cool(0.2)],
  archer: [more(1, '한 번에 화살'), pierce(1), rate(0.2), more(1, '한 번에 화살')],
  ninja: [more(2, '표창'), pierce(1), dmg(0.3), more(2, '표창')],
  drone: [more(1, '드론'), dmg(0.3), more(1, '드론'), rate(0.2)],
  dragonling: [more(1, '불길'), cool(0.2), more(1, '불길'), dmg(0.4)],
  eagle: [more(1, '독수리'), dmg(0.4), boom(15), more(1, '독수리')],

  // 마법
  meteor: [more(1, '운석 규모'), cool(0.15), more(1, '운석 규모'), dmg(0.4)],
  airstrike: [more(1, '폭탄 촘촘'), dmg(0.3), cool(0.15), more(1, '폭탄 촘촘')],
  banana: [more(2, '갈라지는 바나나'), dmg(0.3), cool(0.15), more(2, '갈라지는 바나나')],
  tornado: [more(1, '빨아들이는 범위'), dmg(0.4), cool(0.15), more(1, '빨아들이는 범위')],
  ufo: [more(1, '빔 폭'), dmg(0.4), cool(0.15), more(1, '빔 폭')],
  train: [dmg(0.3), cool(0.15), dmg(0.4), cool(0.15)],
  donkey: [more(1, '튕김'), dmg(0.3), more(1, '튕김'), cool(0.15)],
  dragon: [more(1, '불길'), dmg(0.3), cool(0.15), more(1, '불길')],
  jackpot: [S('777 확률 +3%', { count: 1 }), cool(0.15), S('777 확률 +3%', { count: 1 }), cool(0.2)],
  nuke: [cool(0.15), dmg(0.4), cool(0.15), dmg(0.6)],
  tsunami: [width(15, '물결 두께'), dmg(0.3), cool(0.15), knock(150)],
  blackhole: [radius(15), boom(10), dmg(0.25), cool(0.1)],
  storm: [ttl(1.5), dmg(0.3), ttl(2), cool(0.15)],
  volcano: [more(4, '용암'), dmg(0.3), more(5, '용암'), boom(10)],
  whale: [more(1, '고래'), boom(20), dmg(0.4), more(1, '고래')],
  bowling: [more(1, '공'), dmg(0.3), more(1, '공'), width(15, '공 크기')],
  acid: [more(8, '빗방울'), dmg(0.3), more(10, '빗방울'), cool(0.15)],
  icestorm: [freeze(0.8), dmg(1), cool(0.15), freeze(1)],
  hammer: [boom(15), dmg(0.4), more(1, '망치'), cool(0.15)],
  orbital: [more(2, '기둥'), dmg(0.3), more(3, '기둥'), width(6)],
  quake: [dmg(0.4), freeze(0.4, '멈칫'), cool(0.15), dmg(0.5)],
  stars: [more(6, '별'), dmg(0.3), more(8, '별'), boom(8)],
  santa: [more(1, '선물 촘촘'), dmg(0.3), cool(0.15), more(1, '선물 촘촘')],
  pizza: [more(4, '피자'), dmg(0.3), more(5, '피자'), boom(10)],
};
