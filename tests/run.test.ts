import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../src/data/balance';
import { Bot } from '../src/sim/bot';
import { NO_META } from '../src/sim/stats';
import { World } from '../src/sim/World';
import type { RunConfig } from '../src/sim/types';

function play(seed: number, seconds: number): World {
  const config: RunConfig = { seed, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META }, recordEvents: false };
  const w = new World(config);
  const bot = new Bot({ seed });
  const steps = Math.ceil(seconds / FIXED_DT);
  for (let i = 0; i < steps && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
  return w;
}

describe('결정론', () => {
  it('같은 시드 + 같은 입력 = 같은 판', () => {
    const a = play(123, 90);
    const b = play(123, 90);
    expect(a.fingerprint()).toBe(b.fingerprint());
    expect(a.summary()).toEqual(b.summary());
  });

  it('다른 시드면 다른 판', () => {
    expect(play(1, 60).fingerprint()).not.toBe(play(2, 60).fingerprint());
  });
});

describe('판 진행', () => {
  it('웨이브가 오르고, 레벨업 선택지가 뜨고, 보스가 나온다', () => {
    const config: RunConfig = { seed: 5, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META } };
    const w = new World(config);
    const bot = new Bot({ seed: 5 });
    const seen = new Set<string>();
    for (let i = 0; i < 70 * 60 && w.phase !== 'ended'; i++) {
      w.step(FIXED_DT, bot.think(w, FIXED_DT));
      for (const e of w.drainEvents()) seen.add(e.type);
    }
    expect(w.wave).toBeGreaterThanOrEqual(3);
    expect(seen.has('levelUp')).toBe(true);
    expect(seen.has('offer')).toBe(true);
    expect(seen.has('bossSpawn')).toBe(true);
    expect(w.augments.history.length).toBeGreaterThan(0);
  });

  it('선행 증강: 시작하자마자 선택창', () => {
    const w = new World({ seed: 1, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META, headStartPicks: 1 } });
    w.step(FIXED_DT);
    expect(w.phase).toBe('choosing');
    expect(w.offer?.kind).toBe('start');
    w.step(FIXED_DT, [{ t: 'choose', index: 0 }]);
    expect(w.phase).toBe('playing');
  });

  it('리롤: 횟수만큼만', () => {
    const w = new World({ seed: 1, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META, headStartPicks: 1, rerolls: 1 } });
    w.step(FIXED_DT);
    w.step(FIXED_DT, [{ t: 'reroll' }]);
    expect(w.rerollsLeft).toBe(0);
    const before = w.offer?.choices;
    w.step(FIXED_DT, [{ t: 'reroll' }]);
    expect(w.offer?.choices).toEqual(before);
  });

  it('선택창이 떠 있는 동안 시간이 멈춘다', () => {
    const w = new World({ seed: 1, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META, headStartPicks: 1 } });
    w.step(FIXED_DT);
    const t = w.time;
    for (let i = 0; i < 60; i++) w.step(FIXED_DT, [{ t: 'press', x: 100, y: 100 }]);
    expect(w.time).toBe(t);
    expect(w.gauge).toBe(1);
  });
});
