import { levers } from './levers2';
import { dist, f2 } from './stats';
const L = levers();
console.log('T', L.T, 'Sbar', L.Sbar);
const ka = [...L.kA.values()], kg = [...L.kG.values()];
const d = dist(ka); console.log('kA', f2(d.med), f2(d.p10), f2(d.p90), 'clamp lo', ka.filter(k=>k<=0.25).length, 'hi', ka.filter(k=>k>=4).length);
const g = dist(kg); console.log('kG', f2(g.med), f2(g.p10), f2(g.p90), 'clamp lo', kg.filter(k=>k<=0.25).length, 'hi', kg.filter(k=>k>=4).length);
console.log('B table', [...L.bMean].map(([k,v])=>k+' '+Math.exp(v).toFixed(2)).join(', '));
console.log('two r2', L.two.r2);
const R = (k: number, s: number) => (k + 2) / (s + 2);
const el: number[] = [], r025: number[] = [], r4: number[] = [];
for (const p of L.lev1.filter((p: any) => !p.rep)) {
  const r = L.p3.get(L.key(p))!;
  const a = R(p.cal[0.25], r.s.kills), b = R(p.cal[4], r.s.kills);
  el.push(Math.log(b / a) / Math.log(16)); r025.push(a); r4.push(b);
}
const e = dist(el); console.log('elasticity ln r / ln s (0.25→4):', f2(e.med), f2(e.p10), f2(e.p90));
const a = dist(r025), b = dist(r4); console.log('r@0.25', f2(a.med), f2(a.p10), f2(a.p90), 'r@1', '...', 'r@4', f2(b.med), f2(b.p10), f2(b.p90));
console.log('r@0.25 > T', r025.filter(x=>x>L.T).length, ' r@4 < T', r4.filter(x=>x<L.T).length, 'of', r025.length);
