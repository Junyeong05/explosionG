/**
 * 겹친 합성 (한 몸에 셋): 서로 다른 갈래 셋 무작위 150 묶음, 등급 3 (셋 다 3레벨), 적 체력 ×10, 18초 두 판.
 * 순서 여섯 (몸 X, 안에 [Y, Z] 넣은 순서 둘) + 중간 상태 여섯 (몸 X 에 Y 만, Z 는 따로) + 셋 다 따로.
 * 손 무기가 끼면 입력은 모든 판에서 탭 하나로 같게.
 *   MEET_OUT=<폴더> npx tsx tools/meeting/triples.ts <shard> <n>
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { CATS, OUT, pool, shardArgs } from './common';
import { rng, simSeeds } from './harness';

const { i, mine } = shardArgs();
const R = rng(777);
const trip: string[][] = [];
for (let t = 0; t < 150; t++) {
  const cs = R.shuffle([...CATS]).slice(0, 3);
  trip.push(cs.map((c) => { const p = pool(c); return p[R.int(p.length)]; }));
}
const rows: any[] = [];
const t0 = Date.now();
for (const W of mine(trip)) {
  const input = W.some((id) => ARMS[id].cat === 'hand') ? ('tap' as const) : null;
  const o = { level: 3, hp: 10, input };
  const seeds = [12, 31];
  const sep = simSeeds(W, [], o, seeds);
  const full: any[] = [];
  const half: any[] = [];
  for (let x = 0; x < 3; x++) {
    const ys = [0, 1, 2].filter((k) => k !== x);
    for (const [y, z] of [[ys[0], ys[1]], [ys[1], ys[0]]]) {
      const r = simSeeds(W, [[W[x], W[y]], [W[x], W[z]]], o, seeds);
      full.push({ body: x, kids: [y, z], kills: r.kills, dmg: r.dmg, drama: r.drama, res: r.res });
      const h = simSeeds(W, [[W[x], W[y]]], o, seeds);
      half.push({ body: x, kid: y, out: z, kills: h.kills, dmg: h.dmg });
    }
  }
  rows.push({ W, cats: W.map((id) => ARMS[id].cat), sep: { kills: sep.kills, dmg: sep.dmg }, full, half });
}
writeFileSync(`${OUT}/triples-${i}.json`, JSON.stringify(rows));
console.log(`triples shard ${i}: ${rows.length} 묶음 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
