import type { BossId } from './bosses';
import type { EnemyKind } from './enemies';

/**
 * 챕터 = 웨이브 N개 + 최종 보스 (기획서 제안: 15웨이브 + 최종 보스로 5~8분).
 * 엔드리스 모드에서는 같은 챕터 데이터를 쓰되 최종 보스 없이 웨이브가 계속 오른다.
 */
export interface ChapterDef {
  id: string;
  name: string;
  /** 이 웨이브가 끝나면 최종 보스 등장 */
  waves: number;
  miniBoss: BossId;
  /** 프로토 v2: 40초마다 보스 */
  miniBossIntervalSec: number;
  finalBoss: BossId;
  finalBossHpMul: number;
  /** 챕터 규칙: 적 종류별 등장 가중치 보정 (예: 폭발형만 나오는 챕터) */
  enemyWeightMul?: Partial<Record<EnemyKind, number>>;
  /** TODO: 강풍(좌우 흔들림)·안개(시야 제한) 같은 규칙은 rule 필드 + 시스템으로 추가 */
}

export const CHAPTERS: readonly ChapterDef[] = [
  {
    id: 'ch1',
    name: '챕터 1',
    waves: 15,
    miniBoss: 'proliferator',
    miniBossIntervalSec: 40,
    finalBoss: 'proliferator',
    finalBossHpMul: 2,
  },
];

export function getChapter(id: string): ChapterDef {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`알 수 없는 챕터: ${id}`);
  return ch;
}
