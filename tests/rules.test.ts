import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { grant, sandbox, stepFor, tap } from './helpers';

const OC = BALANCE.experiment.overcharge;

describe('실험 규칙: 과충전', () => {
  it('규칙이 꺼져 있으면 100% 에서 멈추고 누르면 바로 쏜다', () => {
    const w = sandbox();
    stepFor(w, 5);
    expect(w.gauge).toBe(1);
    w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    expect(w.taps).toBe(1);
  });

  it('누르고 있지 않으면 100% 에서 멈춘다 (쉬는 동안 폭주하지 않음)', () => {
    const w = sandbox({ rules: { overcharge: true } });
    stepFor(w, 5);
    expect(w.gauge).toBe(1);
    expect(w.overloads).toBe(0);
  });

  it('100% 에서 누르고 있으면 넘어서 차고, 점점 빨라지며, 떼면 그 크기로 쏜다', () => {
    const w = sandbox({ rules: { overcharge: true } });
    w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    expect(w.charging).not.toBeNull();
    stepFor(w, 0.2);
    const first = w.gauge - 1;
    stepFor(w, 0.2);
    const second = w.gauge - 1 - first;
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    const power = w.gauge;
    w.drainEvents();
    w.step(FIXED_DT, [{ t: 'move', x: 200, y: 300 }, { t: 'release', x: 200, y: 300 }]);
    const t = w.drainEvents().find((e) => e.type === 'tap');
    expect(t).toMatchObject({ type: 'tap', x: 200, y: 300 });
    expect(t && t.type === 'tap' && t.power).toBeGreaterThan(power - 0.01);
    expect(w.charging).toBeNull();
  });

  it('100% 일 때 짧게 탭하면 (같은 스텝에 떼면) 100% 로 바로 쏜다', () => {
    const w = sandbox({ rules: { overcharge: true } });
    w.drainEvents();
    tap(w, 100, 100);
    const t = w.drainEvents().find((e) => e.type === 'tap');
    expect(t && t.type === 'tap' && t.power).toBeCloseTo(1);
  });

  it('너무 오래 누르면 폭주: 게이지 0, overheatSec 동안 헛탭', () => {
    const w = sandbox({ rules: { overcharge: true } });
    w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    w.drainEvents();
    stepFor(w, 2);
    expect(w.overloads).toBe(1);
    expect(w.charging).toBeNull();
    expect(w.drainEvents().some((e) => e.type === 'overload')).toBe(true);
    w.step(FIXED_DT, [{ t: 'release', x: 100, y: 100 }]);
    expect(w.taps).toBe(0);
    tap(w, 100, 100);
    expect(w.drainEvents().some((e) => e.type === 'dryTap')).toBe(true);
    stepFor(w, OC.overheatSec);
    expect(w.overheat).toBe(0);
  });

  it('130% 넘게 쏘면 100% 보다 크고, 연쇄가 2단계까지 간다', () => {
    const w = sandbox({ rules: { overcharge: true } });
    expect(w.tapRadiusAt(1.4)).toBeGreaterThan(w.tapRadiusAt(1));
    expect(w.chainDepthAt(1)).toBe(1);
    expect(w.chainDepthAt(1.4)).toBe(2);
  });

  it('환급으로는 100% 까지만 찬다 (환급 때문에 폭주하지 않게)', () => {
    const w = sandbox({ rules: { overcharge: true } });
    w.gauge = 0.95;
    w.gainGauge(0.5);
    expect(w.gauge).toBe(1);
  });

  it('초신성이면 상한 250%, 폭주 없음', () => {
    const w = sandbox({ rules: { overcharge: true } });
    grant(w, 'supernova');
    expect(w.stats.gaugeMax).toBe(BALANCE.prism.supernova.gaugeMax);
    expect(w.overloadable).toBe(false);
    stepFor(w, 12);
    expect(w.overloads).toBe(0);
    expect(w.gauge).toBe(BALANCE.prism.supernova.gaugeMax);
  });
});

