/**
 * 공통 규칙 검증 (v4 극적 반응): 대표 무기만이 아니라 갈래마다 여러 무기, 무작위 2+2·사슬·한 몸에 셋에서도 규칙이 걸리나.
 *   npx tsx tools/carry/verify4.ts [--write]
 * 1) 210 갈래 짝 × 무기 여럿 (A 쪽 모양별 무기, B 쪽 모양별 무기): 합친 짝마다 B 가 A 의 순간에 나갔나,
 *    B 가 나갈 때 노리던 상태의 적을 만난 몫 (반응 짝은 높고, 보통 짝은 낮아야 규칙대로)
 * 2) 무작위 구조 (사슬 · 한 몸에 여럿 · 2+2 · 섞인 나무, 무기 셋~다섯): 모든 합친 짝(깊이마다)이 걸리나
 */
import { writeFileSync } from 'node:fs';
import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../src/data/chaos';
import { inputFor, samplesV2 } from '../../src/data/combineV2';
import { kind4 } from '../../src/data/combineV4';
import type { AttackCat } from '../../src/data/links';
import { Rng } from '../../src/core/rng';
import { run2 } from './check2';

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];

/** 갈래마다 모양(kind)이 다른 무기 셋까지 */
const VAR: Record<string, string[]> = {};
for (const c of CATS) {
  const seen = new Set<string>();
  VAR[c] = [];
  for (const a of Object.values(ARMS)) {
    if (a.cat !== c || a.fusion || seen.has(a.kind)) continue;
    seen.add(a.kind);
    VAR[c].push(a.id);
    if (VAR[c].length >= 3) break;
  }
}

interface Agg { runs: number; ok: number; fires: number; matched: number }
const add = (m: Map<string, Agg>, k: string, ok: boolean, fires: number, matched: number) => {
  const a = m.get(k) ?? { runs: 0, ok: 0, fires: 0, matched: 0 };
  a.runs++;
  if (ok) a.ok++;
  a.fires += fires;
  a.matched += matched;
  m.set(k, a);
};

// 1) 210 × 무기 여럿
const byKind = new Map<string, Agg>();
const byA = new Map<string, Agg>();
const byB = new Map<string, Agg>();
const fails: string[] = [];
let runs1 = 0;
for (const a of CATS) {
  for (const b of CATS) {
    if (a === b) continue;
    const [SA, SB] = samplesV2(a, b);
    const combos = new Set<string>([`${SA}|${SB}`]);
    for (const x of VAR[a]) combos.add(`${x}|${SB}`);
    for (const y of VAR[b]) if (b !== 'magic' || y !== SB) combos.add(`${SA}|${y}`);
    for (const cb of combos) {
      const [A, B] = cb.split('|');
      if (A === B) continue;
      const r = run2([A, B], [[A, B]], { mode: 4, drama: true, input: inputFor(a, b) ?? (a === 'hand' || b === 'hand' ? 'tap' : undefined), seed: 12, seconds: 30 });
      const st = r.stat.get(`${A}>${B}`) ?? { fires: 0, matched: 0, drama: 0 };
      const ok = r.keys.includes(`${A}>${B}`);
      runs1++;
      add(byKind, kind4(a, b), ok, st.fires, st.matched);
      add(byA, a, ok, st.fires, st.matched);
      add(byB, b, ok, st.fires, st.matched);
      if (!ok) fails.push(`${L(a)}+${L(b)} (${ARMS[A].name}+${ARMS[B].name})`);
    }
  }
}

