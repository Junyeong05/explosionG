import { BOSSES } from './bosses';
import { ENEMIES, type EnemyDef } from './enemies';

const ALL_ENEMIES = new Map<string, EnemyDef>([...Object.values(ENEMIES), ...Object.values(BOSSES)].map((d) => [d.id, d]));

/** 일반 적·보스 공통 조회 */
export function getEnemyDef(id: string): EnemyDef {
  const def = ALL_ENEMIES.get(id);
  if (!def) throw new Error(`알 수 없는 적: ${id}`);
  return def;
}
