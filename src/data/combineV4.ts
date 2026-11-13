import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from './chaos';
import type { AttackCat } from './links';

/**
 * 합성 v4 "상태 반응" (11-12). v3 (combineV3.ts) · v2 · 천장 후보 (combineCeil.ts) 는 보관.
 *
 * 11-12 유저: "천장 후보는 두 개에 대한 specific 한 연출 같다. 나중에 무기 두 개 + 두 개 합성에도 적용될 수 있는
 *   규칙이 있을까? 모든 조합을 다 따져서 만들 수는 없잖아. 일정하게 공통으로 적용되는 규칙을 원한 거다." → "샘플들 쭉 뽑아 봐".
 * 리서치 (docs/design/combine-research.md): BotW 화학 엔진처럼 물건끼리 직접 반응하지 않고 "남긴 상태" 끼리 반응하게 하면
 *   짝을 다 짜지 않고도 조합이 나온다. 확 좋아지는 합성은 상대의 빈틈(언제·어디·얼마나 오래·몇 명에게)을 채운다.
 *
 * 짝마다 짠 동작은 없다. 갈래마다 네 가지만 정한다 (아래 CAT4):
 *   남기는 상태 (A 일 때 작용한 적에게) · 노리는 상태 (B 일 때 겨누는 적) · 모양 (A 일 때) · 놓는 것인가 (B 일 때)
 * 공통 규칙 셋 (모든 짝, 모든 깊이, 2+2 에도 같다):
 *   1. 노린다: A 가 작용하는 순간, 합쳐 둔 B 는 그 근처에서 제가 노리는 상태의 적을 친다 (A 가 남긴 상태든 원래 있던 상태든)
 *   2. 반응: 노리던 상태의 적에게 B 는 ×react
 *   3. 모은다: B 는 따로 쏘지 않고, 제 쿨다운만큼 에너지가 차서(×gain) A 의 순간에 나간다. 드문 A 면 모였다가 크게(여러 개),
 *      잦은 A 면 B 의 원래 빈도로. 놓는 B (장판·함정·회전체·떼) 는 A 의 모양(고리·줄)을 따라 놓인다
 * A 는 원래대로 다 한다 (v3 처럼 A 를 바꾸지 않는다). 그래서 합치면 항상 따로보다 낫고, 맞물리면 크게 낫다.
 */

/** 적에게 남는 상태. 무리(crowd)는 남기는 게 아니라 적이 몰려 있으면 그 상태다 */
export type St = 'hold' | 'mark' | 'weak' | 'crowd';
export const ST_LABEL: Record<St, string> = { hold: '묶임', mark: '표식', weak: '약점', crowd: '무리' };
export const ST_COLOR: Record<St, string> = { hold: '#ffe08a', mark: '#ff6b6b', weak: '#9be15d', crowd: '#ffb347' };

export interface Cat4 {
  /** A 일 때 작용한 적에게 남기는 상태 (없으면 null) */
  leaves: St | null;
  /** 그 상태가 남는 시간 (묶임은 실제로 멈춤) */
  sec: number;
  /** B 일 때 노리는 상태 */
  seeks: St;
  /** A 일 때 모양: 놓는 B 는 이 모양을 따라 놓인다 */
  shape: 'point' | 'ring' | 'line';
  /** B 일 때 놓는 것인가 (장판·함정·회전체·떼) */
  place: boolean;
  /** 이름 앞 (A 일 때) */
  pre: string;
  /** 이름 뒤 (B 일 때) */
  noun: string;
  /** 설명: 주는 것 / 목마른 것 */
  give: string;
  need: string;
  /** 극적 반응 (B 가 노리던 상태의 적을 만났을 때): 이름 · 무엇이 일어나나 */
  drama: string;
  dramaText: string;
}

