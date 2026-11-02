import { describe, expect, it } from 'vitest';
import { AUGMENTS, getAugment } from '../src/data/augments';
import { BALANCE } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import { AugmentManager } from '../src/sim/augments';
import { sandbox, stepFor } from './helpers';
import type { World } from '../src/sim/World';

function grant(w: World, id: string): void {
  w.augments.acquire(id, w);
  // World.recomputeStats 는 private 이라 선택 흐름을 그대로 탄다
  (w as unknown as { recomputeStats(): void }).recomputeStats();
}

describe('증강 선택지', () => {
  it('3개, 중복 없음, 레벨업 보상엔 프리즘 없음', () => {
    const m = new AugmentManager(new Rng(1));
    for (let i = 0; i < 200; i++) {
      const c = m.roll('level');
      expect(c.length).toBe(3);
      expect(new Set(c).size).toBe(3);
      expect(c.some((id) => getAugment(id).rarity === 'prism')).toBe(false);
    }
  });

  it('보스 보상엔 프리즘 1개, 판당 최대 1개', () => {
    const w = sandbox();
    const c = w.augments.roll('boss');
    expect(c.filter((id) => getAugment(id).rarity === 'prism').length).toBe(1);
    w.augments.acquire(c.find((id) => getAugment(id).rarity === 'prism')!, w);
    for (let i = 0; i < 50; i++) {
      expect(w.augments.roll('boss').some((id) => getAugment(id).rarity === 'prism')).toBe(false);
    }
  });

  it('등급 비율은 대략 60:30:10', () => {
    const m = new AugmentManager(new Rng(3));
    const count = { normal: 0, rare: 0, epic: 0, prism: 0 };
    for (let i = 0; i < 3000; i++) count[getAugment(m.roll('level')[0]).rarity]++;
    expect(count.normal / 3000).toBeGreaterThan(0.5);
    expect(count.epic / 3000).toBeLessThan(0.18);
  });

  it('진화: 조건을 갖추면 75% 근처로 등장, 얻으면 재료 하나가 대체됨', () => {
    const w = sandbox();
    expect(w.augments.roll('level')).not.toContain('storm');
    w.augments.acquire('overload', w);
    w.augments.acquire('shrapnel', w);
    let seen = 0;
    for (let i = 0; i < 400; i++) if (w.augments.roll('level').includes('storm')) seen++;
    expect(seen / 400).toBeGreaterThan(0.65);
    expect(seen / 400).toBeLessThan(0.85);
    w.augments.acquire('storm', w);
    expect(w.augments.stacks('overload')).toBe(0);
    expect(w.augments.stacks('shrapnel')).toBe(1);
    expect(w.augments.roll('level')).not.toContain('overload');
  });

  it('최대 중첩까지 가면 더 안 나오고, 다 떨어지면 대체 선택지', () => {
    const w = sandbox();
    for (const def of AUGMENTS) {
      if (def.evolution || def.rarity === 'prism') continue;
      for (let i = 0; i < def.maxStacks; i++) w.augments.acquire(def.id, w);
    }
    // 진화(폭풍)는 조건 충족 → 나올 수 있음. 나머지는 응급 수리로 채움
    const c = w.augments.roll('level');
    expect(c.length).toBe(BALANCE.augment.offerCount);
    expect(c).toContain('repair');
  });
});

describe('증강 효과', () => {
  it('충전 +1: 최대 충전 증가 + 즉시 1칸', () => {
    const w = sandbox();
    w.charges = 1;
    grant(w, 'charge_plus');
    expect(w.stats.maxCharges).toBe(4);
    expect(w.charges).toBe(2);
  });

  it('연쇄 가속: 처치당 배율 +3%p', () => {
    const w = sandbox();
    grant(w, 'chain_accel');
    expect(w.stats.chainMultiplierPerKill).toBeCloseTo(0.08);
  });

  it('핵분열: 연쇄 폭발이 작은 폭발을 낳는다', () => {
    const w = sandbox();
    grant(w, 'fission');
    w.spawnEnemy('normal', 100, 200)!.speed = 0;
    w.step(1 / 60, [{ t: 'press', x: 100, y: 200 }]);
    stepFor(w, BALANCE.chain.delaySec + 0.02);
    expect(w.explosions.filter((e) => e.source === 'fission').length).toBe(2);
  });

  it('초신성: 누르고 떼면 충전을 모두 써서 큰 폭발', () => {
    const w = sandbox();
    grant(w, 'supernova');
    w.step(1 / 60, [{ t: 'press', x: 100, y: 200 }]);
    expect(w.hold).not.toBeNull();
    expect(w.charges).toBe(3);
    stepFor(w, BALANCE.prism.supernova.fullChargeSec);
    w.drainEvents();
    w.step(1 / 60, [{ t: 'release', x: 100, y: 200 }]);
    stepFor(w, 1 / 60);
    const ex = w.drainEvents().find((e) => e.type === 'explosion');
    expect(w.charges).toBe(0);
    expect(ex && ex.type === 'explosion' && ex.source).toBe('supernova');
    expect(ex && ex.type === 'explosion' && ex.radius).toBeGreaterThan(BALANCE.tap.radius * 2);
  });

  it('무한 연쇄: 연쇄 중 탭은 충전을 쓰지 않는다', () => {
    const w = sandbox();
    grant(w, 'infinite_chain');
    w.spawnEnemy('normal', 100, 200)!.speed = 0;
    w.step(1 / 60, [{ t: 'press', x: 100, y: 200 }]);
    expect(w.charges).toBe(2);
    expect(w.explosions.length).toBeGreaterThan(0); // 연쇄 진행 중
    w.step(1 / 60, [{ t: 'press', x: 300, y: 300 }]);
    expect(w.charges).toBe(2);
  });
});
