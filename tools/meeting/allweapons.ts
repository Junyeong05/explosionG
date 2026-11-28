/**
 * 모든 무기 검증 (11-28 유저: "샘플에서만이 아니라 모든 무기에 공통 규칙으로 저렇게 나오는 게 맞나? 하나하나 검증은 불가능하니").
 * 공격 무기 하나하나를 (1) 안에 든 무기(B)로 (2) 몸(A)으로 (3) 깊은 구조(2+1 · 사슬 · 1+2 · 2+2 · 3+1 중 하나) 안쪽으로 넣어 돌린다.
 * 짝 무기는 씨앗 고정 무작위 (다른 갈래). 손공격은 탭이 있어야 해서 몸(A)으로는 안 돌림 (B · 깊은 구조 안쪽으로는 돌림).
 *   npx tsx tools/meeting/allweapons.ts <shard> <n>   → MEET_OUT/all-<shard>.json
 */
import { writeFileSync } from 'node:fs';
import { ARMS, ATTACK_CATEGORIES } from '../../src/data/chaos';
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { reactName } from '../../src/data/combineV4';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { OUT, shardArgs } from './common';
import { rng } from './harness';

const FW = BALANCE.field.width;
const L = 3;
type Res = { dmg: number; by: Record<string, number>; reacts: Record<string, number> };

function sim(arms: string[], fuse: [string, string][], seed: number, hp: number, seconds = 18): Res {
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
  for (const [a, b] of fuse) if (!ch.fuse4(a, b)) throw new Error(`못 합침 ${a}>${b}`);
  ch.fusion.drama = true;
  ch.fusion.v5 = true;
  const reacts: Record<string, number> = {};
  let spawnT = 0;
  for (let i = 0, steps = Math.round(seconds / FIXED_DT); i < steps; i++) {
    spawnT -= FIXED_DT;
    if (spawnT <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < 14) {
        spawnT = 1 / 8;
        const roll = w.rng.next();
        w.spawnEnemy(roll < 0.7 ? 'normal' : roll < 0.85 ? 'armored' : 'rusher', w.rng.range(30, FW - 30), w.rng.range(90, BALANCE.field.height * 0.52), hp);
      }
    }
    skip();
    w.step(FIXED_DT, []);
    const evs = (w as unknown as { events: { type: string; text?: string }[] }).events;
    for (const ev of evs) if (ev.type === 'react' && ev.text) reacts[ev.text] = (reacts[ev.text] ?? 0) + 1;
    evs.length = 0;
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
const two = (arms: string[], fuse: [string, string][], hp: number): Res => {
  const a = sim(arms, fuse, 12, hp);
  const b = sim(arms, fuse, 31, hp);
  for (const [k, v] of Object.entries(b.by)) a.by[k] = (a.by[k] ?? 0) + v;
  for (const [k, v] of Object.entries(b.reacts)) a.reacts[k] = (a.reacts[k] ?? 0) + v;
  return { dmg: a.dmg + b.dmg, by: a.by, reacts: a.reacts };
};

const CATS = ATTACK_CATEGORIES as readonly string[];
const ALL = Object.values(ARMS).filter((w) => CATS.includes(w.cat) && !w.fusion).map((w) => w.id).sort();
const R = rng(20261128);
const other = (avoid: string[], noHand = true) => {
  const cs = new Set(avoid.map((x) => ARMS[x].cat));
  const xs = ALL.filter((x) => !cs.has(ARMS[x].cat) && (!noHand || ARMS[x].cat !== 'hand'));
  return xs[Math.floor(R.next() * xs.length)];
};
const SHAPES = ['2+1 몸에 더함', '2+1 사슬', '1+2', '2+2', '3+1'] as const;
// 무기마다 짝을 미리 정한다 (shard 와 무관하게 같은 결과)
const jobs = ALL.map((w) => {
  const a = other([w]);
  const b = ARMS[w].cat === 'hand' ? null : other([w], false);
  const shape = SHAPES[Math.floor(R.next() * SHAPES.length)];
  const x = other([w]);
  const y = other([w, x]);
  const z = other([w, x, y]);
  return { w, a, b, shape, x, y, z };
});

function run(arms: string[], fuse: [string, string][], w: string) {
  const hp = 4 * L * arms.length;
  try {
    const sep = two(arms, [], hp);
    const fu = two(arms, fuse, hp);
    const fired = Object.entries(fu.reacts).filter(([t]) => t.startsWith(reactName(w))).reduce((s, [, v]) => s + v, 0);
    return { ok: true, ratio: +(fu.dmg / Math.max(1, sep.dmg)).toFixed(3), fired, share: +((fu.by[w] ?? 0) / Math.max(1, fu.dmg)).toFixed(4) };
  } catch (e) {
    return { ok: false, err: String(e).slice(0, 120) };
  }
}

const { i: shard, mine } = shardArgs();
const rows: unknown[] = [];
const t0 = Date.now();
for (const j of mine(jobs)) {
  const { w, a, b, shape, x, y, z } = j;
  const asB = run([a, w], [[a, w]], w);
  const asA = b ? run([w, b], [[w, b]], w) : null;
  const deep =
    shape === '2+1 몸에 더함' ? run([x, y, w], [[x, y], [x, w]], w)
    : shape === '2+1 사슬' ? run([x, y, w], [[x, y], [y, w]], w)
    : shape === '1+2' ? run([x, y, w], [[y, w], [x, y]], w)
    : shape === '2+2' ? run([x, y, z, w], [[x, y], [z, w], [x, z]], w)
    : run([x, y, z, w], [[x, y], [x, z], [x, w]], w);
  rows.push({ w, cat: ARMS[w].cat, react: reactName(w), a, b, shape, asB, asA, deep });
}
writeFileSync(`${OUT}/all-${shard}.json`, JSON.stringify(rows));
console.log(`all shard ${shard}: ${rows.length} 무기, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
