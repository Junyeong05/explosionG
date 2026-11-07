import type { BossId } from './bosses';
import type { EnemyKind } from './enemies';

/**
 * 챕터 = 웨이브 N개 + 최종 보스 (기획서 제안: 15웨이브 + 최종 보스로 5~8분).
 *
 * 적 종류는 챕터가 올라가면서 하나씩 늘린다 (플레이 피드백: 초반에 종류가 너무 많다).
 *   챕터 1: 일반·폭발형 → 끝에 돌격형  /  챕터 2: +장갑  /  챕터 3: +보호막  /  챕터 4: +분열
 * 앞 챕터를 한 번 깨면 다음 챕터가 열린다 (meta/progression.isChapterUnlocked).
 */
export interface RosterEntry {
  kind: EnemyKind;
  /** 이 웨이브부터 무리에 섞인다 */
  fromWave: number;
  /** 무리 안 가중치. 없으면 적 정의의 spawnWeight */
  weight?: number;
}

export interface ChapterDef {
  id: string;
  name: string;
  /** 이 웨이브가 끝나면 최종 보스 등장 */
  waves: number;
  miniBoss: BossId;
  /** ⚠ 중간 보스 주기 (프로토 v2: 40초) */
  miniBossIntervalSec: number;
  finalBoss: BossId;
  finalBossHpMul: number;
  /** ⚠ 이 챕터 적 체력 배율 (웨이브 곡선 위에 곱함) */
  hpMul: number;
  roster: readonly RosterEntry[];
  /** TODO: 강풍(좌우 흔들림)·안개(시야 제한) 같은 규칙은 rule 필드 + 시스템으로 추가 */
}

/** 고를 수 있는 챕터 (순서 = 해금 순서) */
export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'ch1',
    name: '챕터 1',
    waves: 15,
    miniBoss: 'proliferator',
    miniBossIntervalSec: 60,
    finalBoss: 'proliferator',
    finalBossHpMul: 2,
    hpMul: 1,
    roster: [
      { kind: 'normal', fromWave: 1 },
      { kind: 'explosive', fromWave: 3 },
      { kind: 'rusher', fromWave: 10, weight: 2 },
    ],
  },
  {
    id: 'ch2',
    name: '챕터 2',
    waves: 15,
    miniBoss: 'proliferator',
    miniBossIntervalSec: 55,
    finalBoss: 'proliferator',
    finalBossHpMul: 2,
    hpMul: 1,
    roster: [
      { kind: 'normal', fromWave: 1 },
      { kind: 'explosive', fromWave: 1 },
      { kind: 'rusher', fromWave: 3 },
      { kind: 'armored', fromWave: 6 },
    ],
  },
  {
    id: 'ch3',
    name: '챕터 3',
    waves: 15,
    miniBoss: 'proliferator',
    miniBossIntervalSec: 50,
    finalBoss: 'proliferator',
    finalBossHpMul: 2.2,
    hpMul: 1.3,
    roster: [
      { kind: 'normal', fromWave: 1 },
      { kind: 'explosive', fromWave: 1 },
      { kind: 'rusher', fromWave: 1 },
      { kind: 'armored', fromWave: 3 },
      { kind: 'shielded', fromWave: 6 },
    ],
  },
  {
    id: 'ch4',
    name: '챕터 4',
    waves: 15,
    miniBoss: 'proliferator',
    miniBossIntervalSec: 50,
    finalBoss: 'proliferator',
    finalBossHpMul: 2.5,
    hpMul: 1.55,
    roster: [
      { kind: 'normal', fromWave: 1 },
      { kind: 'explosive', fromWave: 1 },
      { kind: 'rusher', fromWave: 1 },
      { kind: 'armored', fromWave: 1 },
      { kind: 'shielded', fromWave: 3 },
      { kind: 'splitter', fromWave: 6 },
    ],
  },
];

/** 엔드리스: 최종 보스 없이 웨이브가 계속 오르고, 적 종류가 웨이브마다 하나씩 늘어난다 */
export const ENDLESS: ChapterDef = {
  id: 'endless',
  name: '엔드리스',
  waves: Number.POSITIVE_INFINITY,
  miniBoss: 'proliferator',
  miniBossIntervalSec: 40,
  finalBoss: 'proliferator',
  finalBossHpMul: 1,
  hpMul: 1,
  roster: [
    { kind: 'normal', fromWave: 1 },
    { kind: 'explosive', fromWave: 3 },
    { kind: 'rusher', fromWave: 6 },
    { kind: 'armored', fromWave: 9 },
    { kind: 'shielded', fromWave: 12 },
    { kind: 'splitter', fromWave: 15 },
  ],
};

export function getChapter(id: string): ChapterDef {
  const ch = id === ENDLESS.id ? ENDLESS : CHAPTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`알 수 없는 챕터: ${id}`);
  return ch;
}

/** 이 챕터에서 처음 나오는 적 (앞 챕터에 없던 것). 챕터 선택 화면 안내용 */
export function newEnemiesIn(id: string): EnemyKind[] {
  const i = CHAPTERS.findIndex((c) => c.id === id);
  if (i < 0) return [];
  const before = new Set(i > 0 ? CHAPTERS[i - 1].roster.map((r) => r.kind) : []);
  return CHAPTERS[i].roster.map((r) => r.kind).filter((k) => !before.has(k));
}
