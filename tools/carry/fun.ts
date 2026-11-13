/**
 * 재밌을 조합 찾기 (극적 반응): 둘 (A+B) · 한 몸에 둘 (A+[B,C]) · 사슬 (A→B→C) 을 돌려
 * 극적 반응이 자주 터지고(반응 수) 따로 가진 것보다 센(처치 비율) 것을 고른다.
 *   npx tsx tools/carry/fun.ts [--write]
 * 점수 = 반응 수(18초 두 판) × min(처치 비율, 3). 같은 A·같은 B 가 너무 겹치지 않게 고른다.
 */
import { writeFileSync } from 'node:fs';
import { ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../src/data/chaos';
import { HELPER, inputFor, samplesV2 } from '../../src/data/combineV2';
import { CAT4 } from '../../src/data/combineV4';
import type { AttackCat } from '../../src/data/links';
import { run2 } from './check2';

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const W = (a: AttackCat, b: AttackCat) => samplesV2(a, b)[1];
const A0 = (a: AttackCat) => samplesV2(a, a === 'gun' ? 'turret' : 'gun')[0];

export interface Fun {
  kind: '둘' | '한 몸에 둘' | '사슬';
  cats: AttackCat[];
  title: string;
  weapons: string[];
  fuse: [string, string][];
  input?: string;
  ratio: number;
  reacts: number;
  score: number;
}

/** B 가 A 의 상태에 반응하나 (A 가 남기는 상태를 노리거나, 무리를 노림) */
const reacts = (a: AttackCat, b: AttackCat) => a !== b && ((CAT4[a].leaves && CAT4[a].leaves === CAT4[b].seeks) || CAT4[b].seeks === 'crowd');

function measure(cats: AttackCat[], weapons: string[], fuse: [string, string][], input?: ReturnType<typeof inputFor>): { ratio: number; reacts: number } {
  let f = 0;
  let s = 0;
  let r = 0;
  for (const seed of [12, 31]) {
    const a = run2(weapons, fuse, { seed, mode: 4, drama: true, input: input ?? undefined });
    const b = run2(weapons, [], { seed, input: input ?? undefined });
    f += a.kills;
    s += b.kills;
    r += a.reacts;
  }
  void cats;
  return { ratio: f / Math.max(1, s), reacts: r };
}

function inputOf(cats: AttackCat[]): ReturnType<typeof inputFor> {
  for (let i = 0; i < cats.length; i++) for (let j = 0; j < cats.length; j++) if (i !== j) {
    const x = inputFor(cats[i], cats[j]);
    if (x) return x;
  }
  return null;
}

function helper(cats: AttackCat[]): string[] {
  return HELPER[cats[0]] ? [HELPER[cats[0]]!] : [];
}

const out: Fun[] = [];
// 둘
for (const a of CATS) for (const b of CATS) {
  if (!reacts(a, b)) continue;
  const [A, B] = samplesV2(a, b);
  const cats = [a, b];
  const ws = [A, B, ...helper(cats)];
  const m = measure(cats, ws, [[A, B]], inputOf(cats));
  out.push({ kind: '둘', cats, title: `${L(a)} + ${L(b)}`, weapons: ws, fuse: [[A, B]], input: inputOf(cats) ?? undefined, ...m, score: m.reacts * Math.min(m.ratio, 3) });
}
// 한 몸에 둘: A 가 남긴 상태에 B·C 가 같이 반응
for (const a of CATS) {
  const bs = CATS.filter((b) => reacts(a, b) && b !== 'hand');
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
    const b = bs[i];
    const c = bs[j];
    if (CAT4[b].seeks === 'crowd' && CAT4[c].seeks === 'crowd') continue;
    const A = A0(a);
    const B = W(a, b);
    const C = W(a, c);
    if (B === C) continue;
    const cats = [a, b, c];
    const ws = [A, B, C, ...helper(cats)];
    const fuse: [string, string][] = [[A, B], [A, C]];
    const m = measure(cats, ws, fuse, inputOf(cats));
    out.push({ kind: '한 몸에 둘', cats, title: `${L(a)} + [${L(b)}, ${L(c)}]`, weapons: ws, fuse, input: inputOf(cats) ?? undefined, ...m, score: m.reacts * Math.min(m.ratio, 3) });
  }
}
// 사슬: A 가 남긴 상태에 B 가 반응하고, B 가 남긴 상태에 C 가 반응
for (const a of CATS) for (const b of CATS) {
  if (!reacts(a, b) || !CAT4[b].leaves || b === 'hand') continue;
  for (const c of CATS) {
    if (c === a || c === b || c === 'hand' || !(CAT4[b].leaves === CAT4[c].seeks)) continue;
    const A = A0(a);
    const B = W(a, b);
    const C = W(b, c);
    if (A === B || B === C || A === C) continue;
    const cats = [a, b, c];
    const ws = [A, B, C, ...helper(cats)];
    const fuse: [string, string][] = [[B, C], [A, B]];
    const m = measure(cats, ws, fuse, inputOf(cats));
    out.push({ kind: '사슬', cats, title: `${L(a)} → ${L(b)} → ${L(c)}`, weapons: ws, fuse, input: inputOf(cats) ?? undefined, ...m, score: m.reacts * Math.min(m.ratio, 3) });
  }
}

