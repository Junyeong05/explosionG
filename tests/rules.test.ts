import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { grant, sandbox, stepFor, tap } from './helpers';

const OC = BALANCE.experiment.overcharge;

describe('실험 규칙: 과충전', () => {
  it('기본 규칙: 누르고 있지 않으면 100% 에서 멈추고, 100% 에서 누르면 과충전이 시작된다 (떼야 발사)', () => {
    const w = sandbox();
    stepFor(w, 5);
    expect(w.gauge).toBe(1);
    w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    expect(w.charging).not.toBeNull();
    expect(w.taps).toBe(0);
    w.step(FIXED_DT, [{ t: 'release', x: 100, y: 100 }]);
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

describe('실험 규칙: 불씨 칠하기', () => {
  it('과충전도 같이 켜진다 (100% 에서 누르면 바로 안 쏘고 누르고 있기)', () => {
    const w = sandbox({ rules: { paint: true } });
    expect(w.overloadable).toBe(true);
    w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    expect(w.charging).not.toBeNull();
    expect(w.taps).toBe(0);
  });

  it('누른 채 끌면 원에 닿은 적에 불씨가 붙고, 피해는 없다', () => {
    const w = sandbox({ rules: { paint: true } });
    const near = w.spawnEnemy('normal', 300, 100)!;
    const far = w.spawnEnemy('normal', 300, 400)!;
    const ex = w.spawnEnemy('explosive', 310, 110)!;
    for (const e of w.enemies) e.speed = 0;
    w.step(FIXED_DT, [{ t: 'press', x: 300, y: 100 }]);
    w.step(FIXED_DT);
    expect(near.spark).toBe(false); // 가만히 누르고만 있으면 안 칠해진다
    w.step(FIXED_DT, [{ t: 'move', x: 60, y: 100 }]);
    w.step(FIXED_DT, [{ t: 'move', x: 300, y: 100 }]);
    expect(near.spark).toBe(true);
    expect(near.hp).toBe(near.maxHp);
    expect(far.spark).toBe(false);
    expect(ex.spark).toBe(false); // 폭발형은 원래 터지므로 불씨 안 붙음
  });

  /** 불씨 붙은 적 A 를 탭으로 잡으면 A 가 터져서 탭이 안 닿는 B 를 잡는다 */
  function sparkLadder(spark: boolean) {
    const w = sandbox({ rules: { paint: true } });
    const a = w.spawnEnemy('normal', 100, 200)!;
    const b = w.spawnEnemy('normal', 180, 200)!; // 탭(반경 60+11)엔 안 닿고 폭발형 폭발(약 83+11)엔 닿음
    a.hp = b.hp = 1;
    a.spark = spark;
    for (const e of w.enemies) e.speed = 0;
    tap(w, 100, 200);
    stepFor(w, 0.5);
    return { w, b };
  }

  it('불씨 붙은 적은 죽을 때 폭발형처럼 터진다', () => {
    const { w, b } = sparkLadder(true);
    expect(b.dead).toBe(true);
    expect(w.sparkBlasts).toBe(1);
  });

  it('불씨가 없으면 안 터진다 (대조군)', () => {
    const { b } = sparkLadder(false);
    expect(b.dead).toBe(false);
  });
});

describe('실험 규칙: 짝 폭발형', () => {
  it('서로 다른 무리의 폭발형끼리 짝을 맺는다', () => {
    const w = sandbox({ chapterId: 'ch2', rules: { pairs: true } });
    w.wave = 5;
    for (let i = 0; i < 20; i++) w.spawnPack();
    const paired = w.enemies.filter((e) => e.partner);
    expect(paired.length).toBeGreaterThan(0);
    for (const e of paired) {
      expect(e.def.id).toBe('explosive');
      expect(e.partner!.partner).toBe(e);
      expect(e.partner!.pack).not.toBe(e.pack);
      expect(e.pairColor).toBe(e.partner!.pairColor);
      expect(Math.hypot(e.x - e.partner!.x, e.y - e.partner!.y)).toBeGreaterThanOrEqual(BALANCE.experiment.pairs.minDistance);
    }
    expect(paired.length / 2).toBeLessThanOrEqual(BALANCE.experiment.pairs.maxActive);
  });

  function pair(gauge: number) {
    const w = sandbox({ rules: { pairs: true } });
    const a = w.spawnEnemy('explosive', 80, 150)!;
    const b = w.spawnEnemy('explosive', 280, 450)!;
    const nearB = w.spawnEnemy('normal', 320, 450)!;
    a.partner = b;
    b.partner = a;
    a.pairColor = b.pairColor = 0;
    a.hp = b.hp = nearB.hp = 1;
    for (const e of w.enemies) e.speed = 0;
    w.gauge = gauge;
    tap(w, 80, 150);
    stepFor(w, 0.5);
    return { w, b, nearB };
  }

  it('하나가 터지면 멀리 있는 짝도 그 자리에서 터져 주변을 잡는다', () => {
    const { w, b, nearB } = pair(1);
    expect(b.dead).toBe(true);
    expect(nearB.dead).toBe(true);
    expect(w.pairBlasts).toBe(1);
  });

  it('100% 미만 탭이라 터지지 않았으면 짝도 안 터진다', () => {
    const { b } = pair(0.5);
    expect(b.dead).toBe(false);
  });

  it('짝이 방어선을 넘으면 짝 관계만 끊긴다', () => {
    const w = sandbox({ rules: { pairs: true } });
    const a = w.spawnEnemy('explosive', 80, 150)!;
    const b = w.spawnEnemy('explosive', 280, BALANCE.field.defenseLineY - 1)!;
    a.partner = b;
    b.partner = a;
    a.speed = 0;
    b.speed = 600;
    w.step(FIXED_DT);
    expect(b.dead).toBe(true);
    expect(a.partner).toBeNull();
  });
});

describe('봇: 불씨 칠하기 정책', () => {
  it('ring 정책은 누른 채 목표 둘레를 돌며 불씨를 칠하고 뗀다', async () => {
    const { Bot } = await import('../src/sim/bot');
    const w = sandbox({ rules: { paint: true } });
    // 목표 무리 + 둘레(반경 60~98)에 흩어진 적
    for (let i = 0; i < 5; i++) w.spawnEnemy('normal', 180 + i * 6, 250)!;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      w.spawnEnemy('normal', 192 + Math.cos(a) * 85, 250 + Math.sin(a) * 85);
    }
    for (const e of w.enemies) { e.speed = 0; e.hp = e.maxHp = 1e6; }
    const bot = new Bot({ seed: 1, paint: 'ring', holdJitter: 0 });
    let fired = false;
    for (let i = 0; i < 200 && !fired; i++) {
      w.step(FIXED_DT, bot.think(w, FIXED_DT));
      for (const e of w.drainEvents()) if (e.type === 'tap') fired = true;
    }
    expect(fired).toBe(true);
    expect(w.enemies.filter((e) => e.spark).length).toBeGreaterThanOrEqual(4);
    expect(w.overloads).toBe(0);
  });
});

describe('실험 규칙: 쌓이는 바닥', () => {
  const P = BALANCE.experiment.pile;
  const line = BALANCE.field.defenseLineY;

  /** col 칸에 적 하나를 떨어뜨려 쌓는다 */
  function drop(w: ReturnType<typeof sandbox>, col: number, kind = 'normal') {
    const e = w.spawnEnemy(kind, (col + 0.5) * P.colWidth, 100)!;
    e.hp = e.maxHp = 1;
    e.y = w.pileTopY(col) - e.radius - 0.5;
    e.speed = 120;
    stepFor(w, 0.05);
    return e;
  }

  it('방어선에 닿은 적은 LIFE 를 깎지 않고 블록으로 쌓인다', () => {
    const w = sandbox({ rules: { pile: true } });
    const a = drop(w, 3);
    const b = drop(w, 3);
    expect(a.dead).toBe(false);
    expect(a.pileCol).toBe(3);
    expect(b.pileY).toBeCloseTo(a.pileY - P.blockH);
    expect(w.life).toBe(BALANCE.life.start);
    expect(w.pileCols[3].length).toBe(2);
  });

  it('한 칸이 한계까지 차면 패배', () => {
    const w = sandbox({ rules: { pile: true } });
    for (let i = 0; i < P.maxRows; i++) drop(w, 0);
    expect(w.phase).toBe('ended');
    expect(w.result).toBe('defeat');
  });

  it('아래 블록이 사라지면 위 블록이 떨어진다', () => {
    const w = sandbox({ rules: { pile: true } });
    const a = drop(w, 5);
    const b = drop(w, 5);
    const top = b.pileY;
    w.spawnExplosion({ x: a.x, y: a.y, radius: 4, damage: 99, chainId: w.newChain(0), source: 'chain' });
    stepFor(w, 0.3);
    expect(a.dead).toBe(true);
    expect(b.pileY).toBeGreaterThan(top);
    expect(b.y).toBeCloseTo(line - 0.5 * P.blockH);
  });

  /** 0~11칸에 한 줄로 쌓고 0칸을 쏜다 → 몇 칸까지 무너지나 */
  function rowCollapse(fire: (w: ReturnType<typeof sandbox>) => void) {
    const w = sandbox({ rules: { pile: true } });
    const row = Array.from({ length: 12 }, (_, c) => drop(w, c));
    fire(w);
    stepFor(w, 1);
    return row.filter((e) => e.dead).length;
  }

  it('100% 로 쏘면 블록이 줄줄이 무너지고, 100% 미만이면 맞은 것만 죽는다', () => {
    const full = rowCollapse((w) => tap(w, P.colWidth / 2, line - P.blockH / 2));
    const half = rowCollapse((w) => { w.gauge = 0.5; tap(w, P.colWidth / 2, line - P.blockH / 2); });
    expect(full).toBeGreaterThan(half + 2);
  });

  it('과충전 130% 로 쏘면 100% 보다 더 멀리 무너진다 (단계 × stepsPerDepth)', () => {
    const full = rowCollapse((w) => tap(w, P.colWidth / 2, line - P.blockH / 2));
    const over = rowCollapse((w) => {
      w.step(FIXED_DT, [{ t: 'press', x: P.colWidth / 2, y: line - P.blockH / 2 }]);
      while (w.gauge < 1.32) w.step(FIXED_DT);
      w.step(FIXED_DT, [{ t: 'release', x: P.colWidth / 2, y: line - P.blockH / 2 }]);
    });
    expect(over).toBeGreaterThan(full);
  });
});
