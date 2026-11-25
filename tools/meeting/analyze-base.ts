/** 기본 편차 정리: MEET_OUT=<폴더> npx tsx tools/meeting/analyze-base.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { CATEGORY_LABEL } from '../../src/data/chaos';
import { OUT } from './common';
import { dist, f1, f2, med, pct, r2one, spearman } from './stats';

const rows: any[] = readdirSync(OUT).filter((f) => /^base-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
console.log(`무기 ${rows.length}`);
const zero = rows.filter((r) => r.d3 < 50);
console.log(`레벨3 피해가 거의 0 (주문 등): ${zero.length} — ${[...new Set(zero.map((r) => r.cat))].join(',')}`);
// 주문은 피해가 없고, 폭탄 탭·지뢰 손은 피해가 무기 몫으로 안 잡혀(처치는 됨) 피해 통계에서 뺀다
const dmgW = rows.filter((r) => r.cat !== 'magic' && r.d3 > 0);
for (const [lab, key] of [['피해 L3 (적 ×7, 18초 두 판 합)', 'd3'], ['처치 L3', 'k3'], ['정지 표적 초당 피해 L3 (D 기준)', 'sdps3'], ['피해 L1', 'd1'], ['피해 L5', 'd5']] as const) {
  const d = dist(dmgW.map((r) => r[key]));
  console.log(`${lab}: 가운데 ${f1(d.med)} · p10 ${f1(d.p10)} · p90 ${f1(d.p90)} · p90/p10 ×${f2(d.spread)} · 최대/최소 ×${f1(d.mm)} · CV ${f2(d.cv)}`);
}
const ln = (x: number) => Math.log(Math.max(1, x));
console.log(`ln(피해 L3) 분산 중 갈래가 설명 ${pct(r2one(dmgW.map((r) => ln(r.d3)), dmgW.map((r) => r.cat)))} (주문 뺌)`);
console.log(`순위 상관 피해L3 vs 정지DPS ${f2(spearman(dmgW.map((r) => r.d3), dmgW.map((r) => r.sdps3)))} · vs 처치 ${f2(spearman(dmgW.map((r) => r.d3), dmgW.map((r) => r.k3)))}`);
// 레벨 차이
const g31 = dmgW.filter((r) => r.d1 > 50).map((r) => r.d3 / r.d1);
const g51 = dmgW.filter((r) => r.d1 > 50).map((r) => r.d5 / r.d1);
const g53 = dmgW.filter((r) => r.d3 > 50).map((r) => r.d5 / r.d3);
console.log(`레벨 효과 (같은 무기, 피해): L3/L1 가운데 ×${f2(med(g31))} (p10 ${f2(dist(g31).p10)}, p90 ${f2(dist(g31).p90)}) · L5/L1 ×${f2(med(g51))} (p10 ${f2(dist(g51).p10)}, p90 ${f2(dist(g51).p90)}) · L5/L3 ×${f2(med(g53))}`);
console.log('\n| 갈래 | 무기 수 | 피해 L3 가운데 | p10 | p90 | p90/p10 | 최대/최소 | CV | 처치 L3 가운데 | L5/L1 가운데 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const cats = [...new Set(rows.map((r) => r.cat))];
const lines: [number, string][] = [];
for (const c of cats) {
  const rs = rows.filter((r) => r.cat === c && (c === 'magic' || r.d3 > 0));
  const d = dist(rs.map((r) => r.d3));
  const g = rs.filter((r) => r.d1 > 50).map((r) => r.d5 / r.d1);
  lines.push([d.med, `| ${CATEGORY_LABEL[c as never]} | ${rs.length} | ${d.med.toFixed(0)} | ${d.p10.toFixed(0)} | ${d.p90.toFixed(0)} | ×${f2(d.spread)} | ×${f1(d.mm)} | ${f2(d.cv)} | ${med(rs.map((r) => r.k3))} | ${g.length ? '×' + f2(med(g)) : '-'} |`]);
}
lines.sort((a, b) => b[0] - a[0]).forEach(([, s]) => console.log(s));
const cm = cats.filter((c) => c !== 'magic').map((c) => med(rows.filter((r) => r.cat === c).map((r) => r.d3)));
console.log(`\n갈래 가운데값끼리 최대/최소 ×${f2(Math.max(...cm) / Math.min(...cm))} (주문 뺌)`);
const top = [...dmgW].sort((a, b) => b.d3 - a.d3);
console.log('세기 위 5:', top.slice(0, 5).map((r) => `${r.name}(${r.cat}) ${r.d3}`).join(' · '));
console.log('세기 아래 5:', top.slice(-5).map((r) => `${r.name}(${r.cat}) ${r.d3}`).join(' · '));
