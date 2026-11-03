import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { freeze, sandbox, stepFor, tap } from './helpers';

describe('탭 폭발과 충전', () => {
  it('탭은 충전 1칸을 쓰고, 다 쓰면 헛탭', () => {
    const w = sandbox();
    expect(w.charges).toBe(3);
    tap(w, 100, 100);
    tap(w, 100, 100);
    tap(w, 100, 100);
    expect(w.charges).toBe(0);
    w.drainEvents();
    tap(w, 100, 100);
    expect(w.drainEvents().some((e) => e.type === 'dryTap')).toBe(true);
  });

  it('rechargeSec 마다 1칸 회복', () => {
    const w = sandbox();
    tap(w, 100, 100);
    expect(w.charges).toBe(2);
    stepFor(w, BALANCE.tap.rechargeSec - 0.05);
    expect(w.charges).toBe(2);
    stepFor(w, 0.1);
    expect(w.charges).toBe(3);
  });
});

describe('연쇄', () => {
  it('처치된 적이 다시 터져 옆 적을 잡는다', () => {
    const w = sandbox();
    w.spawnEnemy('normal', 100, 200);
    w.spawnEnemy('normal', 140, 200); // 탭 반경(60) 밖이 되도록 탭은 왼쪽에
    freeze(w);
    tap(w, 60, 200);
    stepFor(w, 0.5);
    expect(w.kills).toBe(2);
    expect(w.maxChain).toBe(2);
  });

  it('연쇄 배율: 처치 1회마다 이후 폭발 피해 +5%', () => {
    const w = sandbox();
    w.spawnEnemy('normal', 100, 200);
    freeze(w);
    tap(w, 100, 200);
    w.drainEvents();
    // 첫 처치 이후 생기는 연쇄 폭발 피해 = D × 60% × (1 + 0.05 × 1)
    const ex = w.explosions[0];
    expect(ex.source).toBe('chain');
    expect(ex.damage).toBeCloseTo(BALANCE.tap.damage * 0.6 * 1.05);
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

  it('일반 적은 같은 거리에서 연쇄가 닿지 않는다 (대조군)', () => {
    const w = sandbox();
    w.spawnEnemy('normal', 100, 200);
    const far = w.spawnEnemy('normal', 100 + 75, 200)!;
    freeze(w);
    tap(w, 70, 200);
    stepFor(w, 0.3);
    expect(far.dead).toBe(false);
  });

  it('분열: 죽으면 3마리, 자기 연쇄 폭발에 물린다', () => {
    const w = sandbox();
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
