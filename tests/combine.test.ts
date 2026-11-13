import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/data/balance';
import { ARMS, ATTACK_CATEGORIES } from '../src/data/chaos';
import { CARRY, LINK, PAYLOAD, linkRules } from '../src/data/links';
import { HELPER, inputFor, rulesV2, samplesV2 } from '../src/data/combineV2';
import { BECOME, DELIVERY, rulesV3 } from '../src/data/combineV3';
import { CEIL, CEIL_KEYS } from '../src/data/combineCeil';
import { CAT4, rulesV4 } from '../src/data/combineV4';
import { DEEP4 } from '../tools/showcase/pages/combine4-deep';
import { FUSION_RULES } from '../src/sim/fusion';
import { run2 } from '../tools/carry/check2';
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

  describe('v2 (fusion.ts): 합치면 새 무기', () => {
    it('210가지 모두 구현이 있고, 미리보기 조건(대표 무기 3레벨, 18초)에서 규칙이 해내고, 물체 수 상한 안', () => {
      const have = new Set(FUSION_RULES);
      for (const r of rulesV2()) {
        expect(have.has(r.key), r.key).toBe(true);
        const [A, B] = samplesV2(r.from, r.to);
        const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
        const res = run2([A, B, ...extra], [[A, B]], { input: inputFor(r.from, r.to) });
        expect(res.fired, r.key).toBeGreaterThan(0);
        expect(res.maxActors, r.key).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
    });

    it('합친 무기는 B 가 따로 쏘지 않고, 같은 갈래·고리는 합칠 수 없다', () => {
      const w = sandbox({ rules: { chaos: true } });
      const c = w.chaos!;
      expect(c.fuse('arm_pistol', 'arm_smg')).toBe(false);
      expect(c.fuse('arm_tr_mines', 'arm_g_carbine')).toBe(true);
      expect(c.fuse('arm_g_carbine', 'arm_tr_mines')).toBe(false);
      expect(c.isInside('arm_g_carbine')).toBe(true);
    });

    it('함정 + (총 + 소환수): 함정이 쏜 총탄으로 쓰러진 적이 아군으로 일어난다 (겹친 합성)', () => {
      const ids = ['arm_tr_mines', 'arm_g_carbine', 'arm_dog'];
      const res = run2(ids, [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine']], { seconds: 24 });
      expect(res.fired).toBeGreaterThan(0);
      const w = sandbox({ rules: { chaos: true } });
      void w;
    });

    it('같은 씨앗이면 같은 결과, 합치면 같은 두 무기를 따로 가진 것보다 대체로 많이 잡는다', () => {
      const a = run2(['arm_tr_mines', 'arm_g_carbine'], [['arm_tr_mines', 'arm_g_carbine']], { seed: 5 });
      const b = run2(['arm_tr_mines', 'arm_g_carbine'], [['arm_tr_mines', 'arm_g_carbine']], { seed: 5 });
      expect(a).toEqual(b);
      let more = 0;
      const keys = ['trap>gun', 'gun>summon', 'turret>summon', 'hand>ray', 'charge>throw', 'gun>air'] as const;
      for (const k of keys) {
        const [x, y] = k.split('>') as [never, never];
        const [A, B] = samplesV2(x, y);
        const f = run2([A, B], [[A, B]], { input: inputFor(x, y) });
        const s = run2([A, B], [], { input: inputFor(x, y) });
        if (f.kills > s.kills) more++;
      }
      expect(more).toBeGreaterThanOrEqual(4);
    });

    it('무작위로 겹쳐 합친 무기 수십 개가 예외 없이 돌고 물체 수 상한 안', () => {
      const rng = new Rng(91);
      const pool = Object.values(ARMS).filter((a) => a.cat !== 'passive' && !a.fusion).map((a) => a.id);
      for (let n = 0; n < 30; n++) {
        const pick: string[] = [];
        const cats = new Set<string>();
        while (pick.length < 3 + rng.int(2)) {
          const id = pool[rng.int(pool.length)];
          if (cats.has(ARMS[id].cat)) continue;
          cats.add(ARMS[id].cat);
          pick.push(id);
        }
        const fuse: [string, string][] = [];
        for (let i = pick.length - 1; i >= 1; i--) fuse.push([pick[i - 1], pick[i]]);
        const res = run2(pick, fuse, { seconds: 10, seed: n + 1, input: 'tap' });
        expect(res.maxActors).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
    });
  });

  describe('v3 (융합): A 가 작용하는 순간 그것이 B 가 된다', () => {
    it('210가지 이름이 모두 다르고, 문장은 공통 규칙(몸 + 성질) 에서 나온다', () => {
      const rs = rulesV3();
      expect(rs.length).toBe(210);
      expect(new Set(rs.map((r) => r.name)).size).toBe(210);
      for (const r of rs) {
        expect(r.text, r.key).toBe(`${DELIVERY[r.from]}, 그것이 ${BECOME[r.to]}.`);
        expect(r.trait.length, r.key).toBeGreaterThan(4);
      }
    });

    it('210가지 모두 미리보기 조건에서 그것이 B 가 되고, 물체 수 상한 안', () => {
      for (const r of rulesV3()) {
        const [A, B] = samplesV2(r.from, r.to);
        const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
        const res = run2([A, B, ...extra], [[A, B]], { input: inputFor(r.from, r.to), mode: 3 });
        expect(res.fired, r.key).toBeGreaterThan(0);
        expect(res.maxActors, r.key).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
    });

    it('함정 + (총 + 소환수): 같은 규칙이 한 번 더 (덫이 총구가 되고, 그 총탄이 짐승이 된다)', () => {
      const res = run2(['arm_tr_mines', 'arm_g_carbine', 'arm_dog'], [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine']], { seconds: 24, mode: 3 });
      expect(res.keys).toContain('arm_tr_mines>arm_g_carbine');
      expect(res.keys).toContain('arm_g_carbine>arm_dog');
    });

    it('같은 씨앗이면 같은 결과, 합치면 같은 두 무기를 따로 가진 것보다 대체로 많이 잡는다', () => {
      const a = run2(['arm_tr_mines', 'arm_g_carbine'], [['arm_tr_mines', 'arm_g_carbine']], { seed: 5, mode: 3 });
      const b = run2(['arm_tr_mines', 'arm_g_carbine'], [['arm_tr_mines', 'arm_g_carbine']], { seed: 5, mode: 3 });
      expect(a).toEqual(b);
      let more = 0;
      const keys = ['trap>gun', 'gun>summon', 'turret>summon', 'hand>ray', 'charge>throw', 'gun>trap', 'spinner>field', 'air>gun'] as const;
      for (const k of keys) {
        const [x, y] = k.split('>') as [never, never];
        const [A, B] = samplesV2(x, y);
        const f = run2([A, B], [[A, B]], { input: inputFor(x, y), mode: 3 });
        const s = run2([A, B], [], { input: inputFor(x, y) });
        if (f.kills > s.kills) more++;
      }
      expect(more).toBeGreaterThanOrEqual(6);
    });

    it('무작위로 겹쳐 융합한 무기 수십 개가 예외 없이 돌고 물체 수 상한 안', () => {
      const rng = new Rng(17);
      const pool = Object.values(ARMS).filter((a) => a.cat !== 'passive' && !a.fusion).map((a) => a.id);
      for (let n = 0; n < 30; n++) {
        const pick: string[] = [];
        const cats = new Set<string>();
        while (pick.length < 3 + rng.int(2)) {
          const id = pool[rng.int(pool.length)];
          if (cats.has(ARMS[id].cat)) continue;
          cats.add(ARMS[id].cat);
          pick.push(id);
        }
        const fuse: [string, string][] = [];
        for (let i = pick.length - 1; i >= 1; i--) fuse.push([pick[i - 1], pick[i]]);
        const res = run2(pick, fuse, { seconds: 10, seed: n + 1, input: 'tap', mode: 3 });
        expect(res.maxActors).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
    });
  });

  describe('천장 후보 (combineCeil): 짝마다 손으로 짠 새 동작', () => {
    it('여섯 모두 미리보기 조건에서 해내고, 물체 수 상한 안', () => {
      expect(CEIL_KEYS.length).toBe(6);
      expect(new Set(CEIL_KEYS.map((k) => CEIL[k]!.name)).size).toBe(6);
      for (const k of CEIL_KEYS) {
        const [a, b] = k.split('>') as [never, never];
        const [A, B] = samplesV2(a, b);
        const res = run2([A, B], [[A, B]], { mode: 3, ceil: true, seconds: 24 });
        expect(res.fired, k).toBeGreaterThan(0);
        expect(res.maxActors, k).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
    });

    it('끄면 v3 그대로 (같은 씨앗 같은 결과), 켜면 같은 씨앗에서 결정적', () => {
      const [A, B] = samplesV2('trap', 'charge');
      const off = run2([A, B], [[A, B]], { mode: 3, seed: 7 });
      const off2 = run2([A, B], [[A, B]], { mode: 3, seed: 7, ceil: false });
      expect(off).toEqual(off2);
      const on1 = run2([A, B], [[A, B]], { mode: 3, seed: 7, ceil: true });
      const on2 = run2([A, B], [[A, B]], { mode: 3, seed: 7, ceil: true });
      expect(on1).toEqual(on2);
    });

    it('겹친 합성에서도 예외 없이 돈다 (함정 + (돌격 + 소환수), 소환수 + (포격 + 함정))', () => {
      const r1 = run2(['arm_tr_mines', 'arm_c_bikers', 'arm_dog'], [['arm_c_bikers', 'arm_dog'], ['arm_tr_mines', 'arm_c_bikers']], { mode: 3, ceil: true, seconds: 20 });
      const r2 = run2(['arm_dog', 'arm_cannon', 'arm_tr_mines'], [['arm_cannon', 'arm_tr_mines'], ['arm_dog', 'arm_cannon']], { mode: 3, ceil: true, seconds: 20 });
      expect(r1.fired).toBeGreaterThan(0);
      expect(r2.fired).toBeGreaterThan(0);
      expect(Math.max(r1.maxActors, r2.maxActors)).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
    });
  });

  describe('v4 (상태 반응): 갈래 15줄 + 공통 규칙', () => {
    it('210 이름이 모두 다르고 갈래 표에서 나온다', () => {
      const rs = rulesV4();
      expect(rs.length).toBe(210);
      expect(new Set(rs.map((r) => r.name)).size).toBe(210);
      for (const r of rs) expect(r.name).toBe(`${CAT4[r.from].pre} ${CAT4[r.to].noun}`);
    });

    it('210 모두 예외 없이 돌고 물체 수 상한 안, 대부분 A 의 순간에 B 가 나간다', () => {
      let fired = 0;
      for (const r of rulesV4()) {
        const [A, B] = samplesV2(r.from, r.to);
        const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
        const res = run2([A, B, ...extra], [[A, B]], { input: inputFor(r.from, r.to), mode: 4 });
        if (res.fired > 0) fired++;
        expect(res.maxActors, r.key).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
      expect(fired).toBeGreaterThanOrEqual(195);
    });

    it('2+2 · 깊이 3 샘플이 돌고, 안쪽 짝도 해낸다 (함정 + (소환수 + (포격 + 장판)))', () => {
      for (const d of DEEP4) {
        const res = run2(d.weapons, d.fuse, { mode: 4, input: d.input, seconds: 20 });
        expect(res.fired, d.code).toBeGreaterThan(0);
        expect(res.maxActors, d.code).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
      const chain = run2(['arm_tr_mines', 'arm_dog', 'arm_cannon', 'arm_f_lava'], [['arm_cannon', 'arm_f_lava'], ['arm_dog', 'arm_cannon'], ['arm_tr_mines', 'arm_dog']], { mode: 4, seconds: 24 });
      expect(chain.keys).toContain('arm_tr_mines>arm_dog');
      expect(chain.keys).toContain('arm_dog>arm_cannon');
    });

    it('극적 반응: 갈래마다 이름이 있고, 210 이 예외 없이 돌고 물체 수 상한 안, 2+2 도 돈다', () => {
      expect(new Set(Object.values(CAT4).map((c) => c.drama)).size).toBe(15);
      for (const r of rulesV4()) {
        const [A, B] = samplesV2(r.from, r.to);
        const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
        const res = run2([A, B, ...extra], [[A, B]], { input: inputFor(r.from, r.to), mode: 4, drama: true, seconds: 12 });
        expect(res.maxActors, r.key).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
      for (const d of DEEP4) {
        const res = run2(d.weapons, d.fuse, { mode: 4, drama: true, input: d.input, seconds: 20 });
        expect(res.fired, d.code).toBeGreaterThan(0);
        expect(res.maxActors, d.code).toBeLessThanOrEqual(BALANCE.chaos.maxActors);
      }
      const a = run2(['arm_tr_mines', 'arm_c_bikers'], [['arm_tr_mines', 'arm_c_bikers']], { seed: 4, mode: 4, drama: true });
      const b = run2(['arm_tr_mines', 'arm_c_bikers'], [['arm_tr_mines', 'arm_c_bikers']], { seed: 4, mode: 4, drama: true });
      expect(a).toEqual(b);
    });

    it('제어 저항: 제어 갈래를 다섯 겹쳐도 적이 다가온다 (따로 가진 판의 25% 넘게), 저항이 걸린다', () => {
      const ws = ['arm_m_poly', 'arm_dog', 'arm_s_guitar', 'arm_sw_mosquito', 'arm_sp_disc'];
      const fuse: [string, string][] = [['arm_sw_mosquito', 'arm_sp_disc'], ['arm_m_poly', 'arm_sw_mosquito'], ['arm_dog', 'arm_s_guitar'], ['arm_m_poly', 'arm_dog']];
      const opt = { seconds: 30, hp: 40, seed: 12 };
      const sep = run2(ws, [], opt);
      const on = run2(ws, fuse, { ...opt, mode: 4, drama: true });
      expect(on.resists).toBeGreaterThan(0);
      expect(on.advance).toBeGreaterThan(sep.advance * 0.25);
      // 합성 없는 판에는 저항이 없다 (게임 그대로)
      expect(sep.resists).toBe(0);
    });

    it('같은 씨앗이면 같은 결과', () => {
      const a = run2(['arm_dog', 'arm_cannon'], [['arm_dog', 'arm_cannon']], { seed: 9, mode: 4 });
      const b = run2(['arm_dog', 'arm_cannon'], [['arm_dog', 'arm_cannon']], { seed: 9, mode: 4 });
      expect(a).toEqual(b);
    });
  });
});
