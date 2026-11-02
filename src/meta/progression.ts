import { UPGRADES, getUpgrade, type UpgradeId } from '../data/upgrades';
import { dailySeed } from '../core/rng';
import { NO_META, type MetaModifiers } from '../sim/stats';
import type { RunConfig, RunMode, RunSummary } from '../sim/types';
import { HISTORY_LIMIT, type SaveData } from './save';

export function upgradeLevel(save: SaveData, id: UpgradeId): number {
  return save.upgrades[id] ?? 0;
}

export function upgradeCost(save: SaveData, id: UpgradeId): number | null {
  const def = getUpgrade(id);
  const lvl = upgradeLevel(save, id);
  return lvl >= def.maxLevel ? null : def.cost(lvl);
}

export function canBuy(save: SaveData, id: UpgradeId): boolean {
  const cost = upgradeCost(save, id);
  return cost !== null && save.parts >= cost;
}

export function buyUpgrade(save: SaveData, id: UpgradeId): boolean {
  const cost = upgradeCost(save, id);
  if (cost === null || save.parts < cost) return false;
  save.parts -= cost;
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return true;
}

export function metaModifiers(save: SaveData): MetaModifiers {
  const m: MetaModifiers = { ...NO_META };
  for (const def of UPGRADES) {
    const lvl = upgradeLevel(save, def.id);
    if (lvl > 0) def.apply(m, lvl);
  }
  return m;
}

export function createRunConfig(save: SaveData, mode: RunMode, seed: number, chapterId = 'ch1'): RunConfig {
  return { seed, mode, chapterId, meta: metaModifiers(save) };
}

/** 일일 도전: 모두 같은 시드·같은 증강 풀, 영구 강화 미적용 (기획서 리텐션 장치) */
export function createDailyRunConfig(date: Date, chapterId = 'ch1'): RunConfig {
  return { seed: dailySeed(date), mode: 'chapter', chapterId, meta: { ...NO_META }, daily: true };
}

/** 판 종료 정산. 부품 지급 + 기록 갱신 + 히스토리 */
export function applyRunResult(save: SaveData, summary: RunSummary, date = new Date()): void {
  save.parts += summary.partsEarned;
  const r = save.records;
  r.runs++;
  r.bestWave = Math.max(r.bestWave, summary.wave);
  r.bestChain = Math.max(r.bestChain, summary.maxChain);
  if (summary.result === 'victory') r.chapterClears[summary.chapterId] = (r.chapterClears[summary.chapterId] ?? 0) + 1;
  if (summary.daily) {
    const key = date.toISOString().slice(0, 10);
    r.dailyBest[key] = Math.max(r.dailyBest[key] ?? 0, summary.kills);
  }
  save.history.push(summary);
  if (save.history.length > HISTORY_LIMIT) save.history.splice(0, save.history.length - HISTORY_LIMIT);
}
