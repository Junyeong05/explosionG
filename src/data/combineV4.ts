import { ATTACK_CATEGORIES, CATEGORY_LABEL } from './chaos';
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
