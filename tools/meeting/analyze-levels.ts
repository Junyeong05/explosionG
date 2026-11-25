/** 레벨 차이 vs 조합 차이: MEET_OUT=<폴더> npx tsx tools/meeting/analyze-levels.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { OUT } from './common';
import { dist, f2, med, pct, sd } from './stats';

const rows: any[] = readdirSync(OUT).filter((f) => /^levels-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const nm = rows.filter((r) => !r.A.startsWith('arm_m_') && !r.B.startsWith('arm_m_'));
for (const [lab, rs] of [['무작위 840', rows], ['주문 뺌', nm]] as const) {
  console.log(`\n(${lab} ${rs.length}, 적 ×10, 18초 두 판)`);
  for (const k of ['s2', 's5', 'f2', 'f5']) {
    const d = dist(rs.map((r) => r[k]));
    console.log(`${k}: 가운데 ${d.med.toFixed(0)} · p10 ${d.p10.toFixed(0)} · p90 ${d.p90.toFixed(0)} · p90/p10 ×${f2(d.spread)} · CV ${f2(d.cv)} · ln sd ${f2(sd(rs.map((r) => Math.log(r[k] + 2))))} · 상한(>250) ${rs.filter((r) => r[k] > 250).length}`);
  }
  const up = rs.map((r) => (r.f5 + 2) / (r.f2 + 2));
  const ups = rs.map((r) => (r.s5 + 2) / (r.s2 + 2));
  console.log(`같은 짝 레벨 2→5: 합친 무기 처치 가운데 ×${f2(med(up))} (p10 ×${f2(dist(up).p10)}, p90 ×${f2(dist(up).p90)}) · 따로 ×${f2(med(ups))}`);
  const m5 = med(rs.map((r) => r.f5));
  const m2 = med(rs.map((r) => r.f2));
  console.log(`레벨 2 합성 중 레벨 5 합성 가운데값(${m5})을 넘는 몫 ${pct(rs.filter((r) => r.f2 > m5).length / rs.length)} · 레벨 5 합성 중 레벨 2 가운데값(${m2}) 아래 ${pct(rs.filter((r) => r.f5 < m2).length / rs.length)}`);
  console.log(`ln 처치 (레벨 2·5 합친 무기 모두): 레벨이 설명 ${pct(1 - (sd(rs.map((r) => Math.log(r.f2 + 2))) ** 2 + sd(rs.map((r) => Math.log(r.f5 + 2))) ** 2) / 2 / sd([...rs.map((r) => Math.log(r.f2 + 2)), ...rs.map((r) => Math.log(r.f5 + 2))]) ** 2)} · 나머지(조합) 그 밖`);
}