describe('실험 규칙: 연쇄 잇기', () => {
  const C = BALANCE.experiment.combo;

  it('처치마다 콤보가 쌓이고, 다음 탭 피해에 콤보 배율이 붙는다', () => {
    const w = sandbox({ rules: { combo: true } });
    for (let i = 0; i < 5; i++) w.spawnEnemy('normal', 100 + i * 5, 200)!.hp = 1;
    const tank = w.spawnEnemy('normal', 300, 400)!;
    tank.hp = tank.maxHp = 1000;
    for (const e of w.enemies) e.speed = 0;
    tap(w, 110, 200);
    expect(w.combo.kills).toBe(5);
    const mult = 1 + C.perKill * 5;
    expect(w.comboMult()).toBeCloseTo(mult);
    w.gauge = 1;
    tap(w, 300, 400); // 정중앙 → 감쇠 없음
    expect(1000 - tank.hp).toBeCloseTo(w.tapDamageAt(1) * mult);
  });

  it('windowSec 동안 처치가 없으면 콤보가 끊긴다', () => {
    const w = sandbox({ rules: { combo: true } });
    w.spawnEnemy('normal', 100, 200)!.hp = 1;
    tap(w, 100, 200);
    expect(w.combo.kills).toBe(1);
    w.drainEvents();
    stepFor(w, C.windowSec + FIXED_DT * 2);
    expect(w.combo.kills).toBe(0);
    expect(w.comboMult()).toBe(1);
    expect(w.drainEvents().some((e) => e.type === 'comboEnd')).toBe(true);
  });

  it('규칙이 꺼져 있으면 배율 1', () => {
    const w = sandbox();
    w.spawnEnemy('normal', 100, 200)!.hp = 1;
    tap(w, 100, 200);
    expect(w.comboMult()).toBe(1);
  });
});

describe('실험 규칙: 벼랑 끝', () => {
  const B = BALANCE.experiment.brink;
  const line = BALANCE.field.defenseLineY;

  it('방어선 가까이서 잡으면 게이지를 돌려받고, 멀리서는 없다', () => {
    const w = sandbox({ rules: { brink: true } });
    const near = w.spawnEnemy('normal', 100, line - B.zone / 2)!;
    const far = w.spawnEnemy('normal', 300, line - B.zone - 80)!;
    near.hp = far.hp = 1;
    near.speed = far.speed = 0;
    w.gauge = 0.3;
    tap(w, 100, line - B.zone / 2);
    expect(w.brinkKills).toBe(1);
    expect(w.gauge).toBeCloseTo(B.refundPerKill + FIXED_DT / BALANCE.tap.gauge.fillSec);
    w.gauge = 0.3;
    tap(w, 300, line - B.zone - 80);
    expect(w.brinkKills).toBe(1);
  });
});

describe('봇: 과충전 정책', () => {
  it('overchargeAt 만큼 누르고 있다가 뗀다 (오차 0 이면 거의 정확히)', async () => {
    const { Bot } = await import('../src/sim/bot');
    const w = sandbox({ rules: { overcharge: true } });
    for (let i = 0; i < 5; i++) w.spawnEnemy('normal', 150 + i * 10, 200)!.speed = 0;
    for (const e of w.enemies) e.hp = e.maxHp = 1e6;
    const bot = new Bot({ seed: 1, overchargeAt: 1.3, holdJitter: 0 });
    let power = -1;
    for (let i = 0; i < 300 && power < 0; i++) {
      w.step(FIXED_DT, bot.think(w, FIXED_DT));
      for (const e of w.drainEvents()) if (e.type === 'tap') power = e.power;
    }
    expect(power).toBeGreaterThan(1.27);
    expect(power).toBeLessThan(1.33);
    expect(w.overloads).toBe(0);
  });
});
