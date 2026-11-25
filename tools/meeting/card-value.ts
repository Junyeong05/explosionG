/**
 * 카드 한 장의 값 (11-25 유저: "무기 소유 상한이 없어 많이 가질수록 딜이 되는데, 합성이 2배 넘지 않으면 안 하지 않을까?")
 * 무기 N 개(서로 다른 갈래, 레벨 L)를 가진 순간에, 레벨 업 카드 하나로 고를 수 있는 셋을 나란히:
 *   새 무기 (Lv1 하나 더) · 강화 (하나 +1 레벨) · 합성 (가진 둘을 한 몸으로, 등급 = 낮은 레벨)
 * 값 = 그 판의 실제 피해 합(넘친 피해 뺌)이 지금보다 몇 % 늘었나. 적 14 유지, 체력은 무기 수에 맞춰 크게 (처치가 막히지 않게), 18초 두 판.
 *   npx tsx tools/meeting/card-value.ts <shard> <n> [N들=4,7,10] [L들=2,3] [표본=10]   → MEET_OUT/card-<shard>.json
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { CATS, OUT, pool, shardArgs } from './common';
import { rng } from './harness';

const FW = BALANCE.field.width;

function simMixed(arms: [string, number][], fuse: [string, string][], seed: number, hp: number, seconds = 18): number {
  const fused = fuse.length > 0;
  const w = new World({ seed, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: false, fuseRule: 'width' });
  const ch = w.chaos!;
  const skip = () => {
    const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (const [id, lv] of arms) for (let i = 0; i < lv; i++) w.augments.acquire(id, w);
  for (const [a, b] of fuse) if (!ch.fuse4(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
  if (fused || true) {
    ch.fusion.drama = true;
    ch.fusion.v5 = true;
  }
  let spawnT = 0;
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    spawnT -= FIXED_DT;
    if (spawnT <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < 14) {
        spawnT = 1 / 8;
        const roll = w.rng.next();
        const kind = roll < 0.7 ? 'normal' : roll < 0.85 ? 'armored' : 'rusher';
        w.spawnEnemy(kind, w.rng.range(30, FW - 30), w.rng.range(90, BALANCE.field.height * 0.52), hp);
      }
    }
    skip();
    w.step(FIXED_DT, []);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
  }
  let dmg = 0;
  for (const v of ch.dmgBy.values()) dmg += v;
  return dmg;
}

const sum2 = (arms: [string, number][], fuse: [string, string][], hp: number) => simMixed(arms, fuse, 12, hp) + simMixed(arms, fuse, 31, hp);

const { i: shard, mine } = shardArgs();
const Ns = (process.argv[4] ?? '4,7,10').split(',').map(Number);
const Ls = (process.argv[5] ?? '2,3').split(',').map(Number);
const per = Number(process.argv[6] ?? 10);
const R = rng(7);
const jobs: { N: number; L: number; k: number; cats: string[]; arms: string[]; extra: string; fa: number; fb: number; up: number }[] = [];
for (const N of Ns)
  for (const L of Ls)
    for (let k = 0; k < per; k++) {
      const cats = [...CATS].sort(() => R.next() - 0.5).slice(0, N + 1);
      const arms = cats.slice(0, N).map((c) => {
        const p = pool(c);
        return p[Math.floor(R.next() * p.length)];
      });
      const ep = pool(cats[N]);
      const extra = ep[Math.floor(R.next() * ep.length)];
      const fa = Math.floor(R.next() * N);
      let fb = Math.floor(R.next() * (N - 1));
      if (fb >= fa) fb++;
      jobs.push({ N, L, k, cats, arms, extra, fa, fb, up: Math.floor(R.next() * N) });
    }
const rows: unknown[] = [];
const t0 = Date.now();
for (const j of mine(jobs)) {
  const hp = 4 * j.L * j.N;
  const base: [string, number][] = j.arms.map((a) => [a, j.L]);
  const S = sum2(base, [], hp);
  const NEW = sum2([...base, [j.extra, 1]], [], hp);
  const UP = sum2(
    base.map(([a, l], ix) => [a, ix === j.up ? l + 1 : l] as [string, number]),
    [],
    hp,
  );
  const FU = sum2(base, [[j.arms[j.fa], j.arms[j.fb]]], hp);
  rows.push({ N: j.N, L: j.L, A: j.arms[j.fa], B: j.arms[j.fb], cb: ARMS[j.arms[j.fb]].cat, extra: j.extra, S, NEW, UP, FU });
}
writeFileSync(`${OUT}/card-${shard}.json`, JSON.stringify(rows));
console.log(`shard ${shard}: ${rows.length} rows, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