export const CAT4: Record<AttackCat, Cat4> = {
  hand: { leaves: 'mark', sec: 2, seeks: 'crowd', shape: 'point', place: false, pre: '손끝', noun: '손짓', give: '내가 고른 적에 표식', need: '탭할 때만 (기다렸다가 탭한 곳으로)', drama: '손짓 폭발', dramaText: '기다리던 것들이 탭한 곳으로 몰려와 두 배로 터진다' },
  gun: { leaves: 'mark', sec: 1.5, seeks: 'mark', shape: 'point', place: false, pre: '연사', noun: '총구', give: '맞은 적에 표식 (잦다)', need: '세기 · 표식된 적을 노린다', drama: '집중 난사', dramaText: '표식 적 모두에게 총탄이 꽂히고, 노린 적 곁에 총구가 서서 난사한다' },
  turret: { leaves: null, sec: 0, seeks: 'hold', shape: 'point', place: false, pre: '포화', noun: '포격', give: '먼 무리에 크게', need: '때 · 멈춘 적이면 예고 없이 바로 그 위로', drama: '낙뢰 포격', dramaText: '멈춘 적 위로 예고 없이 큰 포탄, 터진 자리에서 파편 넷이 튄다' },
  summon: { leaves: 'hold', sec: 0.6, seeks: 'hold', shape: 'point', place: false, pre: '사냥', noun: '전향', give: '물어서 붙잡는다 (묶임)', need: '수 · 묶인 적을 돌려세운다 (우리 편)', drama: '전향 무리', dramaText: '둘레의 묶인 적 셋까지 돌아서서 제 무리를 들이받고, 끝나면 그 한가운데서 터진다' },
  magic: { leaves: 'hold', sec: 1, seeks: 'crowd', shape: 'point', place: false, pre: '주문', noun: '주문', give: '걸린 적이 멈칫 (묶임)', need: '때·자리 · 무리에 바로 걸린다', drama: '주문 폭발', dramaText: '무리 전체에 주문이 걸리고 0.6초 뒤 한 번 더 울린다' },
  trap: { leaves: 'hold', sec: 1.2, seeks: 'hold', shape: 'point', place: true, pre: '덫', noun: '덫', give: '밟은 적을 묶는다', need: '적이 와야 함 · 묶인 적 발밑에 바로', drama: '덫 사슬', dramaText: '둘레의 묶인 적 다섯까지 발밑에 덫이 박혀 줄줄이 터진다' },
  air: { leaves: null, sec: 0, seeks: 'hold', shape: 'point', place: false, pre: '공습', noun: '낙하', give: '위에서 넓게', need: '때 · 멈춘 적이면 예고 없이', drama: '융단 폭격', dramaText: '멈춘 적 위에 바로, 이어서 둘레의 몰린 곳·묶인 적 넷 위로 줄줄이 떨어진다' },
  charge: { leaves: null, sec: 0, seeks: 'hold', shape: 'point', place: false, pre: '돌진', noun: '돌파', give: '지나간 줄', need: '자리 · 묶인 적이 있는 줄을 거슬러 꿰뚫는다', drama: '올가미 돌파', dramaText: '그 줄의 적 여덟이 올가미로 묶여 한 줄로 서고, 돌격이 끝까지 꿰뚫는다' },
  sound: { leaves: 'hold', sec: 0.5, seeks: 'crowd', shape: 'ring', place: false, pre: '울림', noun: '파동', give: '고리 · 맞은 적이 멈칫 (묶임)', need: '세기 · 무리 한가운데서 울린다', drama: '날려 보내기', dramaText: '무리를 사방으로 날려 보내고, 날아간 적이 부딪친 적도 다친다' },
  spinner: { leaves: 'mark', sec: 1.5, seeks: 'hold', shape: 'point', place: true, pre: '톱날', noun: '톱니', give: '벤 적에 표식', need: '머묾 · 묶인 적 둘레를 돈다', drama: '톱니 올가미', dramaText: '소용돌이가 둘레를 끌어당기고 날 넷이 그 자리를 돈다' },
  field: { leaves: null, sec: 0, seeks: 'hold', shape: 'point', place: true, pre: '늪', noun: '장판', give: '그 자리에 계속', need: '머묾 · 묶인 적 밑에 깔린다', drama: '번지는 장판', dramaText: '묶인 적 다섯까지 발밑으로 장판이 번지고, 한가운데는 크게' },
  ray: { leaves: 'mark', sec: 1.5, seeks: 'hold', shape: 'point', place: false, pre: '광선', noun: '광선', give: '이어진 적에 표식 · 줄', need: '끊김 · 묶인 적에 이어 오래 지진다', drama: '갈래 광선', dramaText: '광선이 묶인 적에서 둘레의 묶인·표식 적 다섯까지 갈라져 이어진다' },
  throw: { leaves: 'mark', sec: 1.5, seeks: 'mark', shape: 'point', place: false, pre: '도약', noun: '도약탄', give: '튕겨 맞은 적들에 표식', need: '세기 · 표식된 적 사이를 튕긴다', drama: '표식 사냥', dramaText: '도약탄이 표식 적을 하나도 빠짐없이 돌며 튕긴다' },
  swarm: { leaves: 'weak', sec: 1.5, seeks: 'crowd', shape: 'point', place: true, pre: '떼', noun: '벌레 떼', give: '덮인 적이 약해진다 (약점)', need: '세기 · 무리를 덮는다', drama: '번지는 떼', dramaText: '몰린 곳 셋에 떼가 한꺼번에 퍼진다' },
  spirit: { leaves: 'mark', sec: 1.5, seeks: 'weak', shape: 'point', place: false, pre: '혼', noun: '혼불', give: '혼탄 맞은 적에 표식', need: '때 · 약해진 적을 거둔다', drama: '혼 거두기', dramaText: '약해진 적 여섯까지 혼탄이 바로 꽂히고 혼불이 뜬다' },
};

