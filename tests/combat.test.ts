import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { freeze, grant, sandbox, stepFor, tap } from './helpers';

describe('모으는 탭', () => {
  it('탭은 게이지를 전부 쓰고, 최소량 아래면 헛탭', () => {
    const w = sandbox();
    expect(w.gauge).toBe(1);
    tap(w, 100, 100);
    expect(w.gauge).toBeLessThan(BALANCE.tap.gauge.minFire);
    w.drainEvents();
    tap(w, 100, 100);
    expect(w.drainEvents().some((e) => e.type === 'dryTap')).toBe(true);
  });

  it('게이지는 fillSec 동안 0 → 100%, 다 차면 gaugeFull', () => {
    const w = sandbox();
    tap(w, 100, 100);
    stepFor(w, BALANCE.tap.gauge.fillSec - 0.05);
    expect(w.gauge).toBeLessThan(1);
    w.drainEvents();
    stepFor(w, 0.1);
    expect(w.gauge).toBe(1);
    expect(w.drainEvents().some((e) => e.type === 'gaugeFull')).toBe(true);
  });

  it('많이 모을수록 크게 터진다 (반경·피해 모두)', () => {
    const w = sandbox();
    expect(w.tapRadiusAt(1)).toBeGreaterThan(w.tapRadiusAt(0.3) * 1.5);
    expect(w.tapDamageAt(1)).toBeGreaterThan(w.tapDamageAt(0.3) * 1.5);
    w.gauge = 0.3;
    tap(w, 100, 100);
    const ex = w.drainEvents().find((e) => e.type === 'explosion');
    expect(ex && ex.type === 'explosion' && ex.radius).toBeCloseTo(w.tapRadiusAt(0.3));
  });
});

describe('연쇄', () => {
  /**
   * 게이지 30% 탭(반경 약 44)으로 왼쪽 적만 맞히고, 오른쪽 적은 40px 옆에 둔다.
   * 오른쪽 적이 죽으면 왼쪽 적이 터져서(연쇄) 잡은 것. 체력은 1 로 둬서 거리만 본다.
   */
  function pair(left: string, augment?: string) {
    const w = sandbox();
    if (augment) grant(w, augment);
    const near = w.spawnEnemy(left, 100, 200)!;
    const far = w.spawnEnemy('normal', 140, 200)!;
    near.hp = far.hp = 1;
    freeze(w);
    w.gauge = 0.3;
    tap(w, 60, 200);
    stepFor(w, 0.5);
    return { w, far };
  }

  it('일반 적은 기본으로 터지지 않는다', () => {
    const { w, far } = pair('normal');
    expect(w.kills).toBe(1);
    expect(far.dead).toBe(false);
  });

  it('폭발형은 죽으면서 터져 옆 적을 잡는다', () => {
    const { w, far } = pair('explosive');
    expect(far.dead).toBe(true);
    expect(w.maxChain).toBe(2);
  });

  it('연쇄 반응 증강이 있으면 일반 적도 터진다', () => {
    const { far } = pair('normal', 'chain_reaction');
    expect(far.dead).toBe(true);
  });

  it('폭발형 연쇄 피해 = 넘친 피해 + 자기 폭약 × 연쇄 배율(처치당 +5%)', () => {
    const w = sandbox();
    const e = w.spawnEnemy('explosive', 100, 200)!;
    freeze(w);
    tap(w, 100, 200); // 정중앙 → 감쇠 없음
    const overflow = w.tapDamageAt(1) - e.maxHp;
    const ex = w.explosions[0];
    expect(ex.source).toBe('chain');
    expect(ex.damage).toBeCloseTo(overflow + ENEMIES.explosive.deathBlast!.charge * BALANCE.tap.damage * 1.05);
  });

  it('이월: 체력을 넘긴 피해만 다음 적으로 넘어가서 연쇄가 약해지다 끊긴다', () => {
    const w = sandbox();
    grant(w, 'chain_reaction');
    // 30px 간격 한 줄: 연쇄 폭발(반경 46)은 바로 옆 적에게만 닿는다
    const line = [0, 1, 2, 3, 4].map((i) => w.spawnEnemy('normal', 100 + i * 30, 200)!);
    for (const e of line) e.hp = e.maxHp = 10;
    freeze(w);
    // 첫 적에게 35 → 넘친 25 → 다음 적 15 → 그다음 5 → 넷째 적은 5만 맞고 산다
    w.spawnExplosion({ x: 100, y: 200, radius: 5, damage: 35, chainId: w.newChain(), source: 'chain' });
    stepFor(w, 1);
    expect(line.slice(0, 3).every((e) => e.dead)).toBe(true);
    expect(line[3].dead).toBe(false);
    expect(line[3].hp).toBeCloseTo(5);
    expect(line[4].hp).toBe(10);
  });

  it('넘친 피해가 거의 없으면 일반 적의 연쇄는 바로 끊긴다', () => {
    const w = sandbox();
    grant(w, 'chain_reaction');
    const e = w.spawnEnemy('normal', 100, 200)!;
    e.hp = e.maxHp = 10;
    freeze(w);
    w.spawnExplosion({ x: 100, y: 200, radius: 5, damage: 10.5, chainId: w.newChain(), source: 'chain' });
    w.step(1 / 60);
    expect(e.dead).toBe(true);
    expect(w.explosions.length).toBe(0);
  });

  it('연쇄가 끝나면 chainEnd 이벤트', () => {
    const w = sandbox();
    w.spawnEnemy('normal', 100, 200);
    freeze(w);
    tap(w, 100, 200);
    const events = [];
    for (let i = 0; i < 30; i++) {
      stepFor(w, 1 / 60);
      events.push(...w.drainEvents());
    }
    const end = events.find((e) => e.type === 'chainEnd');
    expect(end).toMatchObject({ type: 'chainEnd', kills: 1 });
  });
});

