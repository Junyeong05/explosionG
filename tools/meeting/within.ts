/** 같은 갈래 짝 안 편차 · 대표 짝 치우침 · 셋 한 몸 상한 확인: MEET_OUT=<폴더> npx tsx tools/meeting/within.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { OUT } from './common';
import { dist, f2, med, sd } from './stats';
const rows: any[] = readdirSync(OUT).filter((f) => /^pairs-235-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
for (const L of [3]) {
  const by = new Map<string, number[]>();
  for (const r of rows.filter((r) => r.L === L && !r.rep)) {
    const k = r.ca + '>' + r.cb;
    (by.get(k) ?? by.set(k, []).get(k)!).push((r.f.kills + 2) / (r.s.kills + 2));
  }
  const mm = [...by.values()].map((v) => Math.max(...v) / Math.min(...v));
  const s = [...by.values()].map((v) => sd(v.map(Math.log)));
  console.log(`등급 ${L} 같은 갈래 짝 안 (무기 넷): 최대/최소 가운데 ×${f2(med(mm))} p90 ×${f2(dist(mm).p90)} · ln sd 가운데 ${f2(med(s))}`);
  // 대표 짝이 같은 갈래 짝 무작위 넷의 가운데값과 얼마나 다른가
  const rep = new Map(rows.filter((r) => r.L === L && r.rep).map((r) => [r.ca + '>' + r.cb, (r.f.kills + 2) / (r.s.kills + 2)] as const));
  const dev = [...by].map(([k, v]) => rep.get(k)! / med(v));
  console.log(`대표 짝 ÷ 같은 갈래 짝 무작위 가운데: 가운데 ×${f2(med(dev))} · p10 ×${f2(dist(dev).p10)} · p90 ×${f2(dist(dev).p90)}`);
}
const tr: any[] = readdirSync(OUT).filter((f) => /^triples-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
console.log('triples full kills > 250:', tr.flatMap((t) => t.full).filter((f: any) => f.kills > 250).length, '/', tr.length * 6, ' half >250:', tr.flatMap((t) => t.half).filter((f: any) => f.kills > 250).length);
// 두 몸 합성과 비교: 같은 셋의 두 몸 상태 비율
const R = (k: number, s: number) => (k + 2) / (s + 2);
const half = tr.flatMap((t) => t.half.map((h: any) => R(h.kills, t.sep.kills)));
const d = dist(half); console.log(`두 몸 + 셋째 따로 ÷ 셋 따로: 가운데 ×${f2(d.med)} p10 ×${f2(d.p10)} p90 ×${f2(d.p90)} CV ${f2(d.cv)} ln sd ${f2(sd(half.map(Math.log)))}`);
const full = tr.flatMap((t) => t.full.map((h: any) => R(h.kills, t.sep.kills)));
console.log(`셋 한 몸 ln sd ${f2(sd(full.map(Math.log)))} · p90/p10 ×${f2(dist(full).spread)}`);
