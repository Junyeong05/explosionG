/**
 * 합성 v5 측정: 210 짝을 v4 극적 반응과 v5 (한 몸 · 무기 성질 · 공명) 로 나란히 돌린다.
 *   npx tsx tools/carry/v5.ts [--write] [from>to]
 * 짝마다 대표 무기 3레벨, 적 14마리 유지, 18초 두 판 (씨앗 12·31). 도우미 무기 없이 합친 무기만.
 * - 넘침 몫: B 가 A 의 순간이 아니라 따로 나간 몫 (v4). v5 는 따로 안 나가고 A 를 당긴다(boost)
 * - 반응 몫: B 가 나간 것 가운데 극적 반응이 된 몫
 * - 처치 비율: 합침 ÷ 같은 두 무기를 따로
 */
import { writeFileSync } from 'node:fs';
import { inputFor, rulesV2, samplesV2 } from '../../src/data/combineV2';
import { fuseName, reactName } from '../../src/data/combineV4';
import { run2, type Run2 } from './check2';
import { GROUPS, groupPairs } from './v5groups';

export interface V5Row {
  key: string;
  r4: number;
  r5: number;
  over4: number;
  over5: number;
  react4: number;
  react5: number;
  fires4: number;
  fires5: number;
  boost5: number;
  res5: number;
  leaks4: number;
  leaks5: number;
}

const sum = (rs: Run2[]) => {
  let fires = 0;
  let drama = 0;
  let over = 0;
  let boost = 0;
  for (const r of rs)
    for (const s of r.stat.values()) {
      fires += s.fires;
      drama += s.drama;
      over += s.over ?? 0;
      boost += s.boost ?? 0;
    }
  return { fires, drama, over, boost, kills: rs.reduce((a, r) => a + r.kills, 0), leaks: rs.reduce((a, r) => a + r.leaks, 0), res: rs.reduce((a, r) => a + r.resonances, 0) };
};

export function measureV5(key: string): V5Row {
  const [from, to] = key.split('>') as [never, never];
  const [A, B] = samplesV2(from, to);
  const input = inputFor(from, to);
  const seeds = [12, 31];
  const f4 = sum(seeds.map((seed) => run2([A, B], [[A, B]], { input, seed, mode: 4, drama: true })));
  const f5 = sum(seeds.map((seed) => run2([A, B], [[A, B]], { input, seed, mode: 4, v5: true })));
  const ap = sum(seeds.map((seed) => run2([A, B], [], { input, seed })));
  const k = Math.max(1, ap.kills);
  return {
    key,
    r4: f4.kills / k,
    r5: f5.kills / k,
    over4: f4.over / Math.max(1, f4.fires),
    over5: f5.over / Math.max(1, f5.fires),
    react4: f4.drama / Math.max(1, f4.fires),
    react5: f5.drama / Math.max(1, f5.fires),
    fires4: f4.fires,
    fires5: f5.fires,
    boost5: f5.boost,
    res5: f5.res,
    leaks4: f4.leaks,
    leaks5: f5.leaks,
  };
}

/** 무기 짝 하나를 v5 로 (따로 가진 판 대비), 18초 두 판 */
export function measurePair(A: string, B: string): { ratio: number; react: number; res: number } {
  const seeds = [12, 31];
  const f = sum(seeds.map((seed) => run2([A, B], [[A, B]], { seed, mode: 4, v5: true })));
  const ap = sum(seeds.map((seed) => run2([A, B], [], { seed })));
  return { ratio: f.kills / Math.max(1, ap.kills), react: f.drama / Math.max(1, f.fires), res: f.res };
}