// 2) 무작위 구조
const rng = new Rng(2026);
const pool = Object.values(ARMS).filter((x) => x.cat !== 'passive' && !x.fusion).map((x) => x.id);
const shapes = ['사슬', '한 몸에 여럿', '2+2', '섞인 나무'] as const;
const byShape = new Map<string, Agg>();
const byDepth = new Map<string, Agg>();
let edges = 0;
let edgesOk = 0;
for (let n = 0; n < 200; n++) {
  const shape = shapes[n % shapes.length];
  const k = shape === '2+2' ? 4 : 3 + rng.int(3);
  const pick: string[] = [];
  const cats = new Set<string>();
  while (pick.length < k) {
    const id = pool[rng.int(pool.length)];
    if (cats.has(ARMS[id].cat)) continue;
    cats.add(ARMS[id].cat);
    pick.push(id);
  }
  // [부모, 아이, 깊이]: 아이 쪽부터 합친다
  const tree: [string, string, number][] = [];
  if (shape === '사슬') for (let i = 0; i + 1 < k; i++) tree.push([pick[i], pick[i + 1], i + 1]);
  else if (shape === '한 몸에 여럿') for (let i = 1; i < k; i++) tree.push([pick[0], pick[i], 1]);
  else if (shape === '2+2') tree.push([pick[0], pick[1], 1], [pick[2], pick[3], 2], [pick[0], pick[2], 1]);
  else {
    const depth = new Map<string, number>([[pick[0], 0]]);
    for (let i = 1; i < k; i++) {
      const par = pick[rng.int(i)];
      const d = (depth.get(par) ?? 0) + 1;
      depth.set(pick[i], d);
      tree.push([par, pick[i], d]);
    }
  }
  const order = [...tree].sort((p, q) => q[2] - p[2]);
  const hasHand = pick.some((id) => ARMS[id].cat === 'hand');
  const r = run2(pick, order.map(([p, c]) => [p, c] as [string, string]), { mode: 4, drama: true, input: hasHand ? 'tap' : undefined, seed: n + 1, seconds: 30 });
  for (const [p, c, d] of tree) {
    const ok = r.keys.includes(`${p}>${c}`);
    const st = r.stat.get(`${p}>${c}`) ?? { fires: 0, matched: 0, drama: 0 };
    edges++;
    if (ok) edgesOk++;
    add(byShape, shape, ok, st.fires, st.matched);
    add(byDepth, `깊이 ${Math.min(d, 3)}${d >= 3 ? '+' : ''}`, ok, st.fires, st.matched);
  }
}

const pct = (a: Agg) => `${Math.round((a.ok / Math.max(1, a.runs)) * 100)}%`;
const mpct = (a: Agg) => `${Math.round((a.matched / Math.max(1, a.fires)) * 100)}%`;
const lines: string[] = [];
lines.push(`1) 210 갈래 짝 × 무기 여럿: ${runs1}판 (갈래마다 모양이 다른 무기 셋까지, 30초)`);
for (const [k, a] of byKind) lines.push(`  ${k}: 걸림 ${pct(a)} (${a.ok}/${a.runs}), B 가 나갈 때 노리던 상태의 적을 만난 몫 ${mpct(a)}`);
lines.push(`  A 갈래별 걸림: ${[...byA].map(([k, a]) => `${L(k as AttackCat)} ${pct(a)}`).join(' · ')}`);
lines.push(`  B 갈래별 걸림: ${[...byB].map(([k, a]) => `${L(k as AttackCat)} ${pct(a)}`).join(' · ')}`);
lines.push(`  안 걸린 것 ${fails.length}: ${fails.slice(0, 20).join(', ')}`);
lines.push(`2) 무작위 구조 200 (무기 셋~다섯, 30초): 합친 짝 ${edges} 중 걸림 ${edgesOk} (${Math.round((edgesOk / edges) * 100)}%)`);
for (const [k, a] of byShape) lines.push(`  ${k}: 걸림 ${pct(a)} (${a.ok}/${a.runs}), 노린 상태 만남 ${mpct(a)}`);
for (const [k, a] of [...byDepth].sort()) lines.push(`  ${k}: 걸림 ${pct(a)} (${a.ok}/${a.runs})`);
console.log(lines.join('\n'));

if (process.argv.includes('--write')) {
  const obj = {
    runs: runs1,
    kinds: Object.fromEntries([...byKind].map(([k, a]) => [k, { ok: a.ok, runs: a.runs, matched: a.matched, fires: a.fires }])),
    byA: Object.fromEntries([...byA].map(([k, a]) => [k, a.ok / Math.max(1, a.runs)])),
    byB: Object.fromEntries([...byB].map(([k, a]) => [k, a.ok / Math.max(1, a.runs)])),
    fails,
    edges,
    edgesOk,
    shapes: Object.fromEntries([...byShape].map(([k, a]) => [k, { ok: a.ok, runs: a.runs, matched: a.matched, fires: a.fires }])),
    depth: Object.fromEntries([...byDepth].map(([k, a]) => [k, { ok: a.ok, runs: a.runs }])),
  };
  writeFileSync('tools/showcase/pages/verify4-results.ts', `// npx tsx tools/carry/verify4.ts --write (공통 규칙 검증)\nexport const VERIFY4 = ${JSON.stringify(obj, null, 2)};\n`);
}
