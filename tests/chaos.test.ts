import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { ARMS, ARSENAL, MAX_LEVEL, WEAPON_SLOTS } from '../src/data/chaos';
import { defaultSave } from '../src/meta/save';
import { createRunConfig } from '../src/meta/progression';
import { Bot } from '../src/sim/bot';
import { World } from '../src/sim/World';
import { freeze, sandbox, stepFor, tap } from './helpers';

const C = BALANCE.chaos;

/** 적을 화면 가운데쯤 여러 마리 깔아 둔 도파민 모드 샌드박스. 시작 무기 고르기는 건너뛴다 (무기는 테스트가 직접 줌) */
function arena(): World {
  const w = sandbox({ rules: { chaos: true } });
  (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
  // 사거리 안 (방어선 위 200px 안쪽)에 깔아 둔다
  for (let i = 0; i < 24; i++) w.spawnEnemy('normal', 40 + (i % 8) * 40, 360 + Math.floor(i / 8) * 60);
  freeze(w);
  return w;
}

const fresh = arena;

describe('도파민 모드: 카테고리 무기고', () => {
  it('판은 시작 무기 고르기로 시작하고, 손공격·총·포탑·소환수·마법에서 한 장씩 나온다', () => {
    const w = sandbox({ rules: { chaos: true } });
    w.step(FIXED_DT);
    expect(w.phase).toBe('choosing');
    expect(w.offer?.kind).toBe('starter');
    const cats = w.offer!.choices.map((id) => ARMS[id].cat);
    expect(cats).toEqual(['hand', 'gun', 'turret', 'summon', 'magic']);
  });

  it('폭탄 탭이 없으면 탭은 폭발을 만들지 않고, 번개 손이 있으면 번개가 나간다', () => {
    const w = fresh();
    w.augments.acquire('arm_cannon', w);
    w.drainEvents();
    tap(w, 100, 420);
    expect(w.drainEvents().some((e) => e.type === 'tap')).toBe(false);
    w.augments.acquire('arm_zap', w);
    tap(w, 100, 420);
    const evs = w.drainEvents();
    expect(evs.some((e) => e.type === 'bolt')).toBe(true);
    expect(evs.some((e) => e.type === 'tap')).toBe(false);
  });

  it('무기마다 혼자서 적에게 피해를 준다 (손공격은 탭, 나머지는 저절로)', () => {
    for (const d of ARSENAL) {
      const info = ARMS[d.id];
      if (info.cat === 'passive') continue;
      const w = fresh();
      w.augments.acquire(d.id, w);
      const hurt = () => w.kills > 0 || w.enemies.some((e) => e.hp < e.maxHp);
      for (let i = 0; i < 40 && !hurt(); i++) {
        if (info.cat === 'hand') {
          w.gauge = 1;
          tap(w, 160, 420);
        }
        stepFor(w, info.cat === 'hand' ? 0.6 : 1);
      }
      expect(hurt(), d.name).toBe(true);
    }
  });

  it('무기 칸이 다 차면 새 무기는 안 나오고, 최대 레벨 무기는 다시 안 나온다', () => {
    const w = fresh();
    const weapons = ARSENAL.filter((d) => ARMS[d.id].cat !== 'passive').slice(0, WEAPON_SLOTS);
    for (const d of weapons) for (let i = 0; i < MAX_LEVEL; i++) w.augments.acquire(d.id, w);
    for (let k = 0; k < 30; k++) {
      for (const id of w.chaos!.roll('level')) {
        const info = ARMS[id];
        if (!info) continue;
        expect(info.cat === 'passive' || weapons.some((d) => d.id === id)).toBe(true);
        expect(w.augments.stacks(id)).toBeLessThan(MAX_LEVEL);
      }
    }
  });

  it('자동 무기는 사거리 밖의 적은 쏘지 않는다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const far = w.spawnEnemy('normal', 180, 60)!;
    freeze(w);
    w.augments.acquire('arm_pistol', w);
    stepFor(w, 3);
    expect(far.hp).toBe(far.maxHp);
    far.y = 420;
    stepFor(w, 3);
    expect(far.dead || far.hp < far.maxHp).toBe(true);
  });

  it('황금 쿠키를 누르면 그 탭은 쏘지 않고 버프를 받는다', () => {
    const w = arena();
    w.chaos!.startEvent('cookie');
    const cookie = w.chaos!.actors.find((a) => a.kind === 'cookie')!;
    w.drainEvents();
    w.gauge = 1;
    w.step(FIXED_DT, [{ t: 'press', x: cookie.x, y: cookie.y }, { t: 'release', x: cookie.x, y: cookie.y }]);
    const evs = w.drainEvents();
    expect(evs.some((e) => e.type === 'cookie')).toBe(true);
    expect(evs.some((e) => e.type === 'tap')).toBe(false);
  });

  it('짧은 시간에 많이 잡으면 피버, 피버 중 폭탄 탭은 두 배', () => {
    const w = arena();
    w.chaos!.heat = C.feverThreshold + 1;
    stepFor(w, 0.05);
    expect(w.chaos!.fever).toBeGreaterThan(0);
    const shot = { x: 0, y: 0, power: 1, radius: 60, damage: 10, depth: 1, delay: 0, tag: {}, cancel: false };
    w.chaos!.onFire(shot);
    expect(shot.damage).toBeCloseTo(10 * C.feverDamage);
    expect(shot.depth).toBe(2);
  });

  it('곱하기 게이트를 지난 포탄은 늘어난다', () => {
    const w = arena();
    w.augments.acquire('arm_gate', w);
    stepFor(w, 0.05);
    const g = w.chaos!.gate!;
    expect(g.mult).toBe(2);
    (w.chaos as unknown as { lob(k: string, x: number, y: number, tx: number, ty: number, s: number): void }).lob('shell', g.x, g.y + 40, g.x, g.y - 120, 400);
    stepFor(w, 0.2);
    expect(w.chaos!.actors.filter((a) => a.kind === 'shell').length).toBe(2);
  });

  it('무기 정의마다 카테고리·이모지가 있고 레벨은 5까지', () => {
    for (const d of ARSENAL) {
      expect(ARMS[d.id], d.id).toBeDefined();
      expect(d.maxStacks).toBe(MAX_LEVEL);
      expect(d.tag).toBeTruthy();
    }
  });

  it('봇이 도파민 모드 한 판을 끝까지 돌려도 터지지 않고, 판 끝엔 무기가 여럿이다', () => {
    const w = new World({ ...createRunConfig(defaultSave(), 'chapter', 5, 'ch1'), rules: { chaos: true }, recordEvents: false });
    const bot = new Bot({ seed: 5 });
    for (let i = 0; i < 60 * 60 * 8 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
    expect(w.phase).toBe('ended');
    expect(w.chaos!.owned().filter((id) => ARMS[id].cat !== 'passive').length).toBeGreaterThanOrEqual(4);
  });
});