describe('탭 폭발 가장자리 감쇠', () => {
  it('중심은 100%, 가장자리로 갈수록 edgeDamageMul 까지 줄어든다', () => {
    const w = sandbox();
    const r = w.tapRadiusAt(1);
    const center = w.spawnEnemy('normal', 180, 300)!;
    const edge = w.spawnEnemy('normal', 180 + r + 11, 300)!; // 적 반지름 11 → 딱 가장자리
    center.hp = center.maxHp = edge.hp = edge.maxHp = 1000;
    freeze(w);
    tap(w, 180, 300);
    const full = w.tapDamageAt(1);
    expect(1000 - center.hp).toBeCloseTo(full);
    expect(1000 - edge.hp).toBeCloseTo(full * BALANCE.tap.edgeDamageMul);
  });

  it('연쇄 폭발은 감쇠 없이 반경 안 어디서나 같은 피해', () => {
    const w = sandbox();
    const a = w.spawnEnemy('normal', 100, 200)!;
    const b = w.spawnEnemy('normal', 140, 200)!;
    a.hp = a.maxHp = b.hp = b.maxHp = 1000;
    freeze(w);
    w.spawnExplosion({ x: 100, y: 200, radius: 46, damage: 10, chainId: w.newChain(), source: 'chain' });
    stepFor(w, 1 / 60);
    expect(1000 - a.hp).toBeCloseTo(10);
    expect(1000 - b.hp).toBeCloseTo(10);
  });
});

