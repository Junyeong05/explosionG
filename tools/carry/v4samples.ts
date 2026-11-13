/**
 * v4 샘플 측정: 2+2 와 깊은 조합 (같은 무기를 따로 가진 판 대비, 18초 두 판). 미리보기 combine4 가 읽는다.
 *   npx tsx tools/carry/v4samples.ts --write
 */
import { writeFileSync } from 'node:fs';
import { run2 } from './check2';
import { DEEP4 } from '../showcase/pages/combine4-deep';

if (process.argv[1]?.endsWith('v4samples.ts')) {
  const drama = process.argv.includes('--drama');
  const res: Record<string, [number, number]> = {};
  for (const d of DEEP4) {
    let f = 0;
    let s = 0;
    let fired = 0;
    for (const seed of [12, 31]) {
      const a = run2(d.weapons, d.fuse, { seed, mode: 4, input: d.input, drama });
      const b = run2(d.weapons, [], { seed, input: d.input });
      f += a.kills;
      s += b.kills;
      fired += a.fired;
    }
    res[d.code] = [f / Math.max(1, s), fired];
    console.log(`${d.title.padEnd(28)} 처치 ${f} / 따로 ${s} (×${(f / Math.max(1, s)).toFixed(2)}) 해냄 ${fired}`);
  }
  if (process.argv.includes('--write')) {
    const lines = Object.entries(res).map(([k, [r, n]]) => `  '${k}': [${r.toFixed(2)}, ${n}],`);
    writeFileSync(drama ? 'tools/showcase/pages/combine4d-deep-results.ts' : 'tools/showcase/pages/combine4-deep-results.ts', `// npx tsx tools/carry/v4samples.ts --write${drama ? ' --drama' : ''}: [처치 ÷ 따로, 해낸 횟수] (18초 두 판)\nexport const ${drama ? 'DEEP4D_RESULTS' : 'DEEP4_RESULTS'}: Record<string, [number, number]> = {\n${lines.join('\n')}\n};\n`);
  }
}
