import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { ARMS, ATTACK_CATEGORIES } from '../src/data/chaos';
import { CARRY, LINK, PAYLOAD, linkRules } from '../src/data/links';
import { rulesV2 } from '../src/data/combineV2';
import { Rng } from '../src/core/rng';
import { runCombo } from '../tools/carry/check';
import { sandbox } from './helpers';

/** 합성 (src/sim/chaos.ts attach·carry·payload, 규칙 src/data/links.ts) */
describe('합성: 갈래 둘을 합치면', () => {
  it('규칙은 갈래마다 나를 때·실릴 때 하나씩이고, 같은 갈래를 뺀 15 × 14 = 210가지', () => {
    const cats = ATTACK_CATEGORIES.filter((c) => c !== 'passive');
    expect(cats).toHaveLength(15);
    for (const c of cats) {
      expect(CARRY[c as keyof typeof CARRY].every).toBeGreaterThanOrEqual(1);
      expect(PAYLOAD[c as keyof typeof PAYLOAD].length).toBeGreaterThan(5);
    }
    const rules = linkRules();
    expect(rules).toHaveLength(210);
    expect(new Set(rules.map((r) => r.key)).size).toBe(210);
    for (const r of rules) {
      expect(ARMS[r.carrier].cat).toBe(r.from);
      expect(ARMS[r.payload].cat).toBe(r.to);
    }
  });

  it('같은 갈래끼리, 이미 실린 무기, 자기를 실은 무기를 다시 싣는 고리는 안 된다', () => {
    const w = sandbox({ rules: { chaos: true } });
    const c = w.chaos!;
    expect(c.attach('arm_pistol', 'arm_smg')).toBe(false);
    expect(c.attach('arm_pistol', 'arm_dog')).toBe(true);
    expect(c.attach('arm_tr_mines', 'arm_dog')).toBe(false);
    expect(c.attach('arm_dog', 'arm_pistol')).toBe(false);
    expect(c.attach('arm_tr_mines', 'arm_pistol')).toBe(true);
    expect(c.attach('arm_dog', 'arm_tr_mines')).toBe(false);
    expect(c.isInside('arm_dog')).toBe(true);
    expect(c.carriedBy('arm_pistol')).toEqual(['arm_dog']);
  });

  it('실린 무기는 따로 쏘지도 자리를 차지하지도 않는다', () => {
    const w = sandbox({ rules: { chaos: true } });
    (w as unknown as { offerQueue: unknown[] }).offerQueue.length = 0;
    w.augments.acquire('arm_g_carbine', w);
    w.augments.acquire('arm_laser', w);
    w.chaos!.attach('arm_g_carbine', 'arm_laser');
    for (let i = 0; i < 60; i++) w.step(1 / 60);
    expect(w.chaos!.mountOf('arm_laser')).toBeUndefined();
    expect(w.chaos!.mountOf('arm_g_carbine')).toBeDefined();
    expect(w.chaos!.actors.some((a) => a.kind === 'ray' && a.depth === 0)).toBe(false);
  });

  it('210가지 모두 미리보기 조건(대표 무기 3레벨, 18초)에서 실린 것이 열리고, 물체 수 상한을 넘지 않는다', () => {
    for (const r of linkRules()) {
      const res = runCombo([r.carrier, r.payload], [[r.carrier, r.payload]], { taps: r.from === 'hand' || r.to === 'hand' });
      expect(res.opens, r.key).toBeGreaterThan(0);
      expect(res.maxActors, r.key).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
    }
  });

  it('겹친 합성: 함정 + (총 + 소환수) 는 안쪽 총도 소환수를 연다', () => {
    const res = runCombo(['arm_tr_mines', 'arm_g_carbine', 'arm_dog'], [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine']]);
    expect(res.deep).toBeGreaterThan(0);
  });

  it(`깊이 ${LINK.maxDepth} 까지만 연다 (네 겹이면 맨 안쪽은 안 열림)`, () => {
    // 음파 > 함정 > 총 > 소환수: 함정 1, 총 2, 소환수 3
    const ids = ['arm_s_guitar', 'arm_tr_mines', 'arm_g_carbine', 'arm_dog'];
    let opened = new Map<string, number>();
    runCombo(ids, [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine'], ['arm_s_guitar', 'arm_tr_mines']], { seconds: 24, onEnd: (m) => (opened = new Map(m)) });
    expect(opened.get('arm_s_guitar>arm_tr_mines') ?? 0).toBeGreaterThan(0);
    expect(opened.get('arm_tr_mines>arm_g_carbine') ?? 0).toBeGreaterThan(0);
    expect(opened.get('arm_g_carbine>arm_dog') ?? 0).toBe(0);
  });

  it('같은 씨앗이면 같은 결과', () => {
    const a = runCombo(['arm_c_bikers', 'arm_f_lava'], [['arm_c_bikers', 'arm_f_lava']], { seed: 5 });
    const b = runCombo(['arm_c_bikers', 'arm_f_lava'], [['arm_c_bikers', 'arm_f_lava']], { seed: 5 });
    expect(a).toEqual(b);
  });

  it('한 방이 센 무기가 나르면 실린 것도 세다 (세기 k)', () => {
    const w = sandbox({ rules: { chaos: true } });
    const c = w.chaos! as unknown as { carryPower(spec: unknown): number };
    expect(c.carryPower(ARMS.arm_sniper)).toBeGreaterThan(c.carryPower(ARMS.arm_smg));
    expect(c.carryPower(ARMS.arm_smg)).toBeGreaterThanOrEqual(LINK.kMin);
    expect(c.carryPower(ARMS.arm_amr)).toBeLessThanOrEqual(LINK.kMax);
  });

  it('무작위로 겹쳐 합친 무기 수십 개가 예외 없이 돌고 물체 수 상한 안', () => {
    const rng = new Rng(77);
    const pool = Object.values(ARMS).filter((a) => a.cat !== 'passive' && !a.fusion).map((a) => a.id);
    for (let n = 0; n < 40; n++) {
      // 무기 3~5개, 서로 다른 갈래
      const pick: string[] = [];
      const cats = new Set<string>();
      while (pick.length < 3 + rng.int(3)) {
        const id = pool[rng.int(pool.length)];
        if (cats.has(ARMS[id].cat)) continue;
        cats.add(ARMS[id].cat);
        pick.push(id);
      }
      // 뒤에서부터 앞에 싣는다 (깊이 2까지 생김) + 하나는 뿌리에 하나 더
      const attach: [string, string][] = [];
      for (let i = pick.length - 1; i >= 1; i--) attach.push([pick[i - 1], pick[i]]);
      const res = runCombo(pick, attach, { seconds: 10, seed: n + 1, taps: true });
      expect(res.maxActors).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
    }
  });

  it('v2 설계: 210가지 모두 손으로 쓴 규칙이 있고 이름이 겹치지 않는다', () => {
    const r = rulesV2();
    expect(r).toHaveLength(210);
    expect(new Set(r.map((x) => x.key)).size).toBe(210);
    expect(new Set(r.map((x) => x.name)).size).toBe(210);
    for (const x of r) expect(x.text.length, x.key).toBeGreaterThan(15);
  });
});
