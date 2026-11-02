import type { UpgradeId } from '../data/upgrades';
import type { RunSummary } from '../sim/types';
import type { KeyValueStore } from './storage';

export const SAVE_KEY = 'explosion-g/save';
export const SAVE_VERSION = 1;
const HISTORY_LIMIT = 50;

/**
 * 아웃게임 세이브.
 * 재화 3종(기획서 아웃게임 탭) 중 지금은 부품만. 기폭 장치·유료 재화는 필드 추가 + 버전 올리고 migrate 에서 처리.
 */
export interface SaveData {
  version: number;
  parts: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  records: {
    runs: number;
    bestWave: number;
    bestChain: number;
    chapterClears: Record<string, number>;
    dailyBest: Record<string, number>;
  };
  settings: { sound: boolean; haptics: boolean };
  /** 최근 판 기록 (플레이테스트 지표 추출용). 오래된 것부터 버림 */
  history: RunSummary[];
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    parts: 0,
    upgrades: {},
    records: { runs: 0, bestWave: 0, bestChain: 0, chapterClears: {}, dailyBest: {} },
    settings: { sound: true, haptics: true },
    history: [],
  };
}

/** 깨졌거나 옛 버전인 세이브를 현재 형식으로. 모르는 값은 기본값으로 */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    version: SAVE_VERSION,
    parts: typeof r.parts === 'number' && Number.isFinite(r.parts) ? Math.max(0, Math.floor(r.parts)) : 0,
    upgrades: typeof r.upgrades === 'object' && r.upgrades ? { ...r.upgrades } : {},
    records: { ...base.records, ...(r.records ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
    history: Array.isArray(r.history) ? r.history.slice(-HISTORY_LIMIT) : [],
  };
}

export class SaveManager {
  data: SaveData;

  constructor(private readonly store: KeyValueStore) {
    this.data = this.load();
  }

  load(): SaveData {
    const text = this.store.get(SAVE_KEY);
    if (!text) return defaultSave();
    try {
      return migrate(JSON.parse(text));
    } catch {
      return defaultSave();
    }
  }

  persist(): void {
    this.store.set(SAVE_KEY, JSON.stringify(this.data));
  }

  /** 플레이테스트용: 최근 판 기록을 JSON 으로 */
  exportHistory(): string {
    return JSON.stringify(this.data.history, null, 2);
  }
}

export { HISTORY_LIMIT };
