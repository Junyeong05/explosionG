/**
 * 레드팀 측정 (11-25 회의): 판 안에서 실제로 생기는 겹침을 210 짝 측정이 놓치는지.
 *   npx tsx tools/meeting/red-probe.ts
 * E1 등급 배율이 손(B)에 안 걸리는가 · E2 몸끼리 상태 공유 (묶는 몸이 다른 몸의 반응을 켜나) ·
 * E3 무기 셋 한 몸: 누가 몸(뿌리)이냐에 따른 편차 · E4 등급 함정 (G4 몸에 Lv2 를 넣으면)
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { GRADE_MUL } from '../../src/data/fuseRules';
import { SAMPLE } from '../../src/data/links';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { InputDriver } from '../carry/input';

const FW = BALANCE.field.width;
type R = { kills: number; drama: Map<string, number>; fires: Map<string, number>; res: number };
function run(ws: [string, number][], fuse: [string, string][], seed: number, hp: number, tap = false, sec = 18): R {
  const w = new World({ seed, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true, fuseRule: 'width' });
  const skip = () => {
    const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') { a.offer = null; a.phase = 'playing'; }
  };
  skip();
  for (const [id, l] of ws) for (let i = 0; i < l; i++) w.augments.acquire(id, w);
  for (const [a, b] of fuse) if (!w.chaos!.fuse4(a, b)) throw new Error(`fuse ${a}>${b}`);
  if (fuse.length) { w.chaos!.fusion.drama = true; w.chaos!.fusion.v5 = true; }
  const drv = tap ? new InputDriver('tap') : null;
  let spawnT = 0, res = 0;
  for (let i = 0; i < Math.round(sec / FIXED_DT); i++) {
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
    w.step(FIXED_DT, drv ? drv.step(w, FIXED_DT) : []);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    for (const ev of w.drainEvents()) if (ev.type === 'react' && ev.text.endsWith('공명!')) res++;
  }
  const drama = new Map<string, number>(), fires = new Map<string, number>();
  for (const [k, s] of w.chaos!.fusion.stat4) { drama.set(k, s.drama); fires.set(k, s.fires); }
  return { kills: w.kills, drama, fires, res };
}
const S = SAMPLE as Record<string, string>;
const seeds = [12, 31, 47];
const tot = (f: (s: number) => R) => seeds.map(f).reduce((a, r) => ({ kills: a.kills + r.kills, drama: a.drama + [...r.drama.values()].reduce((x, y) => x + y, 0), fires: a.fires + [...r.fires.values()].reduce((x, y) => x + y, 0), res: a.res + r.res }), { kills: 0, drama: 0, fires: 0, res: 0 });

// E1: 등급 배율을 0.38 → 0.05 로 내려도 손 B 짝은 그대로인가
console.log('== E1 등급 배율 (L3) 0.38 vs 0.05: B 처치 변화');
for (const [a, b] of [['gun', 'hand'], ['ray', 'hand'], ['gun', 'swarm'], ['gun', 'throw']]) {
  const ws: [string, number][] = [[S[a], 3], [S[b], 3]];
  const tap = b === 'hand';
  (GRADE_MUL as Record<number, number>)[3] = 0.38;
  const hi = tot((s) => run(ws, [[S[a], S[b]]], s, 7, tap));
  (GRADE_MUL as Record<number, number>)[3] = 0.05;
  const lo = tot((s) => run(ws, [[S[a], S[b]]], s, 7, tap));
  (GRADE_MUL as Record<number, number>)[3] = 0.38;
  console.log(`${a}>${b}: ×0.38 ${hi.kills} · ×0.05 ${lo.kills} (${(lo.kills / hi.kills * 100).toFixed(0)}%)`);
}

// E2: 다른 몸이 남긴 상태를 이 몸의 B 가 노린다 (st4 는 적마다 하나, 몸끼리 공유)
console.log('== E2 몸끼리 상태 공유: 몸2 의 극적 몫 · 전체 처치');
const cases: [string, string, string, string][] = [
  // [몸1 A, 몸1 B, 몸2 A, 몸2 B]: 몸2 는 묶임을 노리는 B 인데 A 가 묶임을 안 남김
  ['trap', 'gun', 'air', 'turret'],
  ['sound', 'throw', 'charge', 'field'],
  ['magic', 'gun', 'turret', 'charge'],
];
for (const [a1, b1, a2, b2] of cases) {
  const ws: [string, number][] = [[S[a1], 3], [S[b1], 3], [S[a2], 3], [S[b2], 3]];
  const k2 = `${S[a2]}>${S[b2]}`;
  const only2 = seeds.map((s) => run(ws, [[S[a2], S[b2]]], s, 9));
  const both = seeds.map((s) => run(ws, [[S[a1], S[b1]], [S[a2], S[b2]]], s, 9));
  const only1 = seeds.map((s) => run(ws, [[S[a1], S[b1]]], s, 9));
  const none = seeds.map((s) => run(ws, [], s, 9));
  const sh = (rs: R[]) => rs.reduce((x, r) => x + (r.drama.get(k2) ?? 0), 0) / Math.max(1, rs.reduce((x, r) => x + (r.fires.get(k2) ?? 0), 0));
  const K = (rs: R[]) => rs.reduce((x, r) => x + r.kills, 0);
  console.log(`몸1 ${a1}>${b1} · 몸2 ${a2}>${b2}: 몸2 극적 몫 혼자 ${(sh(only2) * 100).toFixed(0)}% → 둘 ${(sh(both) * 100).toFixed(0)}% | 처치 없음 ${K(none)} · 몸1만 ${K(only1)} · 몸2만 ${K(only2)} · 둘 ${K(both)} (더한 기대 ${K(only1) + K(only2) - K(none)})`);
}

// E3: 무기 셋 한 몸, 뿌리(몸)를 누구로 하나
console.log('== E3 무기 셋 한 몸 (L3): 뿌리마다 처치');
const trips: [string, string, string][] = [['summon', 'charge', 'turret'], ['sound', 'swarm', 'spirit'], ['trap', 'field', 'ray'], ['gun', 'throw', 'spinner'], ['magic', 'air', 'spinner'], ['swarm', 'spirit', 'field']];
for (const t of trips) {
  const ws: [string, number][] = t.map((c) => [S[c], 3]);
  const out: string[] = [];
  const vals: number[] = [];
  for (let r = 0; r < 3; r++) {
    const root = t[r];
    const kids = t.filter((_, i) => i !== r);
    const k = tot((s) => run(ws, kids.map((c) => [S[root], S[c]] as [string, string]), s, 9)).kills;
    vals.push(k);
    out.push(`${root}[${kids.join('+')}] ${k}`);
  }
  const sep = tot((s) => run(ws, [], s, 9)).kills;
  console.log(`${t.join('·')}: ${out.join(' | ')} · 따로 ${sep} · 최대/최소 ×${(Math.max(...vals) / Math.min(...vals)).toFixed(2)}`);
}

// E4: G4 몸에 Lv2 무기를 셋째로 넣으면 (등급 = 몸 안 가장 낮은 레벨 → 0.52 가 0.28 로)
console.log('== E4 등급 함정: G4 두 무기 몸 + Lv2 셋째');
for (const [a, b, c] of [['trap', 'turret', 'air'], ['summon', 'charge', 'field'], ['gun', 'throw', 'swarm']]) {
  const ws: [string, number][] = [[S[a], 4], [S[b], 4], [S[c], 2]];
  const keep = tot((s) => run(ws, [[S[a], S[b]]], s, 10)).kills;
  const add = tot((s) => run(ws, [[S[a], S[b]], [S[a], S[c]]], s, 10)).kills;
  console.log(`${a}>${b} G4 + ${c} Lv2 따로 ${keep} → 셋째로 넣음 (G2) ${add} (${((add / keep - 1) * 100).toFixed(0)}%)`);
}