/** 세기·상한 (측정해서 맞춤) */
export const V4 = {
  /** B 의 에너지가 차는 빠르기 = 1 / B 쿨다운 × gain (따로 쏘던 것보다 조금 더) */
  gain: 1.5,
  /** 에너지 상한 = max(storeMin, storeSec / B 쿨다운) (드문 A 에 모였다가 크게) */
  storeMin: 3,
  storeSec: 4,
  /** 한 번에 쓰는 최대 단위 */
  maxUnits: 4,
  /** B 한 단위의 세기 (B 가 한 번 쏘는 만큼) */
  base: 0.9,
  /** 노리던 상태의 적에게 */
  react: 2,
  /** 노리는 거리 */
  reach: 220,
  /** 겹친 합성 깊이 */
  maxDepth: 3,
} as const;

/**
 * 극적 반응 (11-13 유저: "극적인 맛이 나면 좋겠다. 웨이브 상승치를 높게 두면 엄청 강해지는 것도 괜찮지 않을까. 극적인 걸로 규칙 세워서 하는 맛이 더 나게")
 * 켜면 (Fusion.drama) B 가 노리던 상태의 적을 만날 때마다 그 갈래의 극적 반응 (CAT4.drama) 이 터진다. 갈래마다 하나라 모든 짝·2+2 에 같다.
 * 함정이 몸이면 밟은 적 뒤로 줄지어 오던 적도 함께 묶인다 (올가미 줄). 세기는 크게: 강해지는 만큼 웨이브 상승치로 받는다.
 */
export const V4D = {
  react: 3,
  gain: 2,
  /** 같은 짝의 반응 이름 뜨는 간격 */
  popSec: 0.8,
  /** B 가 잡을 때마다 B 에너지 (반응이 반응을 부른다, 상한은 그대로) */
  refund: 0.25,
} as const;

/** 짝 분류: 반응 = A 가 남기는 상태를 B 가 노림, 모양 = 놓는 B 가 A 의 고리·줄을 따름, 무리 = B 가 무리를 노림 (적이 몰리면), 보통 = 나머지 */
export type Kind4 = '반응' | '모양' | '무리' | '보통';
export function kind4(a: AttackCat, b: AttackCat): Kind4 {
  const A = CAT4[a];
  const B = CAT4[b];
  if (A.leaves && A.leaves === B.seeks) return '반응';
  if (B.place && A.shape === 'ring') return '모양';
  if (B.seeks === 'crowd') return '무리';
  return '보통';
}

