import type { EnemyDef } from '../data/enemies';
import type { MetaModifiers } from './stats';

/**
 * 피해 출처. 장갑은 "직접(탭)"이 아닌 피해를 절반만 받는다.
 * 새 증강이 새 피해 종류를 만들면 여기에 추가한다.
 */
export type DamageSource =
  | 'tap'
  | 'chain'
  /** 쌓이는 바닥: 무너지는 블록의 폭발. 블록에게는 즉사 */
  | 'pile'
  /** 실험 규칙에서 생긴 피해 (불·씨앗·불덩이·메아리 등). 연쇄 폭발과 같은 간접 피해 */
  | 'exp'
  | 'fission'
  | 'ember'
  | 'shard'
  | 'lightning'
  | 'mine';

export function isDirect(source: DamageSource): boolean {
  return source === 'tap';
}

export interface Enemy {
  id: number;
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  radius: number;
  speed: number;
  dead: boolean;
  /** 보스 패턴 진행도 (증식체: 지나간 소환 임계 개수) */
  phase: number;
  /** 마지막으로 맞은 sim 시각 (렌더러 피격 깜빡임용) */
  lastHitAt: number;
  isFinalBoss: boolean;
  /** 묶여 움직이는 무리. null 이면 혼자 움직임 (돌격형·분열체·보스·직접 배치) */
  pack: Pack | null;
  /** 불씨 칠하기: 불씨가 붙었나 (죽을 때 폭발형처럼 터짐) */
  spark: boolean;
  /** 쌓이는 바닥: 쌓인 블록이면 칸 번호 (-1 = 아님), 떨어져 내려갈 목표 y */
  pileCol: number;
  pileY: number;
  /** 짝 폭발형: 짝 (없으면 null) 과 짝 색 번호 (-1 = 짝 없음) */
  partner: Enemy | null;
  pairColor: number;
  /** 무리 중심에서의 위치 */
  packOx: number;
  packOy: number;
  /** 이동 방향 (단위 벡터). 기본은 아래 (0, 1), 가운데 지키기에서는 중심 쪽 */
  dx: number;
  dy: number;
  /** 밀어내기·끌어당김으로 받은 속도 (px/s, 점점 줄어듦) */
  kx: number;
  ky: number;
  /** 실험 규칙 상태 (exp.ts). 얼음·불 남은 시간, 색, 부푼 횟수, 화면에 들어온 시각, 황금 */
  frozen: number;
  /** 블랙홀·토네이도·UFO·거품에 붙잡혀 멈춘 시간 (얼림과 달리 받는 피해는 그대로) */
  held: number;
  burn: number;
  color: number;
  inflate: number;
  bornAt: number;
  golden: boolean;
}

/** 무리: 구성원이 가장 느린 구성원 속도에 맞춰 대열을 유지하며 내려온다 (World.moveEnemies) */
export interface Pack {
  id: number;
  x: number;
  y: number;
  speed: number;
  /** 살아 있는 구성원 수 (0 이 되면 정리) */
  members: number;
  /** 이동 방향 (단위 벡터, 기본 아래) */
  dx: number;
  dy: number;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  chainId: number;
  source: DamageSource;
  /** 남은 지연 (초). 0 이하가 되는 스텝에 터진다 */
  delay: number;
  crit: boolean;
  /** 가장자리 피해 배율 (1 = 균일) */
  edgeMul: number;
  /** 연쇄 단계 (0 = 탭·지뢰·번개) */
  depth: number;
  /** 실험 규칙 꼬리표: 모양(가로 띠)·색·밀어내기·얼리기 등 (exp.ts 가 읽음) */
  tag?: ExplosionTag;
}

export interface ExplosionTag {
  /** 가로 베기: 화면 전체 가로 띠 (radius = 띠 반높이) */
  row?: boolean;
  /** 색 맞추기: 이 폭발의 색 */
  color?: number;
  /** 밀어내기: 밀어내는 세기 (px/s) */
  knock?: number;
  /** 얼리고 깨기: 피해 없이 얼린다 */
  freeze?: boolean;
  /** 번지는 불: 맞은 적에 불이 붙는다 */
  ignite?: boolean;
  /** 메아리: 이미 메아리인 폭발 (다시 메아리 안 만듦) */
  echo?: boolean;
}

/**
 * 연쇄 하나 = 탭 한 번(또는 지뢰·번개 한 번)에서 시작된 폭발의 묶음.
 * refs: 아직 안 터진 폭발 + 살아 있는 잔불 지대 수. 0 이 되면 연쇄 종료.
 */
export interface Chain {
  id: number;
  kills: number;
  refs: number;
  /** 이 묶음에서 터진 연쇄 폭발 수. 0 이면 탭(또는 지뢰·번개)이 직접 잡은 것뿐 */
  links: number;
  /** 이 묶음에서 연쇄가 몇 단계까지 갈 수 있나 (0 = 연쇄 없음) */
  maxDepth: number;
  /** 실험 규칙: 탭에서 연쇄 전체로 따라가는 꼬리표 (색·밀어내기) */
  tag?: ExplosionTag;
}

/** 잔불 같은 지속 피해 지대 */
export interface Zone {
  id: number;
  x: number;
  y: number;
  radius: number;
  dps: number;
  ttl: number;
  maxTtl: number;
  tick: number;
  chainId: number;
  source: DamageSource;
  depth: number;
}

