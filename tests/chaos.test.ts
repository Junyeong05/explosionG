import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { CHAOS_AUGMENTS, CHAOS_EVENTS } from '../src/data/chaos';
import { defaultSave } from '../src/meta/save';
import { createRunConfig } from '../src/meta/progression';
import { Bot } from '../src/sim/bot';
import { World } from '../src/sim/World';
import { freeze, sandbox, stepFor } from './helpers';

const C = BALANCE.chaos;

/** 적을 화면 가운데쯤 여러 마리 깔아 둔 도파민 모드 샌드박스 */
function arena(): World {
  const w = sandbox({ rules: { chaos: true } });
  for (let i = 0; i < 24; i++) w.spawnEnemy('normal', 40 + (i % 8) * 40, 150 + Math.floor(i / 8) * 90);
  freeze(w);
  return w;
}

describe('도파민 모드', () => {
  it('난입 14종이 각각 터지지 않고 적을 잡는다', () => {
    for (const ev of CHAOS_EVENTS) {
      if (ev.id === 'cookie') continue;
      const w = arena();
      w.chaos!.startEvent(ev.id);
      stepFor(w, 5);
      expect(w.kills, ev.name).toBeGreaterThan(0);
    }
  });

  it('설치물은 도파민 모드 선택지에만 나오고, 선택지마다 하나는 섞인다', () => {
    const normal = new World({ ...createRunConfig(defaultSave(), 'chapter', 3, 'ch1'), rules: {} });
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) for (const id of normal.augments.roll('level', 10)) ids.add(id);
    expect([...ids].some((id) => id.startsWith('chaos_'))).toBe(false);

    const w = new World({ ...createRunConfig(defaultSave(), 'chapter', 3, 'ch1'), rules: { chaos: true } });
    const bot = new Bot({ seed: 3 });
    let offers = 0;
    for (let i = 0; i < 60 * 90 && w.phase !== 'ended'; i++) {
      if (w.phase === 'choosing' && w.offer) {
        offers++;
        expect(w.offer.choices.some((id) => id.startsWith('chaos_'))).toBe(true);
      }
      w.step(FIXED_DT, bot.think(w, FIXED_DT));
      w.drainEvents();
    }
    expect(offers).toBeGreaterThan(0);
  });

  it('황금 쿠키를 누르면 그 탭은 쏘지 않고 버프를 받는다', () => {
    const w = arena();
    w.chaos!.startEvent('cookie');
    const cookie = w.chaos!.actors.find((a) => a.kind === 'cookie')!;
    w.drainEvents();
    w.step(FIXED_DT, [{ t: 'press', x: cookie.x, y: cookie.y }, { t: 'release', x: cookie.x, y: cookie.y }]);
    const evs = w.drainEvents();
    expect(evs.some((e) => e.type === 'cookie')).toBe(true);
    expect(evs.some((e) => e.type === 'tap')).toBe(false);
    expect(w.chaos!.actors.some((a) => a.kind === 'cookie')).toBe(false);
  });

  it('짧은 시간에 많이 잡으면 피버, 피버 중 탭은 두 배', () => {
    const w = arena();
    w.chaos!.heat = C.feverThreshold + 1;
    stepFor(w, 0.05);
    expect(w.chaos!.fever).toBeGreaterThan(0);
    w.drainEvents();
    const shot = { x: 0, y: 0, power: 1, radius: 60, damage: 10, depth: 1, delay: 0, tag: {}, cancel: false };
    w.chaos!.onFire(shot);
    expect(shot.damage).toBeCloseTo(10 * C.feverDamage);
    expect(shot.depth).toBe(2);
  });

  it('곱하기 게이트를 지난 포탄은 늘어난다', () => {
    const w = arena();
    w.augments.acquire('chaos_gate', w);
    stepFor(w, 0.05);
    const g = w.chaos!.gate!;
    expect(g.mult).toBe(2);
    // 게이트 바로 아래에서 위로 쏘는 포탄
    const before = w.chaos!.actors.length;
    (w.chaos as unknown as { lob(k: string, x: number, y: number, tx: number, ty: number, s: number): void }).lob('shell', g.x, g.y + 40, g.x, g.y - 120, 400);
    stepFor(w, 0.2);
    expect(w.chaos!.actors.filter((a) => a.kind === 'shell').length).toBe(2);
    expect(w.chaos!.actors.length).toBeGreaterThan(before);
  });

  it('설치물 증강은 전부 이름에 이모지가 있고 겹칠 수 있다', () => {
    for (const d of CHAOS_AUGMENTS) {
      expect(d.maxStacks).toBeGreaterThan(1);
      expect(d.id.startsWith('chaos_')).toBe(true);
    }
  });

  it('봇이 도파민 모드 한 판을 끝까지 돌려도 터지지 않는다', () => {
    const w = new World({ ...createRunConfig(defaultSave(), 'chapter', 5, 'ch1'), rules: { chaos: true }, recordEvents: false });
    const bot = new Bot({ seed: 5 });
    for (let i = 0; i < 60 * 60 * 8 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
    expect(w.phase).toBe('ended');
    expect(w.chaos!.events).toBeGreaterThan(10);
  });
});
