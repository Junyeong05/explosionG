/**
 * 업그레이드 수준 차이 vs 조합 차이: 같은 적 (체력 ×10) 에서 무작위 840 짝을 레벨(=등급) 2 와 5 로, 합침·따로 (씨앗 12·31).
 *   MEET_OUT=<폴더> npx tsx tools/meeting/levels.ts <shard> <n>
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { inputFor } from '../../src/data/combineV2';
import { OUT, pairSample, shardArgs } from './common';
import { simSeeds } from './harness';

const { i, mine } = shardArgs();
const rows: any[] = [];
const t0 = Date.now();
for (const p of mine(pairSample(4))) {
  const input = inputFor(ARMS[p.A].cat as never, ARMS[p.B].cat as never);
  const row: any = { A: p.A, B: p.B };
  for (const L of [2, 5]) {
    const o = { level: L, hp: 10, input };
    row[`f${L}`] = simSeeds([p.A, p.B], [[p.A, p.B]], o, [12, 31]).kills;
    row[`s${L}`] = simSeeds([p.A, p.B], [], o, [12, 31]).kills;
  }
  rows.push(row);
}
writeFileSync(`${OUT}/levels-${i}.json`, JSON.stringify(rows));
console.log(`levels shard ${i}: ${rows.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
