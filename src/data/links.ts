import { ATTACK_CATEGORIES, CATEGORY_COLOR, CATEGORY_LABEL, type ArmCategory } from './chaos';

/**
 * 실어 나르기 (갈래 둘을 잇는 연결) 설계 데이터 — docs/design/carry-links.md, 210가지 표는 carry-links-210.md.
 * 연결 A → B = A 가 나르는 방식(언제·어디서) × B 가 실려서 열리는 모습(무엇이). 방향이 있다:
 *   총 → 소환수 = 총탄이 꽂힌 자리에서 소환수가 튀어나온다 / 소환수 → 총 = 소환수가 총을 업고 나가 쏜다.
 * 갈래 15개 × 두 조각 = 30조각에서 15 × 14 = 210가지가 나온다. 조각을 그냥 이어 어색하거나 더 재밌는 짝은 SIGNATURE 로 따로 쓴다.
 * (아직 게임에 들어가지 않은 설계. 넣을 때 이 데이터를 그대로 읽는다)
 */
export interface LinkPiece {
  /** 하는 일 한 줄 (갈래 기능) */
  role: string;
  /** 나를 때: "…에서" 로 끝나는 언제·어디서 */
  carry: string;
  /** 나를 때 연출 */
  carryFx: string;
  /** 실릴 때: 무엇이 열리나 (문장 끝) */
  payload: string;
  /** 실릴 때 연출 */
  payloadFx: string;
  /** 쓰임: 나를 때 어디를 노리나 / 실릴 때 무엇을 더하나 */
  where: string;
  adds: string;
}

