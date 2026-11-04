import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/meta/storage';
import { SaveManager, defaultSave, migrate } from '../src/meta/save';
import { applyRunResult, buyUpgrade, createDailyRunConfig, metaModifiers, upgradeCost } from '../src/meta/progression';
import type { RunSummary } from '../src/sim/types';

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  seed: 1, mode: 'chapter', daily: false, chapterId: 'ch1', result: 'defeat',
  wave: 7, kills: 120, maxChain: 18, level: 9, durationSec: 130, picks: [], partsEarned: 48,
  chainHistogram: [0, 0, 0, 0, 0, 0], ...over,
});

describe('영구 강화', () => {
  it('부품으로 사고, 최대 레벨에서 멈춘다', () => {
    const s = defaultSave();
    s.parts = 10_000;
    const cost = upgradeCost(s, 'durability')!;
    expect(buyUpgrade(s, 'durability')).toBe(true);
    expect(s.parts).toBe(10_000 - cost);
    buyUpgrade(s, 'durability');
    buyUpgrade(s, 'durability');
    expect(buyUpgrade(s, 'durability')).toBe(false);
    expect(metaModifiers(s).bonusLife).toBe(3);
  });

  it('부품이 모자라면 못 산다', () => {
    const s = defaultSave();
    expect(buyUpgrade(s, 'firepower')).toBe(false);
  });

  it('화력은 탭 피해 배율로', () => {
    const s = defaultSave();
    s.upgrades.firepower = 2;
    expect(metaModifiers(s).tapDamageMul).toBeCloseTo(1.16);
  });
});

describe('판 종료 정산', () => {
  it('부품 지급 + 기록 갱신', () => {
    const s = defaultSave();
    applyRunResult(s, summary());
    applyRunResult(s, summary({ wave: 15, result: 'victory', maxChain: 40 }));
    expect(s.parts).toBe(96);
    expect(s.records.runs).toBe(2);
    expect(s.records.bestWave).toBe(15);
    expect(s.records.bestChain).toBe(40);
    expect(s.records.chapterClears.ch1).toBe(1);
    expect(s.history.length).toBe(2);
  });

  it('일일 도전은 영구 강화를 쓰지 않는다', () => {
    const c = createDailyRunConfig(new Date('2026-11-02T00:00:00Z'));
    expect(c.daily).toBe(true);
    expect(c.meta.tapDamageMul).toBe(1);
    expect(c.meta.headStartPicks).toBe(0);
  });
});

describe('세이브', () => {
  it('저장 → 불러오기', () => {
    const store = new MemoryStore();
    const a = new SaveManager(store);
    a.data.parts = 77;
    a.persist();
    expect(new SaveManager(store).data.parts).toBe(77);
  });

  it('배속: 옛 세이브엔 없으면 ×1, 모르는 값도 ×1', () => {
    expect(migrate({ settings: { sound: true, haptics: true } }).settings.speed).toBe(1);
    expect(migrate({ settings: { speed: 7 } }).settings.speed).toBe(1);
    expect(migrate({ settings: { speed: 2 } }).settings.speed).toBe(2);
  });

  it('깨진 세이브는 기본값으로', () => {
    expect(migrate(null)).toEqual(defaultSave());
    expect(migrate({ parts: -5, settings: { sound: false } }).parts).toBe(0);
    expect(migrate({ parts: 3, settings: { sound: false } }).settings).toEqual({ sound: false, haptics: true, speed: 1 });
    const store = new MemoryStore();
    store.set('explosion-g/save', '{not json');
    expect(new SaveManager(store).data).toEqual(defaultSave());
  });
});
