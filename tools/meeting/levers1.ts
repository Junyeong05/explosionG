/**
 * 지렛대 1단계 (등급 3, 적 ×7): 짝마다 B 반응 세기 배율을 ×0.25·0.5·2·4 로 바꿔 본 처치 (씨앗 12·31, 맞춤용)
 * + 맞춤에 안 쓴 씨앗 47·58 로 합침(×1)·따로 (검증용 · 씨앗 흔들림 재기).
 *   MEET_OUT=<폴더> npx tsx tools/meeting/levers1.ts <shard> <n>
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { inputFor, samplesV2 } from '../../src/data/combineV2';
import { CATS, HP, OUT, pairSample, shardArgs } from './common';
import { simSeeds } from './harness';

export function allPairs() {
  const all = pairSample(4);
  for (const a of CATS) for (const b of CATS) if (a !== b) {
    const [A, B] = samplesV2(a, b);
    all.push({ A, B, rep: true });
  }
  return all;
}
if (process.argv[1]?.endsWith('levers1.ts')) {
  const { i, mine } = shardArgs();
  const rows: any[] = [];
  const t0 = Date.now();
  const L = 3;
  for (const p of mine(allPairs())) {
    const input = inputFor(ARMS[p.A].cat as never, ARMS[p.B].cat as never);
    const o = { level: L, hp: HP[L], input };
    const cal: Record<string, number> = {};
    for (const m of [0.25, 0.5, 2, 4]) cal[m] = simSeeds([p.A, p.B], [[p.A, p.B]], { ...o, mul: m }, [12, 31]).kills;
    const fh = simSeeds([p.A, p.B], [[p.A, p.B]], o, [47, 58]).kills;
    const sh = simSeeds([p.A, p.B], [], o, [47, 58]).kills;
    rows.push({ ...p, cal, fh, sh });
  }
  writeFileSync(`${OUT}/lev1-${i}.json`, JSON.stringify(rows));
  console.log(`lev1 shard ${i}: ${rows.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
