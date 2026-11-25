/**
 * 레드팀 측정 (11-25 회의): 같은 갈래 짝에서 무기만 바꾸면 얼마나 벌어지나 (성질 13 · 무기 수치).
 *   npx tsx tools/meeting/red-weapons.ts <A 갈래> <B 갈래>
 * A 는 대표 무기, B 는 그 갈래 무기 전부. 둘 다 L3, 폭=칸 등급, 18초 두 판.
 */
import { ARMS } from '../../src/data/chaos';
import { inputFor } from '../../src/data/combineV2';
import { traitOf } from '../../src/data/combineV4';
import { SAMPLE } from '../../src/data/links';
import { run2 } from '../carry/check2';
const [ca, cb] = process.argv.slice(2);
const A = (SAMPLE as Record<string, string>)[ca];
const Bs = Object.values(ARMS).filter((w) => w.cat === cb && !w.fusion).map((w) => w.id);
const rows: [string, string, number, number][] = [];
for (const B of Bs) {
  let f = 0, s = 0;
  for (const seed of [12, 31]) {
    f += run2([A, B], [[A, B]], { input: inputFor(ca as never, cb as never), seed, mode: 4, v5: true, level: 3, fuseRule: 'width', hp: 7 }).kills;
    s += run2([A, B], [], { input: inputFor(ca as never, cb as never), seed, level: 3, hp: 7 }).kills;
  }
  rows.push([B, traitOf(B) ?? '-', f, f / Math.max(1, s)]);
}
rows.sort((x, y) => y[2] - x[2]);
const ks = rows.map((r) => r[2]);
console.log(`${ca}>${cb} (B ${rows.length}종): 처치 최대 ${ks[0]} · 가운데 ${ks[Math.floor(ks.length / 2)]} · 최소 ${ks[ks.length - 1]} · 최대/최소 ×${(ks[0] / Math.max(1, ks[ks.length - 1])).toFixed(2)}`);
const byT = new Map<string, number[]>();
for (const r of rows) byT.set(r[1], [...(byT.get(r[1]) ?? []), r[2]]);
console.log('성질별 가운데:', [...byT].map(([t, v]) => [t, [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)], v.length] as const).sort((a, b) => b[1] - a[1]).map(([t, v, n]) => `${t} ${v}(${n})`).join(' · '));
console.log('위 3:', rows.slice(0, 3).map((r) => `${ARMS[r[0]].name}[${r[1]}] ${r[2]} ×${r[3].toFixed(2)}`).join(' | '), ' 아래 3:', rows.slice(-3).map((r) => `${ARMS[r[0]].name}[${r[1]}] ${r[2]} ×${r[3].toFixed(2)}`).join(' | '));