/** 고르기: 종류마다 점수 순, 같은 A 는 두 번까지, 같은 짝(갈래 둘)은 한 번, 한 갈래가 B 로 나오는 건 전체에서 두 번까지 (여러 반응이 보이게) */
const bCount = new Map<string, number>();
const pairs = new Set<string>();
function pick(kind: Fun['kind'], k: number): Fun[] {
  const got: Fun[] = [];
  const aCount = new Map<string, number>();
  for (const f of out.filter((x) => x.kind === kind && x.ratio >= 1).sort((p, q) => q.score - p.score)) {
    if (got.length >= k) break;
    const a = f.cats[0];
    if ((aCount.get(a) ?? 0) >= 2) continue;
    const bs = f.cats.slice(1);
    if (bs.some((b) => (bCount.get(b) ?? 0) >= 2)) continue;
    const ps = bs.map((b, i) => `${i === 0 || kind !== '사슬' ? a : f.cats[i]}>${b}`);
    if (ps.some((p) => pairs.has(p))) continue;
    got.push(f);
    aCount.set(a, (aCount.get(a) ?? 0) + 1);
    for (const b of bs) bCount.set(b, (bCount.get(b) ?? 0) + 1);
    for (const p of ps) pairs.add(p);
  }
  return got;
}

const picked = [...pick('둘', 6), ...pick('한 몸에 둘', 5), ...pick('사슬', 5)];
for (const f of picked) console.log(`${f.kind.padEnd(6)} ${f.title.padEnd(26)} 반응 ${String(f.reacts).padStart(3)}  처치 ×${f.ratio.toFixed(2)}  점수 ${f.score.toFixed(0)}`);
console.log(`\n후보 ${out.length} (둘 ${out.filter((x) => x.kind === '둘').length}, 한 몸에 둘 ${out.filter((x) => x.kind === '한 몸에 둘').length}, 사슬 ${out.filter((x) => x.kind === '사슬').length})`);
if (process.argv.includes('--write')) {
  writeFileSync('tools/showcase/pages/fun-results.ts', `// npx tsx tools/carry/fun.ts --write 로 고른 재밌을 조합 (극적 반응, 18초 두 판)\nimport type { AttackCat } from '../../../src/data/links';\n\nexport const FUN: { kind: string; cats: AttackCat[]; title: string; weapons: string[]; fuse: [string, string][]; input?: string; ratio: number; reacts: number }[] = ${JSON.stringify(picked.map(({ score: _s, ...f }) => f), null, 2)};\n`);
}
