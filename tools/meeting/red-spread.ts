/**
 * 레드팀 측정 (11-25 회의): 합성 v5 + 폭=칸 등급표에서 210 짝의 편차.
 *   npx tsx tools/meeting/red-spread.ts [레벨=3] [출력 json]
 * 대표 무기 둘 다 레벨 L, 적 14 유지, 18초 두 판 (씨앗 12·31). 합침 ÷ 따로 (처치) + 합침 절대 처치 + 극적 몫 + 공명.
 */
import { writeFileSync } from 'node:fs';
import { HELPER, inputFor, rulesV2, samplesV2 } from '../../src/data/combineV2';
import { kind4 } from '../../src/data/combineV4';
import { run2 } from '../carry/check2';

const L = Number(process.argv[2] ?? 3);
const outPath = process.argv[3];
const HP: Record<number, number> = { 2: 5, 3: 7, 4: 10, 5: 14 };
const rows: { key: string; kind: string; fused: number; apart: number; ratio: number; drama: number; fires: number; res: number; leaksF: number; leaksA: number }[] = [];
for (const r of rulesV2()) {
  const [A, B] = samplesV2(r.from, r.to);
  const input = inputFor(r.from, r.to);
  const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
  let f = 0, s = 0, drama = 0, fires = 0, res = 0, lf = 0, la = 0;
  for (const seed of [12, 31]) {
    const rf = run2([A, B, ...extra], [[A, B]], { input, seed, mode: 4, v5: true, level: L, fuseRule: 'width', hp: HP[L] });
    const ra = run2([A, B, ...extra], [], { input, seed, level: L, hp: HP[L] });
    f += rf.kills; s += ra.kills; res += rf.resonances; lf += rf.leaks; la += ra.leaks;
    for (const st of rf.stat.values()) { drama += st.drama; fires += st.fires; }
  }
  rows.push({ key: r.key, kind: kind4(r.from as never, r.to as never), fused: f, apart: s, ratio: f / Math.max(1, s), drama, fires, res, leaksF: lf, leaksA: la });
}
if (outPath) writeFileSync(outPath, JSON.stringify(rows));
const q = (a: number[], p: number) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const rs = rows.map((r) => r.ratio);
const fs = rows.map((r) => r.fused);
console.log(`L${L}: ratio min ${q(rs, 0).toFixed(2)} p10 ${q(rs, 0.1).toFixed(2)} med ${q(rs, 0.5).toFixed(2)} p90 ${q(rs, 0.9).toFixed(2)} max ${q(rs, 0.999).toFixed(2)} | <1: ${rs.filter((x) => x < 1).length}`);
console.log(`fused kills min ${q(fs, 0)} p10 ${q(fs, 0.1)} med ${q(fs, 0.5)} p90 ${q(fs, 0.9)} max ${q(fs, 0.999)}  p90/p10 ${(q(fs, 0.9) / q(fs, 0.1)).toFixed(2)}`);
