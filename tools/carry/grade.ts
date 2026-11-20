/**
 * 합성 한 번이 얼마나 세지나 (등급별): 210 갈래 짝을 두 무기 같은 레벨 L 로, 합침 ÷ 따로 처치 비율.
 *   npx tsx tools/carry/grade.ts ['{"2":0.8,"3":1,"4":1.4,"5":2.1}']   (등급 배율 표, 폭=칸 규칙)
 * 대표 무기, 적 14 유지, 18초 두 판. 같은 레벨 따로 가진 판과 비교하므로 "그 레벨에서 합성 카드 한 장의 값".
 */
import { inputFor, rulesV2, samplesV2 } from '../../src/data/combineV2';
import { GRADE_MUL } from '../../src/data/fuseRules';
import { run2 } from './check2';

const table = JSON.parse(process.argv[2] ?? 'null') as Record<string, number> | null;
if (table) for (const [k, v] of Object.entries(table)) (GRADE_MUL as Record<number, number>)[Number(k)] = v;
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const keys = rulesV2().filter((_, i) => i % 3 === 0);
const HP: Record<number, number> = { 2: 5, 3: 7, 4: 10, 5: 14 };
const sepK: Record<number, number> = {};
const out: string[] = [];
for (const L of [2, 3, 4, 5]) {
  const rs: number[] = [];
  for (const r of keys) {
    const [A, B] = samplesV2(r.from, r.to);
    const input = inputFor(r.from, r.to);
    let f = 0, s = 0;
    // 적 체력을 레벨에 맞춰 (높은 레벨에서 처치 수가 상한에 막히지 않게)
    const hp = HP[L];
    for (const seed of [12, 31]) {
      f += run2([A, B], [[A, B]], { input, seed, mode: 4, v5: true, level: L, fuseRule: 'width', hp }).kills;
      s += run2([A, B], [], { input, seed, level: L, hp }).kills;
    }
    sepK[L] = (sepK[L] ?? 0) + s;
    rs.push(f / Math.max(1, s));
  }
  out.push(`레벨 ${L} (등급 ×${GRADE_MUL[L]}, 적 체력 ×${HP[L]}): 합침 ÷ 따로 가운데값 ×${med(rs).toFixed(2)} · 1 아래 ${rs.filter((x) => x < 1).length}/${rs.length} · 따로 처치 짝당 ${(sepK[L] / keys.length / 2).toFixed(0)}`);
}
console.log(out.join('\n'));