/** 유폭 지뢰 */
export interface Mine {
  id: number;
  x: number;
  y: number;
  radius: number;
  damage: number;
  armIn: number;
  ttl: number;
  /** 지뢰 심기 규칙: 터질 때 연쇄 단계 (없으면 기본) */
  depth?: number;
}

/**
 * sim 에 들어가는 입력은 전부 Command 로 통일한다.
 * (스텝 번호, Command) 를 기록하면 그대로 리플레이가 된다.
 */
export type Command =
  | { t: 'press'; x: number; y: number }
  | { t: 'move'; x: number; y: number }
  | { t: 'release'; x: number; y: number }
  | { t: 'choose'; index: number }
  | { t: 'reroll' };

export type RunMode = 'chapter' | 'endless';
export type RunResult = 'victory' | 'defeat' | 'quit';
export type OfferKind = 'level' | 'boss' | 'start' | 'starter';
export type Phase = 'playing' | 'choosing' | 'ended';

/**
 * 실험 규칙 (플레이테스트용, 타이틀에서 켜고 끔). 기본은 전부 꺼짐.
 *   overcharge: 과충전 — 이제 기본 규칙이라 이 값은 무시됨 (옛 세이브 호환용)
 *   combo:      연쇄 잇기 — 처치가 끊기지 않으면 콤보 배율이 쌓인다
 *   brink:      벼랑 끝 — 방어선 가까이서 잡을수록 게이지를 돌려받는다 (봇 시험 탈락, 타이틀엔 안 보임)
 *   paint:      불씨 칠하기 — 과충전 중 누른 채 끌면 닿은 적에 불씨, 불씨 붙은 적은 죽을 때 폭발형처럼 터짐 (과충전 포함)
 *   pairs:      짝 폭발형 — 서로 다른 무리의 폭발형 둘이 짝, 하나가 터지면 짝도 그 자리에서 터짐
 *   pile:       쌓이는 바닥 — 넘어온 적이 바닥에 블록으로 쌓이고(LIFE 없음), 꼭대기까지 차면 끝.
 *               100% 이상으로 쏜 폭발에 블록이 죽으면 붙은 블록이 줄줄이 무너진다
 */
export const RULE_IDS = [
  'overcharge', 'combo', 'brink', 'paint', 'pairs', 'pile',
  // 11-07 실험 묶음 (설명은 data/experiments.ts)
  'freeze', 'burn', 'scorch', 'knockback', 'magnet', 'beat', 'colors', 'core', 'launcher', 'mines',
  'seeds', 'row', 'bouncer', 'ripen', 'sweet', 'stopTime', 'inflate', 'fog', 'echo', 'wind', 'golden',
  // 도파민 모드: 다 쏟아붓기 (data/chaos.ts)
  'chaos',
] as const;
export type RuleId = (typeof RULE_IDS)[number];
export type RunRules = Partial<Record<RuleId, boolean>>;

export interface RunConfig {
  seed: number;
  mode: RunMode;
  chapterId: string;
  /** 영구 강화에서 오는 보정. 일일 도전은 NO_META */
  meta: MetaModifiers;
  daily?: boolean;
  /** false 면 이벤트를 쌓지 않는다 (헤드리스 자동 플레이용, 성능) */
  recordEvents?: boolean;
  /** true 면 웨이브·스폰·보스를 끈다 (테스트·연출 샌드박스용) */
  sandbox?: boolean;
  /** 실험 규칙 */
  rules?: RunRules;
}

export interface Offer {
  kind: OfferKind;
  choices: string[];
}

export interface RunSummary {
  seed: number;
  mode: RunMode;
  daily: boolean;
  chapterId: string;
  result: RunResult;
  wave: number;
  kills: number;
  maxChain: number;
  /** 폭발을 만든 탭 수 (헛탭 제외). 옛 기록에는 없음 */
  taps?: number;
  /** 연쇄 환급 횟수. 옛 기록에는 없음 */
  refunds?: number;
  /** 판 끝 피해 배율. 옛 기록에는 없음 */
  damageMult?: number;
  /** 켠 실험 규칙. 옛 기록에는 없음 */
  rules?: RuleId[];
  /** 과충전 폭주 횟수 */
  overloads?: number;
  /** 판 최고 콤보 (연쇄 잇기) */
  maxCombo?: number;
  /** 벼랑 끝 처치 수 */
  brinkKills?: number;
  /** 불씨 붙은 적이 터진 횟수 */
  sparkBlasts?: number;
  /** 짝 폭발이 일어난 횟수 */
  pairBlasts?: number;
  /** 쌓이는 바닥: 쌓인 블록 수와 무너뜨린 블록 수, 판 최고 더미 높이(칸) */
  pileLanded?: number;
  pileCleared?: number;
  pileMaxRows?: number;
  level: number;
  durationSec: number;
  /** 고른 증강 id (순서대로) */
  picks: string[];
  partsEarned: number;
  /** 연쇄 길이 분포: 1, 2-4, 5-9, 10-19, 20-49, 50+ */
  chainHistogram: number[];
}

export const CHAIN_BUCKETS = [1, 2, 5, 10, 20, 50] as const;
export const CHAIN_BUCKET_LABELS = ['1', '2-4', '5-9', '10-19', '20-49', '50+'] as const;

export function chainBucket(kills: number): number {
  let idx = 0;
  for (let i = 0; i < CHAIN_BUCKETS.length; i++) if (kills >= CHAIN_BUCKETS[i]) idx = i;
  return idx;
}
