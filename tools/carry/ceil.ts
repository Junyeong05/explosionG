/**
 * 천장 후보 측정: 짝마다 같은 두 무기를 따로 / v3 공통 규칙 / 천장 후보 로 18초 두 판씩.
 *   npx tsx tools/carry/ceil.ts            표
 *   npx tsx tools/carry/ceil.ts --write    미리보기용 결과 파일도
 */
import { writeFileSync } from 'node:fs';
import { CEIL_KEYS } from '../../src/data/combineCeil';
import { HELPER, inputFor, samplesV2 } from '../../src/data/combineV2';
import type { AttackCat } from '../../src/data/links';
import { run2 } from './check2';

export function measureCeil(key: string): { apart: number; v3: number; ceil: number; fired: number; leaksApart: number; leaksV3: number; leaksCeil: number } {
  const [a, b] = key.split('>') as [AttackCat, AttackCat];
  const [A, B] = samplesV2(a, b);
  const input = inputFor(a, b);
  const extra = HELPER[a] ? [HELPER[a]!] : [];
  const ws = [A, B, ...extra];
  let apart = 0, v3 = 0, ceil = 0, fired = 0, la = 0, lv = 0, lc = 0;
  for (const seed of [12, 31]) {
    const s = run2(ws, [], { input, seed });
    const f = run2(ws, [[A, B]], { input, seed, mode: 3 });
    const c = run2(ws, [[A, B]], { input, seed, mode: 3, ceil: true });
    apart += s.kills; v3 += f.kills; ceil += c.kills; fired += c.fired;
    la += s.leaks; lv += f.leaks; lc += c.leaks;
  }
  return { apart, v3, ceil, fired, leaksApart: la, leaksV3: lv, leaksCeil: lc };
}

if (process.argv[1]?.endsWith('ceil.ts')) {
  const res: Record<string, [number, number, number]> = {};
  for (const k of CEIL_KEYS) {
    const r = measureCeil(k);
    const rv = r.v3 / Math.max(1, r.apart);
    const rc = r.ceil / Math.max(1, r.apart);
    res[k] = [rv, rc, r.fired];
    console.log(`${k.padEnd(15)} 따로 ${String(r.apart).padStart(3)} | v3 ${String(r.v3).padStart(3)} (×${rv.toFixed(2)}) | 천장 ${String(r.ceil).padStart(3)} (×${rc.toFixed(2)}) 해냄 ${r.fired} | 놓침 ${r.leaksApart}/${r.leaksV3}/${r.leaksCeil}`);
  }
  if (process.argv.includes('--write')) {
    const lines = Object.entries(res).map(([k, [v, c, n]]) => `  '${k}': [${v.toFixed(2)}, ${c.toFixed(2)}, ${n}],`);
    writeFileSync('tools/showcase/pages/ceil-results.ts', `// npx tsx tools/carry/ceil.ts --write 로 만든 측정값: [v3 처치 ÷ 따로, 천장 처치 ÷ 따로, 천장이 해낸 횟수] (18초 두 판)\nexport const CEIL_RESULTS: Record<string, [number, number, number]> = {\n${lines.join('\n')}\n};\n`);
  }
}