if (process.argv[1]?.endsWith('v5.ts') && process.argv.includes('--groups')) {
  const out: Record<string, { ratio: number; react: number; res: number }> = {};
  for (const [a, b] of GROUPS)
    for (const [A, B] of groupPairs(a, b)) {
      const r = measurePair(A, B);
      out[`${A}>${B}`] = { ratio: +r.ratio.toFixed(3), react: +r.react.toFixed(3), res: r.res };
      console.log(`${a}>${b}  ${fuseName(A, B).padEnd(14)} ${reactName(B).padEnd(14)} ×${r.ratio.toFixed(2)}  반응 ${(r.react * 100).toFixed(0)}%  공명 ${r.res}`);
    }
  writeFileSync('tools/showcase/pages/fuse5-groups.ts', `// npx tsx tools/carry/v5.ts --groups 로 만든 측정값 (무기 짝마다 18초 두 판)\nexport const GROUP5: Record<string, { ratio: number; react: number; res: number }> = ${JSON.stringify(out, null, 1)};\n`);
} else if (process.argv[1]?.endsWith('v5.ts')) {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const rows = rulesV2().filter((r) => !arg || r.key === arg);
  const out: V5Row[] = [];
  const t0 = Date.now();
  for (const r of rows) {
    const x = measureV5(r.key);
    out.push(x);
    console.log(`${x.key.padEnd(16)} ×${x.r4.toFixed(2)} → ×${x.r5.toFixed(2)}  넘침 ${(x.over4 * 100).toFixed(0)}% → ${(x.over5 * 100).toFixed(0)}%  반응 ${(x.react4 * 100).toFixed(0)}% → ${(x.react5 * 100).toFixed(0)}%  B ${x.fires4}→${x.fires5}  당김 ${x.boost5}  공명 ${x.res5}  놓침 ${x.leaks4}→${x.leaks5}`);
  }
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
  const tot = (f: (x: V5Row) => number) => out.reduce((a, x) => a + f(x), 0);
  console.log(`\n${out.length}짝 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  console.log(`처치 비율 가운데값 v4 ×${med(out.map((x) => x.r4)).toFixed(2)} → v5 ×${med(out.map((x) => x.r5)).toFixed(2)} · 1 아래 ${out.filter((x) => x.r4 < 1).length} → ${out.filter((x) => x.r5 < 1).length}`);
  console.log(`B 가 따로 나간 몫(넘침) v4 ${((tot((x) => x.over4 * x.fires4) / tot((x) => x.fires4)) * 100).toFixed(0)}% → v5 ${((tot((x) => x.over5 * x.fires5) / tot((x) => x.fires5)) * 100).toFixed(0)}% (방어선 가까이만 · 나머지는 A 를 당김 ${tot((x) => x.boost5)}번) · 넘침 50% 넘는 짝 ${out.filter((x) => x.over4 > 0.5).length} → ${out.filter((x) => x.over5 > 0.5).length}`);
  console.log(`극적 반응 몫 v4 ${((tot((x) => x.react4 * x.fires4) / tot((x) => x.fires4)) * 100).toFixed(0)}% → v5 ${((tot((x) => x.react5 * x.fires5) / tot((x) => x.fires5)) * 100).toFixed(0)}%`);
  console.log(`B 가 한 번도 안 나간 짝 v4 ${out.filter((x) => x.fires4 === 0).length} → v5 ${out.filter((x) => x.fires5 === 0).length}`);
  console.log(`공명 터진 짝 ${out.filter((x) => x.res5 > 0).length} / ${out.length} · 판당 평균 ${mean(out.map((x) => x.res5 / 2)).toFixed(2)}번`);
  console.log(`놓침 v4 ${tot((x) => x.leaks4)} → v5 ${tot((x) => x.leaks5)}`);
  if (process.argv.includes('--write'))
    writeFileSync('tools/showcase/pages/fuse5-results.ts', `// npx tsx tools/carry/v5.ts --write 로 만든 측정값 (210짝, 18초 두 판)\nimport type { V5Row } from '../../carry/v5';\nexport const V5ROWS: V5Row[] = ${JSON.stringify(out.map((x) => ({ ...x, r4: +x.r4.toFixed(3), r5: +x.r5.toFixed(3), over4: +x.over4.toFixed(3), over5: +x.over5.toFixed(3), react4: +x.react4.toFixed(3), react5: +x.react5.toFixed(3) })))};\n`);
}