export const LINK_PIECES: Record<Exclude<ArmCategory, 'passive'>, LinkPiece> = {
  hand: {
    role: '내가 고른 곳을 친다',
    carry: '탭한 자리에서',
    carryFx: '손가락 자리에 하얀 고리가 터지며',
    payload: '가진 손 기술 하나(번개·화염·바위…)가 한 번 터진다',
    payloadFx: '작은 탭 고리와 손 기술 효과',
    where: '내가 고른 곳', adds: '손 기술',
  },
  gun: {
    role: '가장 앞 적부터 빠르게 정리',
    carry: '총탄 다섯 발 중 한 발이 적에 꽂힌 자리에서',
    carryFx: '예광탄 하나가 연결 색으로 빛나다 꽂히는 순간',
    payload: '작은 총구가 생겨 근처 적을 2초 동안 난사한다',
    payloadFx: '떠 있는 총구가 빠르게 깜빡이며 예광탄을 뿌림',
    where: '앞줄', adds: '빠른 연사',
  },
  turret: {
    role: '먼 뒷줄 무리를 포격 (가까운 적은 못 침)',
    carry: '포탄이 먼 무리에 떨어져 터진 자리에서',
    carryFx: '조준 표시가 조여 들고 포탄이 높이 떨어져 펑 터지면서',
    payload: '작은 포탄 하나가 근처 무리로 날아가 둥글게 터진다',
    payloadFx: '낮은 포물선 + 작은 조준 표시 → 펑',
    where: '먼 뒷줄', adds: '범위 폭발',
  },
  summon: {
    role: '적 하나씩 맡아 붙잡고 싸운다',
    carry: '소환수가 나올 때 등에 업고 나가, 맡은 적 앞에서',
    carryFx: '초록 소환 고리에서 나온 소환수 등에 연결 색 짐이 실려 있다가',
    payload: '소환수 한 마리가 나와 아직 아무도 안 맡은 적을 맡는다',
    payloadFx: '초록 소환 고리가 터지며 한 마리가 뛰쳐나감',
    where: '맡은 적', adds: '붙잡는 개체',
  },
  magic: {
    role: '피해 말고 규칙을 바꾼다 (멈춤·변이·되돌리기·분신·매혹·가속)',
    carry: '주문이 마법진에서 발동하는 자리에서',
    carryFx: '보라 마법진이 다 차오르는 순간',
    payload: '작은 마법진이 열려 근처 적에게 가진 주문 하나(멈춤·변이·되돌리기·매혹)를 짧게 건다',
    payloadFx: '작은 보라 문양 + 그 주문 표시 (멈춤 정지선, 변이 보라 덩어리, 매혹 분홍 테두리)',
    where: '몰린 곳', adds: '규칙 바꾸기',
  },
  trap: {
    role: '미리 깔아 쌓아 두고, 밟은 적을 묶는다',
    carry: '깔아 둔 함정이 밟히는 순간 그 자리에서',
    carryFx: '점선 범위가 번쩍이며 터지는 순간',
    payload: '함정 하나가 그 자리 바닥에 꽂혀 기다린다',
    payloadFx: '작은 함정이 튀어 바닥에 꽂히고 깜빡이는 고리',
    where: '길목', adds: '묶는 함정',
  },
  air: {
    role: '넓게 흩어진 적을 하늘에서 친다',
    carry: '하늘에서 떨어진 것이 바닥에 닿은 자리에서',
    carryFx: '그림자가 짙어지다 떨어져 부딪히는 순간',
    payload: '그 자리 위로 하나가 더 떨어진다 (그림자 예고는 짧게)',
    payloadFx: '작은 그림자 → 낙하',
    where: '흩어진 자리', adds: '낙하 폭발',
  },
  charge: {
    role: '한 줄을 끝까지 관통',
    carry: '탈것에 싣고 화면을 가로지르며, 지나간 길 위 몇 곳에서',
    carryFx: '달리는 것 뒤로 연결 색 자국이 남고 그 자국에서',
    payload: '작은 돌격 하나가 출발해 가로지른다',
    payloadFx: '짧은 쐐기가 튀어나가며 직선 자국',
    where: '한 줄 전체', adds: '가로지르는 관통',
  },
  sound: {
    role: '가까이 온 적을 한꺼번에 밀고 멈칫',
    carry: '퍼지는 고리가 처음 닿은 적 몇 마리 자리에서',
    carryFx: '고리가 닿는 순간 그 적이 떨리며',
    payload: '작은 고리가 한 번 퍼져 근처를 밀고 멈칫하게 한다',
    payloadFx: '작은 금빛 고리 한 겹',
    where: '방어선 가까이', adds: '밀어내기·멈칫',
  },
  spinner: {
    role: '오래 남아 화면을 휘젓는다',
    carry: '튕겨 다니던 날이 벽이나 적에 튕기는 자리마다',
    carryFx: '날이 튕길 때 불꽃이 튀며',
    payload: '작은 날 하나가 튀어나와 짧게 튕겨 다닌다',
    payloadFx: '작은 회전 날이 빙글 튀어나감',
    where: '화면 곳곳', adds: '남아 도는 날',
  },
  field: {
    role: '구역을 막는다 (지나가는 동안 계속)',
    carry: '깔린 장판 위에 있는 적에게서 (1초에 한 번)',
    carryFx: '장판이 맥박치듯 밝아질 때',
    payload: '작은 장판이 2초 동안 깔린다',
    payloadFx: '바닥에 작은 원이 번지며 깔림',
    where: '몰린 구역', adds: '지속 장판',
  },
  ray: {
    role: '단단한 적에 붙어 오래 지질수록 세짐',
    carry: '줄기가 붙은 적의 배율이 오를 때마다 그 적 자리에서',
    carryFx: '줄기가 굵어지며 배율 숫자가 바뀌는 순간',
    payload: '근처 적에게 짧은 줄기 한 줄이 잠깐 이어진다',
    payloadFx: '가는 빛줄기가 옆 적으로 튀어 붙음',
    where: '단단한 적', adds: '이어지는 줄기',
  },
  throw: {
    role: '흩어진 여러 적을 차례로',
    carry: '던진 것이 적에 맞고 튕길 때마다 그 자리에서',
    carryFx: '통 튕기며 노란 고리가 터질 때',
    payload: '작은 투척물이 튕겨 나가 옆 적 둘을 차례로 맞힌다',
    payloadFx: '작은 파편이 통통 두 번',
    where: '흩어진 여럿', adds: '튕기는 연타',
  },
  swarm: {
    role: '덮은 적을 약하게 (느림, 받는 피해 ×1.5)',
    carry: '구름이 덮고 있는 적에게서 (1초에 한 번)',
    carryFx: '구름이 맥박치며 덮인 적들이 연두로 빛날 때',
    payload: '작은 구름이 피어나 1.5초 덮는다 (약화)',
    payloadFx: '작은 점들이 피어오르며 맴돎',
    where: '몰린 무리', adds: '약화 구름',
  },
  spirit: {
    role: '처치가 쌓이면 터진다 (혼 열 개)',
    carry: '정령이 혼을 다 모아 터질 때, 사방으로 나간 혼탄이 맞은 자리에서',
    carryFx: '정령이 커지며 빛나다 터지는 순간',
    payload: '작은 정령이 잠깐 떠서 근처 처치의 혼 다섯을 모으다 터진다',
    payloadFx: '작은 빛 구슬이 떠서 혼을 빨아들이다 펑',
    where: '처치가 몰린 곳', adds: '혼 폭발',
  },
};