describe('적 종류', () => {
  it('장갑: 연쇄 피해는 절반, 탭은 그대로', () => {
    const w = sandbox();
    const a = w.spawnEnemy('armored', 100, 200)!;
    const b = w.spawnEnemy('armored', 300, 200)!;
    a.hp = b.hp = 1000;
    freeze(w);
    w.spawnExplosion({ x: 100, y: 200, radius: 10, damage: 10, chainId: w.newChain(), source: 'chain' });
    w.spawnExplosion({ x: 300, y: 200, radius: 10, damage: 10, chainId: w.newChain(), source: 'tap' });
    stepFor(w, 1 / 60);
    expect(1000 - a.hp).toBeCloseTo(5);
    expect(1000 - b.hp).toBeCloseTo(10);
  });

  it('보호막: 첫 폭발을 막는다', () => {
    const w = sandbox();
    const e = w.spawnEnemy('shielded', 100, 200)!;
    freeze(w);
    tap(w, 100, 200);
    expect(e.dead).toBe(false);
    expect(e.shield).toBe(0);
    expect(e.hp).toBe(e.maxHp);
    w.gauge = 1;
    tap(w, 100, 200);
    expect(e.dead).toBe(true);
  });

  it('폭발형: 죽을 때 연쇄 반경 1.8배', () => {
    const w = sandbox();
    w.spawnEnemy('explosive', 100, 200);
    const far = w.spawnEnemy('normal', 100 + 75, 200)!; // 46+11 < 75 < 82.8+11
    freeze(w);
    tap(w, 70, 200);
    stepFor(w, 0.3);
    expect(far.dead).toBe(true);
  });

  it('연쇄 반응이 있어도 일반 적의 연쇄는 같은 거리에 닿지 않는다 (대조군)', () => {
    const w = sandbox();
    grant(w, 'chain_reaction');
    w.spawnEnemy('normal', 100, 200);
    const far = w.spawnEnemy('normal', 100 + 75, 200)!;
    freeze(w);
    tap(w, 70, 200);
    stepFor(w, 0.3);
    expect(far.dead).toBe(false);
  });

  it('분열: 죽으면 3마리. 연쇄가 없으면 살아남는다', () => {
    const w = sandbox();
    w.spawnEnemy('splitter', 100, 200);
    freeze(w);
    tap(w, 100, 200);
    for (const e of w.enemies) e.speed = 0;
    stepFor(w, 0.5);
    expect(w.kills).toBe(1);
    expect(w.enemies.filter((e) => e.def.id === 'splitling').length).toBe(3);
  });

  it('분열: 연쇄 반응이 있으면 분열체까지 자기 폭발에 물린다', () => {
    const w = sandbox();
    grant(w, 'chain_reaction');
    w.spawnEnemy('splitter', 100, 200);
    freeze(w);
    tap(w, 100, 200);
    expect(w.enemies.filter((e) => e.def.id === 'splitling').length).toBe(3);
    for (const e of w.enemies) e.speed = 0;
    stepFor(w, 0.5);
    expect(w.kills).toBe(4);
  });

  it('방어선을 넘으면 LIFE 감소, 0 이면 패배', () => {
    const w = sandbox();
    expect(w.life).toBe(5);
    const e = w.spawnEnemy('normal', 100, BALANCE.field.defenseLineY - 1)!;
    e.speed = 600;
    stepFor(w, 1 / 60);
    expect(w.life).toBe(4);
    w.life = 1;
    w.spawnEnemy('proliferator', 100, BALANCE.field.defenseLineY - 1)!.speed = 600;
    stepFor(w, 1 / 60);
    expect(w.phase).toBe('ended');
    expect(w.result).toBe('defeat');
  });

  it('중간 보스를 잡으면 판 피해 배율 ×bossKill, 최종 보스는 아님', () => {
    const w = sandbox();
    const d0 = w.stats.tapDamage;
    const boss = w.spawnEnemy('proliferator', 180, 200)!;
    boss.hp = 1;
    freeze(w);
    w.drainEvents();
    tap(w, 180, 200);
    expect(w.stats.damageMult).toBeCloseTo(BALANCE.mult.bossKill);
    expect(w.stats.tapDamage).toBeCloseTo(d0 * BALANCE.mult.bossKill);
    expect(w.drainEvents().some((e) => e.type === 'mult')).toBe(true);
  });

  it('증식체: 체력 25%마다 돌격형 3마리', () => {
    const w = sandbox();
    const boss = w.spawnEnemy('proliferator', 180, 200)!;
    boss.hp = boss.maxHp = 100;
    freeze(w);
    w.spawnExplosion({ x: 180, y: 200, radius: 5, damage: 30, chainId: w.newChain(), source: 'tap' });
    stepFor(w, 1 / 60);
    expect(w.enemies.filter((e) => e.def.id === 'rusher').length).toBe(3);
  });
});
