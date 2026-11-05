import { describe, expect, it } from 'vitest';
import { AUGMENTS, getAugment } from '../src/data/augments';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { Rng } from '../src/core/rng';
import { AugmentManager } from '../src/sim/augments';
import { grant, sandbox, stepFor, tap } from './helpers';

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
  it('잔여 장약: 탭한 뒤 게이지 15% 남음', () => {
    const w = sandbox();
    grant(w, 'leftover');
    tap(w, 100, 200);
    // 탭한 스텝에도 게이지가 한 스텝만큼 찬다
    expect(w.gauge).toBeCloseTo(0.15 + FIXED_DT / BALANCE.tap.gauge.fillSec);
  });

  it('과열 코어: 피해 배율 ×1.15 가 중첩마다 곱해지고, 모든 피해 기준(D)에 반영된다', () => {
    const w = sandbox();
    const d0 = w.stats.tapDamage;
    grant(w, 'overheat_core');
    grant(w, 'overheat_core');
    expect(w.stats.damageMult).toBeCloseTo(1.15 * 1.15);
    expect(w.stats.tapDamage).toBeCloseTo(d0 * 1.15 * 1.15);
  });

  it('연쇄 공명: 한 연쇄에서 10마리마다 판 배율 ×1.03', () => {
    const w = sandbox();
    grant(w, 'resonance');
    grant(w, 'chain_reaction');
    w.stats.chainDepthBonus = 10; // 공명만 보려고 단계 제한은 넉넉히
    for (let i = 0; i < 10; i++) w.spawnEnemy('normal', 20 + i * 30, 200)!.hp = 1;
    for (const e of w.enemies) e.speed = 0;
    tap(w, 20, 200);
    stepFor(w, 1);
    expect(w.kills).toBe(10);
    expect(w.runMult).toBeCloseTo(1.03);
    expect(w.stats.damageMult).toBeCloseTo(1.03);
  });

  it('연쇄 가속: 처치당 배율 +3%p', () => {
    const w = sandbox();
    grant(w, 'chain_accel');
    expect(w.stats.chainMultiplierPerKill).toBeCloseTo(0.08);
  });

  it('핵분열: 연쇄 폭발이 작은 폭발을 낳는다', () => {
    const w = sandbox();
    grant(w, 'fission');
    w.spawnEnemy('explosive', 100, 200)!.speed = 0;
    w.step(1 / 60, [{ t: 'press', x: 100, y: 200 }]);
    stepFor(w, BALANCE.chain.delaySec + 0.02);
    expect(w.explosions.filter((e) => e.source === 'fission').length).toBe(2);
  });

  it('초신성: 게이지가 100%를 넘어 250%까지 (절반 속도로) 차고, 그만큼 크게 터진다', () => {
    const w = sandbox();
    grant(w, 'supernova');
    expect(w.gauge).toBe(1);
    const S = BALANCE.prism.supernova;
    stepFor(w, ((S.gaugeMax - 1) * BALANCE.tap.gauge.fillSec) / S.overfillRate + 0.05);
    expect(w.gauge).toBe(S.gaugeMax);
    w.drainEvents();
    tap(w, 100, 200);
    const ex = w.drainEvents().find((e) => e.type === 'explosion');
    expect(ex && ex.type === 'explosion' && ex.radius).toBeGreaterThan(w.tapRadiusAt(1) * 1.5);
  });

  it('무한 연쇄: 연쇄 중 탭은 게이지를 쓰지 않고 절반 크기로 터진다', () => {
    const w = sandbox();
    grant(w, 'infinite_chain');
    w.spawnEnemy('explosive', 100, 200)!.speed = 0;
    w.step(1 / 60, [{ t: 'press', x: 100, y: 200 }]);
    const after = w.gauge;
    expect(after).toBeLessThan(0.1);
    expect(w.explosions.length).toBeGreaterThan(0); // 폭발형이 터지는 중
    w.drainEvents();
    w.step(1 / 60, [{ t: 'press', x: 300, y: 300 }]);
    const t = w.drainEvents().find((e) => e.type === 'tap');
    expect(t && t.type === 'tap' && t.free).toBe(true);
    expect(t && t.type === 'tap' && t.power).toBe(BALANCE.prism.infiniteChain.freeTapPower);
    expect(w.gauge).toBeGreaterThan(after);
  });
});
