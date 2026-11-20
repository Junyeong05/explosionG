/**
 * 합성 문 샘플 (11-20 유저: "제안 준 거 샘플로 다양하게 뽑아 봐, 플레이해 보고 코멘트 줄게").
 * 회의(docs/design/fusion-gate-meeting.md)에서 나온 "합성의 문을 무엇이 여나" 안들을 도파민 모드에서 골라 해 볼 수 있게.
 * 타이틀에서 고르고 (세이브 settings.fuseRule), 🔥 도파민 모드 판에 걸린다. 🧪 합성 시험판은 늘 합성 카드 둘 (그대로).
 */
export type FuseRule = 'now' | 'width' | 'count' | 'bowl' | 'breath';

export interface FuseRuleInfo {
  id: FuseRule;
  /** 타이틀 버튼 */
  name: string;
  /** 한 줄 설명 (타이틀) */
  desc: string;
}

export const FUSE_RULES: readonly FuseRuleInfo[] = [
  { id: 'width', name: '폭=칸·레벨=등급', desc: '갈래 4·7·10·13종마다 합성 칸 1 (최대 4) · 재료 중 낮은 레벨이 반응 세기 (합친 직후 약 1.5배, 재료를 키울수록 2.4배까지) · 칸이 있으면 합성 카드 확정' },
  { id: 'count', name: '무기 수=칸', desc: '공격 무기 4·8·12·16종마다 합성 칸 1 (최대 4) · 등급은 추천안과 같음 · 칸이 있으면 합성 카드 확정' },
  { id: 'bowl', name: '표와 그릇', desc: '공격 무기 5·9·13…종마다 합성 표 1 · 몸이 될 무기 레벨 + 2 = 그 몸에 담을 레벨 합 (무기 셋까지) · 반응 세기는 재료 중 낮은 레벨' },
  { id: 'breath', name: '호흡', desc: '두 무기가 같은 적을 이어 칠 때마다 그 짝의 호흡이 참 (상태를 노리는 짝은 두 배) · 다 차면 그 짝 합성 카드 확정 · 반응 세기는 재료 중 낮은 레벨' },
  { id: 'now', name: '지금 규칙', desc: '2레벨 넘은 다른 갈래 둘 · 레벨 업마다 35% · 고른 뒤 두 번 쉼 (비교용)' },
];

export const FUSE_RULE_IDS: readonly FuseRule[] = FUSE_RULES.map((r) => r.id);

/**
 * 등급 (몸 안 재료 레벨 중 가장 낮은 것) → B 반응 세기 배율. 샘플 넷 모두.
 * 11-20 유저 "강해지는 정도가 너무 커서 성장하는 맛이 약하다": 처음 표(0.8·1.0·1.4·2.1)는 합성 한 장이 두 무기를 따로 가진 것의
 * 2.6배(2레벨)~3.5배(5레벨). 지금 표: 2레벨 ×1.6 → 3레벨 ×2.0 → 4레벨 ×2.1 → 5레벨 ×2.4 (tools/carry/grade.ts, 210짝 중 70, 적 체력 레벨에 맞춤)
 */
export const GRADE_MUL: Record<number, number> = { 1: 0.28, 2: 0.28, 3: 0.38, 4: 0.52, 5: 0.72 };

export const GATE = {
  /** 폭=칸: 가진 공격 무기의 갈래 수 문턱 */
  widthTh: [4, 7, 10, 13],
  /** 무기 수=칸: 가진 공격 무기 수 문턱 */
  countTh: [4, 8, 12, 16],
  /** 재료 자격 (두 무기 다) */
  need: 2,
  /** 한 몸에 무기 둘. 반응 도감 bodyCodex 개를 보면 셋 */
  body: 2,
  bodyCodex: 12,
  /** 표와 그릇: 첫 표 무기 수, 그 뒤 간격, 용량 = A 레벨 + capBase, 몸에 무기 셋까지 */
  bowlFirst: 5,
  bowlStep: 4,
  capBase: 2,
  bowlBody: 3,
  /** 호흡: 앞 무기가 친 적을 이만큼 안에 다음 무기가 치면 그 짝 +1 (상태를 노리는 짝 +2), 짝마다 최소 간격, 문턱 (판의 첫·둘째·셋째 합성) */
  breathWin: 1.5,
  breathGap: 0.5,
  breathReact: 2,
  breathTh: [60, 120, 180],
  /** 호흡: 처음 보는 반응이 나올 짝은 더 빨리 참 */
  breathFresh: 1.5,
  /**
   * 새 규칙들의 후반 체력: 합친 몸 하나마다 (10웨이브부터) 웨이브당.
   * 11-20 합성 세기를 완만하게 한 뒤 봇 12판(폭=칸): 0 → 23.0 웨이브·6.8분, 0.1 → 21.5, 0.2 → 21.4 → 0 (합성이 더는 튀지 않아 따로 세금을 안 붙임)
   */
  taxPerBody: 0,
} as const;

/** 새 규칙(지금 규칙 말고)인가 */
export const gated = (r: FuseRule | undefined): boolean => !!r && r !== 'now';
