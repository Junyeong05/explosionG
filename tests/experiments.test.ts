import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { EXPERIMENTS } from '../src/data/experiments';
import { defaultSave } from '../src/meta/save';
import { createRunConfig } from '../src/meta/progression';
import { Bot } from '../src/sim/bot';
import { World } from '../src/sim/World';
import { freeze, sandbox, stepFor, tap } from './helpers';

const E = BALANCE.experiment;

describe('11-07 실험 묶음', () => {
  it('규칙마다 봇이 1분 동안 돌려도 터지지 않고 적을 잡는다', () => {
    for (const x of EXPERIMENTS) {
      const w = new World({ ...createRunConfig(defaultSave(), 'chapter', 7, 'ch2'), rules: { [x.id]: true } });
      const bot = new Bot({ seed: 7 });
      for (let i = 0; i < 60 * 60 && w.phase !== 'ended'; i++) {
        w.step(FIXED_DT, bot.think(w, FIXED_DT));
        w.drainEvents();
      }
      expect(w.kills, x.name).toBeGreaterThan(0);
    }
  });

  it('번호는 1부터 빠짐없이, 이름이 겹치지 않는다', () => {
    const nos = EXPERIMENTS.map((x) => x.no).sort((a, b) => a - b);
    expect(nos).toEqual(nos.map((_, i) => i + 1));
    expect(new Set(EXPERIMENTS.map((x) => x.name)).size).toBe(EXPERIMENTS.length);
  });

  it('얼리고 깨기: 100% 전 탭은 피해 없이 얼리고, 언 적은 멈췄다가 죽을 때 깨지며 터진다', () => {
    const w = sandbox({ rules: { freeze: true } });
    const e = w.spawnEnemy('normal', 100, 200)!;
    w.gauge = 0.6;
    tap(w, 100, 200);
    stepFor(w, 0.1);
    expect(e.hp).toBe(e.maxHp);
    expect(e.frozen).toBeGreaterThan(0);
    const y = e.y;
    stepFor(w, 1);
    expect(e.y).toBe(y);
    w.gauge = 1;
    w.drainEvents();
    tap(w, 100, 200);
    stepFor(w, 0.3);
    expect(e.dead).toBe(true);
    expect(w.drainEvents().filter((ev) => ev.type === 'explosion' && ev.source === 'chain').length).toBe(1);
  });

  it('씨앗 심기: 100% 전 탭은 게이지 cost 만 쓰고 씨앗, 폭발이 닿으면 씨앗도 터진다', () => {
    const w = sandbox({ rules: { seeds: true } });
    w.gauge = 0.5;
    tap(w, 200, 200);
    expect(w.exp.seeds).toHaveLength(1);
    expect(w.gauge).toBeCloseTo(0.5 - E.seeds.cost, 1);
    expect(w.explosions).toHaveLength(0);
    w.gauge = 1;
    w.drainEvents();
    tap(w, 230, 200);
    stepFor(w, 0.3);
    expect(w.exp.seeds).toHaveLength(0);
    expect(w.drainEvents().some((ev) => ev.type === 'seedBlast')).toBe(true);
  });

  it('지뢰 심기: 탭은 지뢰를 박고, 적이 밟으면 터진다', () => {
    const w = sandbox({ rules: { mines: true } });
    tap(w, 150, 300);
    expect(w.mines).toHaveLength(1);
    expect(w.explosions).toHaveLength(0);
    const e = w.spawnEnemy('normal', 150, 280)!;
    stepFor(w, 1.5);
    expect(e.dead).toBe(true);
    expect(w.mines).toHaveLength(0);
  });

  it('가로 베기: 같은 높이면 화면 양 끝까지 맞고, 다른 높이는 안 맞는다', () => {
    const w = sandbox({ rules: { row: true } });
    const left = w.spawnEnemy('normal', 15, 200)!;
    const right = w.spawnEnemy('normal', 345, 200)!;
    const other = w.spawnEnemy('normal', 180, 320)!;
    freeze(w);
    tap(w, 180, 200);
    stepFor(w, 0.1);
    expect(left.hp).toBeLessThan(left.maxHp);
    expect(right.hp).toBeLessThan(right.maxHp);
    expect(other.hp).toBe(other.maxHp);
  });

  it('색 맞추기: 같은 색은 세게, 다른 색은 약하게. 탭 색은 쏠 때마다 바뀐다', () => {
    const w = sandbox({ rules: { colors: true } });
    const a = w.spawnEnemy('armored', 100, 200)!;
    const b = w.spawnEnemy('armored', 260, 200)!;
    freeze(w);
    a.color = 0;
    b.color = 1;
    a.hp = b.hp = a.maxHp = b.maxHp = 1000;
    w.exp.tapColor = 0;
    tap(w, 100, 200);
    w.gauge = 1;
    w.exp.tapColor = 0;
    tap(w, 260, 200);
    stepFor(w, 0.1);
    const dmgA = 1000 - a.hp;
    const dmgB = 1000 - b.hp;
    expect(dmgA / dmgB).toBeCloseTo(E.colors.same / E.colors.other, 1);
    expect(w.exp.tapColor).toBe(1);
  });

  it('발사대: 탄이 도착해야 터진다', () => {
    const w = sandbox({ rules: { launcher: true } });
    w.drainEvents();
    tap(w, 180, 100);
    expect(w.drainEvents().some((ev) => ev.type === 'explosion')).toBe(false);
    const L = E.launcher;
    stepFor(w, Math.hypot(180 - L.x, 100 - L.y) / L.speed + 0.05);
    expect(w.drainEvents().some((ev) => ev.type === 'explosion')).toBe(true);
  });

  it('누를 때만 시간: 손을 떼면 적과 게이지가 거의 멈추고, 누르는 동안 흐른다', () => {
    const w = sandbox({ rules: { stopTime: true } });
    w.gauge = 0;
    const e = w.spawnEnemy('normal', 100, 100)!;
    stepFor(w, 1);
    expect(e.y - 100).toBeLessThan(e.speed * 0.1);
    expect(w.gauge).toBe(0);
    w.step(FIXED_DT, [{ t: 'press', x: 200, y: 400 }]);
    const y0 = e.y;
    stepFor(w, 1);
    expect(e.y - y0).toBeGreaterThan(e.speed * 0.9);
    expect(w.gauge).toBeGreaterThan(0.3);
    w.step(FIXED_DT, [{ t: 'release', x: 200, y: 400 }]);
    expect(w.taps).toBe(1);
  });

  it('가운데 지키기: 코어에 닿으면 LIFE 가 깎인다 (방어선은 상관없음)', () => {
    const w = sandbox({ rules: { core: true } });
    const C = E.core;
    const life = w.life;
    w.spawnEnemy('normal', C.x, C.y - 60);
    stepFor(w, 10);
    expect(w.life).toBeLessThan(life);
  });

  it('밀어내기: 폭발 중심에서 바깥으로 날아간다', () => {
    const w = sandbox({ rules: { knockback: true } });
    const e = w.spawnEnemy('armored', 100, 200)!;
    e.hp = e.maxHp = 1000;
    freeze(w);
    tap(w, 100, 230);
    stepFor(w, 0.5);
    expect(e.y).toBeLessThan(190);
  });

  it('황금 적: 연쇄로 잡으면 레벨 업, 탭으로 직접 잡으면 꽝', () => {
    const w = sandbox({ rules: { golden: true } });
    const direct = w.spawnEnemy('normal', 300, 100)!;
    direct.golden = true;
    freeze(w);
    tap(w, 300, 100);
    stepFor(w, 0.2);
    expect(direct.dead).toBe(true);
    expect(w.level).toBe(1);
    const bomb = w.spawnEnemy('explosive', 100, 300)!;
    const gold = w.spawnEnemy('normal', 175, 300)!;
    gold.golden = true;
    gold.hp = gold.maxHp = 5;
    freeze(w);
    w.gauge = 1;
    tap(w, 100, 300);
    stepFor(w, 0.3);
    expect(bomb.dead && gold.dead).toBe(true);
    expect(w.level).toBe(2);
  });
});