/** 이름 붙은 대표 조합: 조각을 그냥 이은 것보다 낫게 다시 쓴 것 */
export interface Signature {
  name: string;
  text: string;
  fx: string;
}

export const SIGNATURE: Partial<Record<string, Signature>> = {
  'gun>summon': { name: '착탄 소환', text: '총탄 다섯 발 중 한 발이 적에 꽂히면 그 자리에서 소환수가 튀어나와 꽂힌 적을 맡는다.', fx: '예광탄이 초록으로 빛나다 꽂히고, 그 자리에서 소환 고리 → 한 마리가 그 적에 달라붙음' },
  'summon>gun': { name: '무장 소환수', text: '소환수가 총을 업고 나가, 맡은 적 앞에서 멈춰 2초 동안 난사한다.', fx: '소환수 등에 작은 총구, 적 앞에서 서며 예광탄을 뿌림' },
  'charge>field': { name: '불 자국 질주', text: '돌격이 지나간 길을 따라 작은 장판이 연달아 깔려, 한 줄이 통째로 구역이 된다.', fx: '달리는 것 뒤로 장판 원이 줄지어 번짐' },
  'throw>trap': { name: '통통 지뢰', text: '던진 것이 튕길 때마다 그 자리에 함정이 하나씩 꽂힌다. 흩어진 적 사이에 지뢰가 흩뿌려진다.', fx: '통 튕길 때마다 작은 함정이 튀어 바닥에 꽂힘' },
  'ray>swarm': { name: '줄기 포자', text: '줄기가 붙은 적의 배율이 오를 때마다 그 적 둘레에 작은 구름이 피어, 약해진 적이 더 빨리 녹는다.', fx: '굵어지는 줄기 끝에서 연두 점이 피어오름' },
  'swarm>ray': { name: '약점 표적', text: '구름이 덮은 적들 사이를 짧은 줄기가 이어 지진다. 약해진 적(피해 ×1.5)을 줄기가 오래 붙잡는다.', fx: '구름 속 적들이 가는 빛줄로 엮임' },
  'magic>summon': { name: '소환진', text: '주문이 발동하는 마법진에서 소환수 셋이 쏟아져 나와 각자 다른 적을 맡는다.', fx: '보라 마법진이 다 차오르자 초록 고리 셋이 터지며 뛰쳐나감' },
  'trap>magic': { name: '덫 주문', text: '함정이 밟히는 순간 그 자리에 작은 마법진이 열려, 근처 적을 멈추거나 변이시킨다.', fx: '점선 범위가 번쩍이자 바닥에 보라 문양' },
  'spirit>turret': { name: '혼 포격', text: '정령이 터질 때 혼탄이 맞은 자리마다 작은 포탄이 떨어진다.', fx: '사방으로 퍼진 혼탄 자리에 조준 표시 → 펑' },
  'turret>swarm': { name: '포자탄', text: '포탄이 떨어진 먼 무리 위에 구름이 피어, 뒷줄을 통째로 약하게 만든다.', fx: '펑 터진 자리에서 점들이 피어올라 무리를 덮음' },
  'air>trap': { name: '공중 살포', text: '하늘에서 떨어진 자리에 함정이 꽂힌다. 흩어진 자리마다 지뢰밭이 생긴다.', fx: '그림자 → 낙하 → 그 자리에 깜빡이는 함정' },
  'sound>throw': { name: '반향 투척', text: '고리가 닿은 적마다 작은 투척물이 튕겨 나가 옆 적 둘을 맞힌다. 가까이 온 무리가 통통 무너진다.', fx: '금빛 고리가 닿은 적들에서 파편이 통통' },
  'spinner>ray': { name: '날빛', text: '날이 튕길 때마다 근처 적에게 짧은 줄기가 이어진다. 날이 지나간 곳마다 빛줄이 번쩍인다.', fx: '튕기는 불꽃 자리에서 가는 빛줄기' },
  'field>magic': { name: '주문진 장판', text: '장판 위 적에게 1초에 한 번 작은 주문이 걸린다. 장판이 곧 멈춤·변이 구역이 된다.', fx: '장판이 밝아질 때 위에 선 적에게 보라 문양' },
  'magic>air': { name: '하늘 문', text: '주문 마법진이 열린 자리 위로 낙하물이 쏟아진다.', fx: '마법진이 차오르며 위에서 그림자 → 낙하' },
  'hand>spirit': { name: '손끝 정령', text: '탭한 자리에 작은 정령이 떠서, 그 근처에서 죽은 적의 혼을 모으다 터진다.', fx: '탭 고리에서 빛 구슬이 떠오름' },
  'spirit>summon': { name: '혼의 군세', text: '정령이 터질 때 혼탄이 맞은 자리마다 소환수가 일어나 각자 적을 맡는다.', fx: '혼탄 자리에 초록 고리가 줄지어 터짐' },
  'summon>trap': { name: '공병 소환수', text: '소환수가 맡은 적 앞에 함정을 깔고 싸운다. 소환수와 싸우는 적이 묶인다.', fx: '소환수가 적 앞 바닥에 함정을 꽂음' },
  'trap>charge': { name: '도화선', text: '함정이 밟히면 그 자리에서 작은 돌격이 출발해 한 줄을 가로지른다.', fx: '터지는 자리에서 쐐기가 직선으로 튀어나감' },
  'charge>sound': { name: '음속 돌파', text: '돌격이 지나간 길 몇 곳에서 고리가 퍼져, 한 줄 양옆 적을 밀어낸다.', fx: '달리는 자국에서 금빛 고리가 연달아' },
  'throw>spirit': { name: '혼 줍기', text: '던진 것이 튕길 때마다 그 자리에 작은 정령이 떠서 혼을 모은다.', fx: '통 튕긴 자리에 빛 구슬' },
  'ray>magic': { name: '주문 집속', text: '줄기가 붙은 적의 배율이 오를 때마다 그 적에게 작은 주문(멈춤·변이)이 걸린다. 보스를 붙잡고 녹인다.', fx: '굵어지는 줄기 끝에 보라 문양' },
  'gun>turret': { name: '관측 사격', text: '총탄이 꽂힌 자리에서 작은 포탄이 근처 무리로 날아가 터진다. 총이 앞줄을 맞히면 포탄이 뒷줄을 친다.', fx: '빛나는 예광탄이 꽂히자 낮은 포물선이 뒤로' },
  'swarm>summon': { name: '숙주', text: '구름이 덮은 적에게서 소환수가 기어 나와 약해진 적을 맡는다.', fx: '구름이 맥박칠 때 초록 고리' },
  'field>spinner': { name: '칼날 바닥', text: '장판 위 적에게서 작은 날이 튀어나와 장판 위를 튕겨 다닌다.', fx: '밝아지는 장판에서 회전 날이 빙글' },
};

