import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT, packSize } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { freeze, sandbox, stepFor, tap } from './helpers';

describe('무리 스폰', () => {
  it('무리는 여러 마리가 한꺼번에, 화면 위 바깥에서 나온다', () => {
    const w = sandbox();
    w.spawnPack();
    expect(w.enemies.length).toBeGreaterThanOrEqual(packSize(1) - 1);
    for (const e of w.enemies) expect(e.y).toBeLessThan(0);
  });

  it('무리는 대열을 유지한 채 가장 느린 구성원 속도로 내려온다', () => {
    const w = sandbox();
    w.wave = 6;
    w.spawnPack();
    const members = w.enemies.filter((e) => e.pack);
    expect(members.length).toBeGreaterThan(1);
    const pack = members[0].pack!;
    expect(pack.speed).toBe(Math.min(...members.map((e) => e.speed)));
    const before = members.map((e) => [e.x - members[0].x, e.y - members[0].y]);
    stepFor(w, 2);
    const after = members.map((e) => [e.x - members[0].x, e.y - members[0].y]);
    expect(after).toEqual(before);
  });

  it('돌격형은 무리에 묶이지 않고 혼자 튀어나간다', () => {
    const w = sandbox();
    w.wave = 10;
    for (let i = 0; i < 30; i++) w.spawnPack();
    const rushers = w.enemies.filter((e) => e.def.id === 'rusher');
    expect(rushers.length).toBeGreaterThan(0);
    for (const e of rushers) expect(e.pack).toBeNull();
  });

  it('보스가 아닌 적은 speedMul 만큼 느리다', () => {
    const w = sandbox();
    const e = w.spawnEnemy('normal', 100, 100)!;
    const boss = w.spawnEnemy('proliferator', 200, 100)!;
    expect(e.speed).toBeCloseTo(ENEMIES.normal.speed * BALANCE.enemy.speedMul);
    expect(boss.speed).toBe(12);
  });

  it('구성원이 다 죽으면 무리도 정리된다', () => {
    const w = sandbox();
    w.spawnPack();
    expect(w.packs.length).toBe(1);
    for (const e of w.enemies) e.dead = true;
    w.step(FIXED_DT);
    expect(w.packs.length).toBe(0);
  });
});

describe('연쇄 환급', () => {
  /** 연쇄가 끝까지 번지도록 30px 간격으로 한 줄 */
  function line(count: number) {
    const w = sandbox();
    for (let i = 0; i < count; i++) w.spawnEnemy('normal', 30 + i * 30, 200);
    freeze(w);
    return w;
  }

  it(`한 연쇄에서 ${BALANCE.chain.refundEveryKills}마리마다 충전 +1`, () => {
    const n = BALANCE.chain.refundEveryKills;
    const w = line(n);
    tap(w, 360, 500); // 빈 곳: 충전만 씀
    tap(w, 30, 200); // 줄 왼쪽 끝에서 연쇄 시작
    expect(w.charges).toBe(1);
    const events = [];
    for (let i = 0; i < 60; i++) {
      w.step(FIXED_DT);
      events.push(...w.drainEvents());
    }
    expect(w.kills).toBe(n);
    expect(w.refunds).toBe(1);
    expect(events.filter((e) => e.type === 'refund').length).toBe(1);
    expect(Math.floor(w.charges)).toBe(2);
  });

  it('연쇄가 짧으면 환급 없음', () => {
    const w = line(BALANCE.chain.refundEveryKills - 1);
    tap(w, 30, 200);
    stepFor(w, 1);
    expect(w.refunds).toBe(0);
  });

  it('충전이 가득이면 환급하지 않는다 (넘치지 않음)', () => {
    const w = line(BALANCE.chain.refundEveryKills);
    // 탭으로 1칸 쓰고, 연쇄 도중 다시 가득 채운다
    tap(w, 30, 200);
    w.gainCharge(99);
    stepFor(w, 1);
    expect(w.charges).toBe(w.stats.maxCharges);
    expect(w.refunds).toBe(0);
  });
});
