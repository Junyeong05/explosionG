import { describe, expect, it } from 'vitest';
import { BALANCE, FIXED_DT } from '../src/data/balance';
import { ARMS, ARSENAL, MAX_LEVEL, WEAPON_SLOTS, WEAPONS, effective } from '../src/data/chaos';
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
  it('판은 시작 무기 고르기로 시작하고, 서로 다른 갈래에서 3장이 나온다', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = sandbox({ seed, rules: { chaos: true } });
      w.step(FIXED_DT);
      expect(w.phase).toBe('choosing');
      expect(w.offer?.kind).toBe('starter');
      const cats = w.offer!.choices.map((id) => ARMS[id].cat);
      expect(cats).toHaveLength(3);
      expect(new Set(cats).size).toBe(3);
      expect(w.offer!.choices.every((id) => ARMS[id].starter)).toBe(true);
    }
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

  it('무기마다 레벨 업 효과가 다르다 (산탄총은 산탄, 저격총은 관통, 병사는 마릿수, 로켓은 연발)', () => {
    expect(effective(ARMS.arm_shotgun, 2).p.count).toBe(9);
    expect(effective(ARMS.arm_shotgun, 4).p.count).toBe(12);
    expect(effective(ARMS.arm_sniper, 2).p.pierce).toBe(3);
    expect(effective(ARMS.arm_soldier, 5).p.count).toBe(4);
    expect(effective(ARMS.arm_rocket, 4).p.burst).toBe(2);
    expect(effective(ARMS.arm_minigun, 2).cd).toBeLessThan(1);
    expect(effective(ARMS.arm_pistol, 1)).toEqual({ p: ARMS.arm_pistol.p, dmg: 1, cd: 1 });
    // 강화 말고는 전부 Lv2~5 효과 네 개, 카드에 다음 레벨 효과가 보인다
    for (const wpn of WEAPONS) {
      if (wpn.cat === 'passive') continue;
      expect(wpn.up, wpn.name).toHaveLength(4);
    }
    const shotgunCard = ARSENAL.find((d) => d.id === 'arm_shotgun')!;
    expect(shotgunCard.levelDesc?.(2)).toBe('레벨 업: 산탄 +2');
  });

  it('소환수·마법은 사거리 없이 화면 어디든 간다 (총·포탑만 사거리)', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    const far = w.spawnEnemy('normal', 180, 80)!;
    far.hp = far.maxHp = 1e6;
    freeze(w);
    w.augments.acquire('arm_meteor', w);
    w.augments.acquire('arm_cat', w);
    stepFor(w, 6);
    expect(far.hp).toBeLessThan(far.maxHp);
  });

  it('무기를 누르면 정보·사거리가 뜨고 그 탭은 공격하지 않는다, 다시 누르면 닫힌다', () => {
    const w = arena();
    w.augments.acquire('arm_pistol', w);
    w.augments.acquire('arm_zap', w);
    stepFor(w, 0.05);
    const m = w.chaos!.mountOf('arm_pistol')!;
    expect(m).toBeDefined();
    w.drainEvents();
    tap(w, m.x, m.y);
    expect(w.chaos!.selected?.id).toBe('arm_pistol');
    expect(w.drainEvents().some((e) => e.type === 'bolt' && e.kind === 'lightning')).toBe(false);
    tap(w, m.x, m.y);
    expect(w.chaos!.selected).toBeNull();
  });

  it('무기는 방어선 뒤 한 줄에 가운데부터 좌우로 놓인다 (손공격·강화는 자리 없음)', () => {
    const w = arena();
    for (const id of ['arm_pistol', 'arm_cannon', 'arm_sheep', 'arm_meteor', 'arm_zap', 'arm_power']) w.augments.acquire(id, w);
    stepFor(w, 0.05);
    const xs = ['arm_pistol', 'arm_cannon', 'arm_sheep', 'arm_meteor'].map((id) => w.chaos!.mountOf(id)!.x);
    const ys = ['arm_pistol', 'arm_cannon', 'arm_sheep', 'arm_meteor'].map((id) => w.chaos!.mountOf(id)!.y);
    expect(new Set(ys).size).toBe(1);
    expect(Math.abs(xs[0] - w.field.width / 2)).toBeLessThan(25);
    expect(xs[1]).toBeLessThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[0]);
    expect(w.chaos!.mountOf('arm_zap')).toBeUndefined();
    expect(w.chaos!.mountOf('arm_power')).toBeUndefined();
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

  it('봇이 도파민 모드 엔드리스 한 판을 끝까지 돌려도 터지지 않고, 판 끝엔 무기가 여럿이다', () => {
    const w = new World({ ...createRunConfig(defaultSave(), 'endless', 5), rules: { chaos: true }, recordEvents: false });
    const bot = new Bot({ seed: 5 });
    for (let i = 0; i < 60 * 60 * 15 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
    expect(w.phase).toBe('ended');
    expect(w.chaos!.owned().filter((id) => ARMS[id].cat !== 'passive').length).toBeGreaterThanOrEqual(4);
  });
});