export interface RuleV4 {
  key: string;
  from: AttackCat;
  to: AttackCat;
  title: string;
  name: string;
  kind: Kind4;
  /** 공통 규칙에서 나온 문장 */
  text: string;
}

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];

/** 받침에 맞는 조사 (이/가, 을/를, 은/는, 의) */
export function josa(w: string, withB: string, without: string): string {
  const c = w.charCodeAt(w.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return w + (has ? withB : without);
}

/** 210 (이름·문장 모두 표에서 나온다) */
export function rulesV4(): RuleV4[] {
  const out: RuleV4[] = [];
  for (const a of CATS) {
    for (const b of CATS) {
      if (a === b) continue;
      const A = CAT4[a];
      const B = CAT4[b];
      const k = kind4(a, b);
      const La = CATEGORY_LABEL[a];
      const Lb = CATEGORY_LABEL[b];
      const how =
        k === '반응'
          ? `${josa(La, '이', '가')} 남긴 ${ST_LABEL[A.leaves!]} 적을 ${josa(Lb, '이', '가')} 노린다 (×2)`
          : k === '모양'
            ? `${josa(Lb, '이', '가')} ${La}의 ${A.shape === 'ring' ? '고리' : '줄'}를 따라 놓인다`
            : `${josa(La, '이', '가')} 작용한 자리 근처에서 ${josa(Lb, '이', '가')} ${B.seeks === 'crowd' ? '무리를' : `${ST_LABEL[B.seeks]} 적을`} 노린다`;
      out.push({ key: `${a}>${b}`, from: a, to: b, title: `${CATEGORY_LABEL[a]} + ${CATEGORY_LABEL[b]}`, name: `${A.pre} ${B.noun}`, kind: k, text: `${how}. ${josa(Lb, '은', '는')} 따로 쏘지 않고 모였다가 ${La}의 순간에 나간다.` });
    }
  }
  return out;
}

// ─── 게임 레벨 업 합성 카드 (11-13 유저: "이제 이거 게임에 넣어 봐") ─────────────
// 도파민 모드 레벨 업 선택지에 'fuse:A>B' 로 나온다 (chaos.roll). 고르면 B 를 A 안에 합친다 (v4 극적 반응).

export const FUSE_PREFIX = 'fuse:';
export const fuseId = (a: string, b: string) => `${FUSE_PREFIX}${a}>${b}`;
export function parseFuse(id: string): [string, string] | null {
  if (!id.startsWith(FUSE_PREFIX)) return null;
  const [a, b] = id.slice(FUSE_PREFIX.length).split('>');
  return a && b ? [a, b] : null;
}
const SEEK_WORD: Record<St, string> = { hold: '묶인 적', mark: '표식 적', weak: '약해진 적', crowd: '몰린 적' };

/** 합성 카드에 쓸 이름·꼬리표·설명 (A 안에 B) */
export function fuseCard(id: string): { name: string; tag: string; sub: string; desc: string } | null {
  const p = parseFuse(id);
  if (!p) return null;
  const A = ARMS[p[0]];
  const B = ARMS[p[1]];
  if (!A || !B) return null;
  const a = A.cat as AttackCat;
  const b = B.cat as AttackCat;
  const ca = CAT4[a];
  const cb = CAT4[b];
  const k = kind4(a, b);
  const how =
    k === '반응'
      ? `${josa(A.name, '이', '가')} 맞힌 적에 ${ST_LABEL[ca.leaves!]}을 남기면 ${josa(B.name, '이', '가')} 그 적을 노려`
      : cb.seeks === 'crowd'
        ? `${josa(A.name, '이', '가')} 작용할 때 둘레의 몰린 적에게`
        : `${josa(A.name, '이', '가')} 작용할 때 둘레의 ${SEEK_WORD[cb.seeks]}이 있으면`;
  const t = traitOf(p[1]);
  return {
    name: fuseName(p[0], p[1]),
    tag: `합성 · ${reactName(p[1])}`,
    sub: `${A.emoji ?? ''}${A.name} + ${B.emoji ?? ''}${B.name}`,
    desc: `${josa(B.name, '이', '가')} ${A.name} 안으로 들어가 한 무기가 된다 (따로 쏘지 않는다). ${how} ${cb.drama}: ${cb.dramaText}.${t ? ` ${B.name}의 ${TRAIT_WORD[t]}: ${TRAIT_TEXT[t]}.` : ''} 반응이 ${V5.resMax}번 쌓이면 공명: ${V5.resSec}초 동안 빨라지고 맞히는 족족 반응.`,
  };
}

// ─── v5 (11-13 유저: "두 무기가 동시에 발사되는 느낌이지 않은지, 굳이 합쳐야 할 필요성, 새 무기를 얻은 느낌,
//     종류가 엄청 많으니 매번 새로운 경험이 되게 — 갈래 안에서도 무기가 5·6개씩") ──────────────────────
// 한 몸: B 는 따로 쏘지 않는다 (넘침 → A 가 더 자주). 새 이름: 무기 이름으로. 무기 개성: B 무기의 성질이 반응에 실린다.
// 공명: 반응이 쌓이면 합친 무기가 잠깐 새 기술 (A 가 빨라지고 맞히는 족족 B 의 극적 반응). 모두 갈래·무기 데이터에서 나온다.

export const V5 = {
  /** 공명까지 쌓을 극적 반응 수 (반응이 아닌 B 는 plainCharge 만큼) */
  resMax: 10,
  /** 반응이 아닌 B 한 번이 공명 게이지에 채우는 몫 (보통 짝도 공명은 온다) */
  plainCharge: 1 / 3,
  /** 반응이 아니어도 B 무기의 성질이 실리는 최소 간격 (초) · 세기 배율 */
  traitGap: 0.4,
  traitMul: 0.5,
  /** 공명 시간 (초) */
  resSec: 5,
  /** 공명이 끝난 뒤 게이지가 다시 차기 시작할 때까지 (초). 깊게 겹친 조합에서 공명이 쉬지 않고 이어져 적이 못 다가왔다 (11-13 잠금 검사) */
  resRest: 6,
  /** 공명 동안 A 쿨다운 배율 */
  resCd: 0.5,
  /** 공명 동안 같은 B 가 나가는 최소 간격 (초) */
  resGap: 0.3,
} as const;

/** 무기 성질 (반응에 실리고 반응 이름 뒤에 붙는다). 앞쪽이 먼저 (같은 드묾이면) */
export type Trait = 'freeze' | 'ignite' | 'chain' | 'knock' | 'pierce' | 'homing' | 'bounce' | 'pull' | 'boom' | 'multi' | 'wide' | 'rapid' | 'heavy';
export const TRAITS: readonly Trait[] = ['freeze', 'ignite', 'chain', 'knock', 'pierce', 'homing', 'bounce', 'pull', 'boom', 'multi', 'wide', 'rapid', 'heavy'];
export const TRAIT_WORD: Record<Trait, string> = {
  freeze: '얼음', ignite: '화염', chain: '사슬', knock: '충격', pierce: '관통', homing: '추적', bounce: '튕김', pull: '끌림',
  boom: '폭발', multi: '난사', wide: '광역', rapid: '연타', heavy: '강타',
};
/** 성질이 하는 일 (카드·도감 설명) */
export const TRAIT_TEXT: Record<Trait, string> = {
  freeze: '둘레가 얼어붙는다', ignite: '둘레에 불이 붙는다', chain: '번개가 옆 적으로 건너뛴다', knock: '둘레를 밀쳐 낸다',
  pierce: '그 적 뒤로 꿰뚫고 나간다', homing: '한 발이 다른 적을 쫓아간다', bounce: '맞고 튕겨 두 적을 더 친다', pull: '둘레 적을 한가운데로 끌어온다',
  boom: '그 자리가 터진다', multi: '둘레 셋에 흩뿌린다', wide: '넓게 한 번 더 휩쓴다', rapid: '같은 적을 두 번 더 때린다', heavy: '한 방이 무겁게 내려친다',
};

const median = (a: number[]) => (a.length ? [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)] : 0);
/** 무기가 가질 수 있는 성질들 (수치에서) */
function traitCands(id: string, mid: { cd: number; radius: number; dmg: number }): Trait[] {
  const A = ARMS[id];
  const p = A.p;
  const out: Trait[] = [];
  if (p.freeze) out.push('freeze');
  if (p.ignite) out.push('ignite');
  if (p.chain) out.push('chain');
  if (p.knock) out.push('knock');
  if (p.pierce) out.push('pierce');
  if (p.homing) out.push('homing');
  if (p.bounce) out.push('bounce');
  if (p.pullOrb || A.kind === 'pullAt' || A.kind === 'tapPull') out.push('pull');
  if (p.boom) out.push('boom');
  if ((p.count ?? 1) >= 3 || (p.burst ?? 1) >= 3) out.push('multi');
  if (mid.radius > 0 && (p.radius ?? 0) >= mid.radius * 1.25) out.push('wide');
  if (A.cd <= mid.cd * 0.75) out.push('rapid');
  if (A.cd >= mid.cd * 1.35 || (mid.dmg > 0 && (p.dmg ?? 0) >= mid.dmg * 1.5)) out.push('heavy');
  if (out.length === 0) out.push(A.cd < mid.cd ? 'rapid' : 'heavy');
  return out;
}
/** 수치에서 견준 성질 (무기 고유 성질이 없을 때만) */
const DERIVED: ReadonlySet<Trait> = new Set<Trait>(['multi', 'wide', 'rapid', 'heavy']);
let TRAIT_CACHE: Map<string, Trait> | null = null;
/** 무기 성질: 그 무기가 가질 수 있는 성질 가운데 같은 갈래에서 가장 드문 것 (갈래 안 무기끼리 되도록 다르게) */
export function traitOf(id: string): Trait | null {
  if (!TRAIT_CACHE) {
    TRAIT_CACHE = new Map();
    const by = new Map<string, string[]>();
    for (const a of Object.values(ARMS)) {
      if (a.cat === 'passive') continue;
      const l = by.get(a.cat) ?? [];
      l.push(a.id);
      by.set(a.cat, l);
    }
    for (const ids of by.values()) {
      const mid = {
        cd: median(ids.map((i) => ARMS[i].cd)),
        radius: median(ids.map((i) => ARMS[i].p.radius ?? 0).filter((v) => v > 0)),
        dmg: median(ids.map((i) => ARMS[i].p.dmg ?? 0).filter((v) => v > 0)),
      };
      const cands = new Map(ids.map((i) => [i, traitCands(i, mid)] as const));
      const freq = new Map<Trait, number>();
      for (const l of cands.values()) for (const t of l) freq.set(t, (freq.get(t) ?? 0) + 1);
      for (const [i, l] of cands) {
        // 무기 수치에 바로 있는 성질(얼음·폭발…)이 먼저 (자폭 병사는 폭발이다), 없으면 난사·광역·연타·강타 가운데
        const own = l.filter((t) => !DERIVED.has(t));
        const pool = own.length ? own : l;
        const best = [...pool].sort((x, y) => (freq.get(x) ?? 0) - (freq.get(y) ?? 0) || TRAITS.indexOf(x) - TRAITS.indexOf(y))[0];
        TRAIT_CACHE.set(i, best);
      }
    }
  }
  return TRAIT_CACHE.get(id) ?? null;
}

/** 합친 무기의 새 이름: B 무기 이름의 앞말 + A 무기 이름 (무기 짝마다 다르다). 예: 군견 + 지뢰밭 → "군견 지뢰밭" */
export function fuseName(a: string, b: string): string {
  const A = ARMS[a];
  const B = ARMS[b];
  if (!A || !B) return '';
  const head = B.name.split(' ')[0];
  return A.name.startsWith(head) ? `${B.name} ${A.name}` : `${head} ${A.name}`;
}

/** 반응 이름 (갈래의 극적 반응 + B 무기 성질) */
export function reactName(b: string): string {
  const B = ARMS[b];
  if (!B) return '';
  const t = traitOf(b);
  const d = CAT4[B.cat as AttackCat]?.drama ?? '';
  return t ? `${d} · ${TRAIT_WORD[t]}` : d;
}
