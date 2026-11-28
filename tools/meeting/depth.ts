/**
 * 여러 단계 합성 (11-28 유저: "여러 단계 합성으로 들어가도 규칙이 제대로 적용돼서 다양한 무기가 연출되나?")
 * 뿌리 A 에 다른 갈래 B → C → D 를 차례로 몸에 더해 (몸 무기 2 · 3 · 4), 같은 무기를 따로 가진 판과 견준다.
 * 무기마다: 반응이 실제로 터졌나 (react 이벤트 이름), 피해 몫, 이름.
 *   npx tsx tools/meeting/depth.ts <shard> <n> [표본=40] [레벨=3]   → MEET_OUT/depth-<shard>.json
 */
import { writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { fuseName, reactName } from '../../src/data/combineV4';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { CATS, OUT, pool, shardArgs } from './common';
import { rng } from './harness';

const FW = BALANCE.field.width;
type Res = { dmg: number; by: Record<string, number>; reacts: Record<string, number> };

function sim(arms: string[], L: number, fuse: [string, string][], seed: number, hp: number, seconds = 18): Res {
  const w = new World({ seed, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true, fuseRule: 'now' });
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
  for (const id of arms) for (let i = 0; i < L; i++) w.augments.acquire(id, w);
  for (const [a, b] of fuse) if (!ch.fuse4(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
  ch.fusion.drama = true;
  ch.fusion.v5 = true;
  const reacts: Record<string, number> = {};
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
    for (const ev of w.events) if (ev.type === 'react') reacts[(ev as { text: string }).text] = (reacts[(ev as { text: string }).text] ?? 0) + 1;
    (w.events as unknown[]).length = 0;
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
  }
  const by: Record<string, number> = {};
  let dmg = 0;
  for (const [k, v] of ch.dmgBy) {
    by[k] = v;
    dmg += v;
  }
  return { dmg, by, reacts };
}
const two = (arms: string[], L: number, fuse: [string, string][], hp: number): Res => {
  const a = sim(arms, L, fuse, 12, hp);
  const b = sim(arms, L, fuse, 31, hp);
  const by: Record<string, number> = { ...a.by };
  for (const [k, v] of Object.entries(b.by)) by[k] = (by[k] ?? 0) + v;
  const reacts: Record<string, number> = { ...a.reacts };
  for (const [k, v] of Object.entries(b.reacts)) reacts[k] = (reacts[k] ?? 0) + v;
  return { dmg: a.dmg + b.dmg, by, reacts };
};

const { i: shard, mine } = shardArgs();
const per = Number(process.argv[4] ?? 40);
const L = Number(process.argv[5] ?? 3);
const R = rng(1128);
const jobs = Array.from({ length: per }, (_, k) => {
  const cats = [...CATS].sort(() => R.next() - 0.5).slice(0, 4);
  return { k, ids: cats.map((c) => { const p = pool(c); return p[Math.floor(R.next() * p.length)]; }) };
});
const rows: unknown[] = [];
const t0 = Date.now();
for (const j of mine(jobs)) {
  const [A, B, C, D] = j.ids;
  const out: Record<string, unknown> = { A, B, C, D, cats: j.ids.map((x) => ARMS[x].cat) };
  for (const n of [2, 3, 4]) {
    const ids = j.ids.slice(0, n);
    const hp = 4 * L * n;
    const sep = two(ids, L, [], hp);
    const fu = two(ids, L, ids.slice(1).map((x) => [A, x] as [string, string]), hp);
    const kids = ids.slice(1).map((x) => ({
      id: x,
      react: reactName(x),
      fired: Object.entries(fu.reacts).filter(([t]) => t.startsWith(reactName(x))).reduce((s, [, v]) => s + v, 0),
      share: +((fu.by[x] ?? 0) / Math.max(1, fu.dmg)).toFixed(3),
    }));
    out[`n${n}`] = { ratio: +(fu.dmg / Math.max(1, sep.dmg)).toFixed(3), kids, rootShare: +((fu.by[A] ?? 0) / Math.max(1, fu.dmg)).toFixed(3) };
  }
  out.name2 = fuseName(A, B);
  rows.push(out);
}
writeFileSync(`${OUT}/depth-${shard}.json`, JSON.stringify(rows));
console.log(`depth shard ${shard}: ${rows.length}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
