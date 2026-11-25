/** 합성 편차 정리: MEET_OUT=<폴더> npx tsx tools/meeting/analyze-pairs.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { ARMS, CATEGORY_LABEL } from '../../src/data/chaos';
import { TRAIT_WORD, fuseName, kind4, reactName, traitOf } from '../../src/data/combineV4';
import { OUT } from './common';
import { dist, f1, f2, med, pct, r2one, r2two, corr } from './stats';

const rows: any[] = readdirSync(OUT).filter((f) => /^pairs-235-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const base = new Map<string, any>(readdirSync(OUT).filter((f) => /^base-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8'))).map((r: any) => [r.id, r]));
const L_ = (c: string) => CATEGORY_LABEL[c as never];
for (const r of rows) {
  // 처치 0 짝이 있어 두 판 합에 +2 씩 (ln 이 무한이 되지 않게)
  r.ratio = (r.f.kills + 2) / (r.s.kills + 2);
  r.mg = r.ca === 'magic' || r.cb === 'magic';
  r.ratioD = r.f.dmg / Math.max(1, r.s.dmg);
  r.kind = kind4(r.ca, r.cb);
  r.trait = traitOf(r.B) ?? '-';
  r.react = r.f.drama / Math.max(1, r.f.fires);
  r.bShare = (r.f.by[r.B] ?? 0) / Math.max(1, r.f.dmg);
}
console.log(`줄 ${rows.length} · 따로 처치 상한 근처(>250/두 판) 합침 ${rows.filter((r) => r.f.kills > 250).length} · 따로 ${rows.filter((r) => r.s.kills > 250).length}`);
for (const L of [2, 3, 5]) console.log(`등급 ${L}: 합침 처치 > 250 (두 판, 상한 ~288 근처) ${rows.filter((r) => r.L === L && r.f.kills > 250).length}/${rows.filter((r) => r.L === L).length}`);
console.log('\n| 등급 (배율) | 표본 | 합침÷따로 가운데 | p10 | p90 | p90/p10 | 최대/최소 | CV | ×1 아래 | ×1.3 아래 | ×3 넘음 | 따로 처치 p90/p10 | 합친 무기 처치 p90/p10 | 합친 CV |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const GM: Record<number, number> = { 2: 0.28, 3: 0.38, 5: 0.72 };
for (const L of [2, 3, 5])
  for (const [lab, sel] of [['무작위 840', (r: any) => !r.rep], ['무작위 중 주문 뺌', (r: any) => !r.rep && !r.mg], ['대표 210', (r: any) => r.rep]] as const) {
    const rs = rows.filter((r) => r.L === L && sel(r));
    const sd_ = dist(rs.map((r) => r.s.kills));
    const d = dist(rs.map((r) => r.ratio));
    const a = dist(rs.map((r) => r.f.kills));
    console.log(`| ${L} (×${GM[L]}) | ${lab} (${rs.length}) | ×${f2(d.med)} | ×${f2(d.p10)} | ×${f2(d.p90)} | ×${f2(d.spread)} | ×${f1(d.mm)} | ${f2(d.cv)} | ${pct(rs.filter((r) => r.ratio < 1).length / rs.length)} | ${pct(rs.filter((r) => r.ratio < 1.3).length / rs.length)} | ${pct(rs.filter((r) => r.ratio > 3).length / rs.length)} | ×${f2(sd_.spread)} | ×${f2(a.spread)} | ${f2(a.cv)} |`);
  }
// 피해 기준 교차 확인
for (const L of [2, 3, 5]) {
  const rs = rows.filter((r) => r.L === L && !r.rep);
  const d = dist(rs.map((r) => r.ratioD));
  console.log(`피해 기준 등급 ${L}: 합침÷따로 가운데 ×${f2(d.med)} p10 ×${f2(d.p10)} p90 ×${f2(d.p90)} CV ${f2(d.cv)} · 처치 비율과 상관 ${f2(corr(rs.map((r) => r.ratio), rs.map((r) => r.ratioD)))}`);
}
// 같은 짝의 등급 2 → 5
const key = (r: any) => `${r.A}>${r.B}`;
const byKey = new Map<string, Record<number, any>>();
for (const r of rows) (byKey.get(key(r)) ?? byKey.set(key(r), {}).get(key(r))!)[r.L] = r;
const g52 = [...byKey.values()].filter((x) => x[2] && x[5] && !x[2].rep && !x[2].mg).map((x) => x[5].ratio / x[2].ratio);
const d52 = [...byKey.values()].filter((x) => x[2] && x[5] && !x[2].rep && x[2].f.dmg > 0).map((x) => x[5].f.dmg / x[2].f.dmg);
console.log(`\n같은 짝 등급5 비율 ÷ 등급2 비율: 가운데 ×${f2(med(g52))} (p10 ×${f2(dist(g52).p10)}, p90 ×${f2(dist(g52).p90)}) · 합친 무기 피해 등급5÷등급2 가운데 ×${f2(med(d52))}`);
const r23 = [...byKey.values()].filter((x) => x[2] && x[3] && !x[2].rep);
console.log(`등급 사이 순위 상관 (짝 비율) 2↔3 ${f2(corr(r23.map((x) => Math.log(x[2].ratio)), r23.map((x) => Math.log(x[3].ratio))))} · 2↔5 ${f2(corr([...byKey.values()].filter((x) => x[2] && x[5] && !x[2].rep).map((x) => Math.log(x[2].ratio)), [...byKey.values()].filter((x) => x[2] && x[5] && !x[2].rep).map((x) => Math.log(x[5].ratio))))}`);

// 무엇이 편차를 만드나 (등급 3, 무작위 840)
for (const L of [3, 5]) {
  for (const nomg of [false, true]) {
  const rs = rows.filter((r) => r.L === L && !r.rep && (!nomg || !r.mg));
  console.log(nomg ? '(주문 뺌)' : '(무작위 840)');
  const y = rs.map((r) => Math.log(r.ratio));
  const yA = rs.map((r) => Math.log(Math.max(1, r.f.kills)));
  console.log(`\n등급 ${L} · ln(합침÷따로) 분산을 설명하는 몫: A 갈래 ${pct(r2one(y, rs.map((r) => r.ca)))} · B 갈래 ${pct(r2one(y, rs.map((r) => r.cb)))} · 두 갈래 더하기 ${pct(r2two(y, rs.map((r) => r.ca), rs.map((r) => r.cb)).r2)} · 갈래 짝(210) ${pct(r2one(y, rs.map((r) => r.ca + '>' + r.cb)))} · 짝 종류(반응/무리/모양/보통) ${pct(r2one(y, rs.map((r) => r.kind)))} · B 성질 ${pct(r2one(y, rs.map((r) => r.trait)))} `);
  console.log(`등급 ${L} · ln(합친 무기 처치) 분산: 재료 따로 처치 ln 과 상관² ${pct(corr(yA, rs.map((r) => Math.log(Math.max(1, r.s.kills)))) ** 2)} · 두 갈래 더하기 ${pct(r2two(yA, rs.map((r) => r.ca), rs.map((r) => r.cb)).r2)}`);
  console.log(`등급 ${L} · 비율과 상관: 반응 몫 ${f2(corr(y, rs.map((r) => r.react)))} · 공명 수 ${f2(corr(y, rs.map((r) => r.f.res)))} · B 피해 몫 ${f2(corr(y, rs.map((r) => r.bShare)))} · A 쿨다운 ln ${f2(corr(y, rs.map((r) => Math.log(Math.max(0.05, ARMS[r.A].cd || 0.05)))))} · B 나간 수 ln ${f2(corr(y, rs.map((r) => Math.log(1 + r.f.fires))))} · 따로 처치 ln ${f2(corr(y, rs.map((r) => Math.log(Math.max(1, r.s.kills)))))}`);
  }
}
const rs3 = rows.filter((r) => r.L === 3 && !r.rep);
const rs3n = rs3.filter((r) => !r.mg);
const tab = (g: (r: any) => string, lab: (k: string) => string, title: string) => {
  const by = new Map<string, any[]>();
  for (const r of rs3) (by.get(g(r)) ?? by.set(g(r), []).get(g(r))!).push(r);
  console.log(`\n| ${title} | 짝 | 비율 가운데 | p10 | p90 | 반응 몫 | 공명/판 |`);
  console.log('|---|---|---|---|---|---|---|');
  [...by].sort((a, b) => med(b[1].map((r) => r.ratio)) - med(a[1].map((r) => r.ratio))).forEach(([k, v]) => {
    const d = dist(v.map((r) => r.ratio));
    console.log(`| ${lab(k)} | ${v.length} | ×${f2(d.med)} | ×${f2(d.p10)} | ×${f2(d.p90)} | ${pct(med(v.map((r) => r.react)))} | ${f2(v.reduce((a, r) => a + r.f.res, 0) / v.length / 2)} |`);
  });
};
tab((r) => r.cb, L_, 'B 갈래 (극적 반응)');
tab((r) => r.ca, L_, 'A 갈래 (몸·쏘는 법)');
tab((r) => r.kind, (k) => k, '짝 종류');
tab((r) => r.trait, (k) => TRAIT_WORD[k as never] ?? k, 'B 성질');
// 위·아래 10
const show = (r: any) => `| ${fuseName(r.A, r.B)} | ${ARMS[r.A].name}(${L_(r.ca)}) + ${ARMS[r.B].name}(${L_(r.cb)}) | ${reactName(r.B)} | ${r.kind} | ×${f2(r.ratio)} | ${r.f.kills}/${r.s.kills} | ${pct(r.react)} | ${r.f.res} | ${pct(r.bShare)} | ${ARMS[r.A].cd}s |`;
const srt = [...rs3n].sort((a, b) => b.ratio - a.ratio);
console.log('\n(위·아래 10: 등급 3, 주문이 안 낀 무작위 짝)');
console.log('\n| 합친 이름 | 재료 | 반응 | 종류 | 합침÷따로 | 처치 합침/따로 | 반응 몫 | 공명 | B 피해 몫 | A 쿨다운 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
srt.slice(0, 10).forEach((r) => console.log(show(r)));
console.log('| … | | | | | | | | | |');
srt.slice(-10).forEach((r) => console.log(show(r)));