export interface Link {
  key: string;
  from: ArmCategory;
  to: ArmCategory;
  title: string;
  name: string | null;
  text: string;
  fx: string;
  use: string;
}

const CATS = ATTACK_CATEGORIES as readonly Exclude<ArmCategory, 'passive'>[];

function josa(word: string, withBatchim: string, without: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return without;
  return (c - 0xac00) % 28 ? withBatchim : without;
}

/** 210가지 연결 (A 순서대로, A 안에서 B 순서대로) */
export function allLinks(): Link[] {
  const out: Link[] = [];
  for (const a of CATS) {
    for (const b of CATS) {
      if (a === b) continue;
      const A = LINK_PIECES[a];
      const B = LINK_PIECES[b];
      const key = `${a}>${b}`;
      const sig = SIGNATURE[key];
      const adds = B.adds;
      out.push({
        key,
        from: a,
        to: b,
        title: `${CATEGORY_LABEL[a]} → ${CATEGORY_LABEL[b]}`,
        name: sig?.name ?? null,
        text: sig?.text ?? `${A.carry} ${B.payload}.`,
        fx: sig?.fx ?? `${A.carryFx} ${B.payloadFx}`,
        use: `${A.where}에 ${adds}${josa(adds, '을', '를')} 더한다`,
      });
    }
  }
  return out;
}

export const LINK_COLORS = CATEGORY_COLOR;
