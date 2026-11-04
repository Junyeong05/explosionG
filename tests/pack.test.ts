import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT, packSize } from '../src/data/balance';
import { ENEMIES } from '../src/data/enemies';
import { freeze, grant, sandbox, stepFor, tap } from './helpers';

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
  /** 연쇄 반응을 켜고 30px 간격으로 한 줄 → 왼쪽 끝을 작게 쏘면 끝까지 번진다 */
  function line(count: number) {
    const w = sandbox();
    grant(w, 'chain_reaction');
    for (let i = 0; i < count; i++) w.spawnEnemy('normal', 30 + i * 30, 200);
    freeze(w);
    w.gauge = 0.3;
    tap(w, 30, 200);
    return w;
  }

  it(`한 연쇄에서 ${BALANCE.chain.refundEveryKills}마리마다 게이지 +${BALANCE.chain.refundGauge * 100}%`, () => {
    const n = BALANCE.chain.refundEveryKills;
    const w = line(n);
    const events = [];
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      w.step(FIXED_DT);
      events.push(...w.drainEvents());
    }
    expect(w.kills).toBe(n);
    expect(w.refunds).toBe(1);
    expect(events.filter((e) => e.type === 'refund').length).toBe(1);
    // 탭으로 0 이 된 뒤 sim 시간만큼 찬 양 + 환급 (레벨업 선택창이 뜨면 시간이 멈추므로 w.time 기준)
    expect(w.gauge).toBeCloseTo(w.time / BALANCE.tap.gauge.fillSec + BALANCE.chain.refundGauge, 5);
  });

  it('연쇄가 짧으면 환급 없음', () => {
    const w = line(BALANCE.chain.refundEveryKills - 1);
    stepFor(w, 1);
    expect(w.refunds).toBe(0);
  });

  it('게이지가 가득이면 환급하지 않는다 (넘치지 않음)', () => {
    const w = line(BALANCE.chain.refundEveryKills);
    w.gauge = w.stats.gaugeMax;
    stepFor(w, 1);
    expect(w.gauge).toBe(w.stats.gaugeMax);
    expect(w.refunds).toBe(0);
  });
});

describe('챕터별 적 구성', () => {
  function kindsSeen(chapterId: string, wave: number): Set<string> {
    const w = sandbox({ chapterId });
    w.wave = wave;
    for (let i = 0; i < 60; i++) w.spawnPack();
    return new Set(w.enemies.map((e) => e.def.id));
  }

  it('챕터 1 초반은 일반 적만, 끝까지 장갑·보호막·분열은 없다', () => {
    expect([...kindsSeen('ch1', 1)]).toEqual(['normal']);
    const late = kindsSeen('ch1', 15);
    for (const k of ['armored', 'shielded', 'splitter']) expect(late.has(k)).toBe(false);
    expect(late.has('explosive')).toBe(true);
  });

  it('챕터 2 는 장갑이 웨이브 6부터 섞인다', () => {
    expect(kindsSeen('ch2', 5).has('armored')).toBe(false);
    expect(kindsSeen('ch2', 6).has('armored')).toBe(true);
  });

  it('챕터가 올라갈수록 적 체력이 높다', () => {
    const hp = (id: string) => sandbox({ chapterId: id }).spawnEnemy('normal', 100, 100)!.maxHp;
    expect(hp('ch2')).toBeGreaterThan(hp('ch1'));
    expect(hp('ch4')).toBeGreaterThan(hp('ch3'));
  });
});
