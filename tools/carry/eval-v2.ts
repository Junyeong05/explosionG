/**
 * 합성 v2 자체 평가 (2026-11-10): 대표 무기 카드로는 안 보이는 두 가지를 잰다.
 *   1) 같은 갈래의 다른 모양 무기로 바꿔도 A 쪽 규칙이 걸리나 (공중 낙하·번개·레이저 기둥…)
 *   2) 겹친 합성 A + (B + C) 에서 안쪽 B>C 규칙이 걸리나 (B 가 A 를 통해 나올 때)
 *   npx tsx tools/carry/eval-v2.ts
 */
import { ARMS, ATTACK_CATEGORIES } from '../../src/data/chaos';
import { HELPER, inputFor, rulesV2, samplesV2 } from '../../src/data/combineV2';
import { SAMPLE, type AttackCat } from '../../src/data/links';
import { World } from '../../src/sim/World';
import { run2 } from './check2';

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];

// 1) 갈래 안 무기 모양마다
const byKind = new Map<string, string[]>();
for (const a of Object.values(ARMS)) {
  if (a.cat === 'passive' || a.fusion || a.kind === 'bomb') continue;
  const k = `${a.cat}:${a.kind}`;
  byKind.set(k, [...(byKind.get(k) ?? []), a.id]);
}
console.log('1) 같은 갈래 다른 모양 무기 (A 쪽): 모양마다 첫 무기로 14짝');
for (const cat of CATS) {
  const kinds = [...byKind.keys()].filter((k) => k.startsWith(cat + ':'));
  let ok = 0;
  let n = 0;
  let weaponsOk = 0;
  let weapons = 0;
  for (const k of kinds) {
    let kOk = 0;
    for (const r of rulesV2().filter((x) => x.from === cat)) {
      const [, B] = samplesV2(r.from, r.to);
      const alt = byKind.get(k)![0];
      const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
      if (run2([alt, B, ...extra], [[alt, B]], { input: inputFor(r.from, r.to) }).fired > 0) kOk++;
    }
    ok += kOk;
    n += 14;
    const nw = byKind.get(k)!.length;
    weapons += nw;
    weaponsOk += (kOk / 14) * nw;
  }
  console.log(`  ${cat.padEnd(8)} 모양 ${kinds.length}, 걸림 ${ok}/${n}, 무기로 치면 ${Math.round((weaponsOk / weapons) * 100)}%`);
}

// 2) 겹친 합성
let lastFired = new Map<string, number>();
const orig = (World.prototype as unknown as { step: (dt: number, c: unknown) => void }).step;
(World.prototype as unknown as { step: (dt: number, c: unknown) => void }).step = function (this: World, dt: number, c: unknown) {
  orig.call(this, dt, c);
  lastFired = this.chaos!.fusion.fired;
};
console.log('2) 겹친 합성 A + (B + C): 안쪽 B>C 가 걸린 판 (B 마다 A·C 를 고르게 12판)');
let all = 0;
let allOk = 0;
for (const b of CATS) {
  const combos: [AttackCat, AttackCat][] = [];
  for (const a of CATS) for (const c of CATS) if (a !== b && c !== b && a !== c) combos.push([a, c]);
  const pick = combos.filter((_, i) => i % Math.floor(combos.length / 12) === 0).slice(0, 12);
  let ok = 0;
  for (const [a, c] of pick) {
    const A = SAMPLE[a];
    const B = b === 'magic' ? 'arm_m_timestop' : SAMPLE[b];
    const C = c === 'magic' ? 'arm_m_poly' : SAMPLE[c];
    const extra = a === 'magic' || b === 'magic' ? ['arm_pistol'] : [];
    run2([A, B, C, ...extra], [[B, C], [A, B]], { input: inputFor(a, b) ?? inputFor(b, c) });
    if ((lastFired.get(`${B}>${C}`) ?? 0) > 0) ok++;
  }
  all += pick.length;
  allOk += ok;
  console.log(`  안쪽 ${b.padEnd(8)} ${ok}/${pick.length}`);
}
console.log(`  전체 ${allOk}/${all}`);
