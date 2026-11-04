import { describe, expect, it } from 'vitest';
import { Rng, dailySeed, deriveSeed, hashString } from '../src/core/rng';
import { SpatialGrid } from '../src/core/spatial';
import { BALANCE, enemyHp, packInterval, packSize, runReward } from '../src/data/balance';

describe('Rng', () => {
  it('같은 시드면 같은 수열', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('다른 시드면 다른 수열', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('weighted 는 가중치 비율을 따른다', () => {
    const rng = new Rng(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10000; i++) counts[rng.weighted(['a', 'b'] as const, (k) => (k === 'a' ? 3 : 1))!]++;
    expect(counts.a / 10000).toBeGreaterThan(0.72);
    expect(counts.a / 10000).toBeLessThan(0.78);
  });

  it('스트림 시드와 일일 시드는 안정적', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(deriveSeed(1, 'spawn')).not.toBe(deriveSeed(1, 'combat'));
    expect(dailySeed(new Date('2026-11-02T03:00:00Z'))).toBe(dailySeed(new Date('2026-11-02T20:00:00Z')));
    expect(dailySeed(new Date('2026-11-02T00:00:00Z'))).not.toBe(dailySeed(new Date('2026-11-03T00:00:00Z')));
  });
});

describe('SpatialGrid', () => {
  it('bbox 안의 항목을 찾는다 (음수 좌표 포함)', () => {
    const g = new SpatialGrid<{ x: number; y: number; id: number }>(64);
    g.insert({ x: 10, y: -15, id: 1 });
    g.insert({ x: 300, y: 500, id: 2 });
    const out = g.queryBox(0, 0, 30, []);
    expect(out.map((o) => o.id)).toEqual([1]);
  });
});

describe('기획서 공식', () => {
  it('웨이브 10 적 체력은 시작의 약 3.8배', () => {
    expect(enemyHp(10) / enemyHp(1)).toBeCloseTo(3.8, 1);
    expect(enemyHp(1)).toBe(BALANCE.wave.hpBase);
  });

  it('무리 간격은 하한, 무리 크기는 상한을 넘지 않고 웨이브가 오를수록 빡빡해진다', () => {
    const W = BALANCE.wave;
    expect(packInterval(1)).toBeCloseTo(W.packIntervalBase - W.packIntervalPerWave);
    expect(packInterval(10)).toBeLessThan(packInterval(1));
    expect(packInterval(99)).toBe(W.packIntervalMin);
    expect(packSize(10)).toBeGreaterThan(packSize(1));
    expect(packSize(99)).toBe(W.packSizeMax);
  });

  it('판 종료 부품 = 웨이브×4 + 처치/6', () => {
    expect(runReward(10, 60)).toBe(50);
    expect(runReward(3, 17)).toBe(14);
  });
});
