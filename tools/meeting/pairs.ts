/**
 * 합성 편차: 갈래 짝 210 × 무기 짝 4 (같은 갈래 안 무작위) + 대표 짝 210 (samplesV2) = 1050 짝.
 * 등급 2·3·5 (두 무기 같은 레벨 = 등급, 폭=칸 규칙의 GRADE_MUL), 적 체력 ×5·7·14 (grade.ts 와 같음), 18초 두 판 (씨앗 12·31).
 * 합침(B 를 A 안에) vs 따로(같은 두 무기 같은 레벨).
 *   MEET_OUT=<폴더> npx tsx tools/meeting/pairs.ts <shard> <n> [등급들=2,3,5]
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { inputFor, samplesV2 } from '../../src/data/combineV2';
import { CATS, HP, OUT, pairSample, shardArgs } from './common';
import { simSeeds } from './harness';

const { i, mine } = shardArgs();
const grades = (process.argv[4] ?? '2,3,5').split(',').map(Number);
const all = pairSample(4);
for (const a of CATS) for (const b of CATS) if (a !== b) {
  const [A, B] = samplesV2(a, b);
  all.push({ A, B, rep: true });
}
const rows: any[] = [];
const t0 = Date.now();
for (const p of mine(all)) {
  const ca = ARMS[p.A].cat as never;
  const cb = ARMS[p.B].cat as never;
  const input = inputFor(ca, cb);
  for (const L of grades) {
    const o = { level: L, hp: HP[L], input };
    const f = simSeeds([p.A, p.B], [[p.A, p.B]], o, [12, 31]);
    const s = simSeeds([p.A, p.B], [], o, [12, 31]);
    rows.push({ ...p, ca, cb, L, f, s });
  }
}
writeFileSync(`${OUT}/pairs-${grades.join('')}-${i}.json`, JSON.stringify(rows));
console.log(`pairs shard ${i}: ${rows.length} 줄 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
