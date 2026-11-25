/** 지렛대 정리: MEET_OUT=<폴더> npx tsx tools/meeting/analyze-levers.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { CATEGORY_LABEL } from '../../src/data/chaos';
import { OUT } from './common';
import { levers } from './levers2';
import { corr, dist, f2, med, pct, sd } from './stats';

const L = levers();
const lev2: any[] = readdirSync(OUT).filter((f) => /^lev2-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const pairs: any[] = readdirSync(OUT).filter((f) => /^pairs-235-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const p5 = new Map(pairs.filter((r) => r.L === 5).map((r) => [L.key(r), r] as const));
const l1 = new Map(L.lev1.map((p) => [L.key(p), p] as const));
const R = (k: number, s: number) => (k + 2) / (s + 2);
const rows = lev2.filter((r) => !r.rep);
console.log(`짝 ${rows.length} (무작위) · 목표 비율 T ×${f2(L.T)} · 따로 처치 가운데 ${L.Sbar}`);

// 씨앗 흔들림: 같은 짝, 씨앗 12·31 vs 47·58 (배율 1)
const a = rows.map((r) => Math.log(R(L.p3.get(L.key(r))!.f.kills, L.p3.get(L.key(r))!.s.kills)));
const b = rows.map((r) => { const p = l1.get(L.key(r))!; return Math.log(R(p.fh, p.sh)); });
const noise = sd(a.map((x, i) => x - b[i])) / Math.SQRT2;
console.log(`씨앗 흔들림: ln 비율 두 측정 상관 ${f2(corr(a, b))} · 측정 하나(두 판)의 ln 흔들림 sd ${f2(noise)} (≈ ×${f2(Math.exp(noise))}) · 전체 ln sd ${f2(sd(a))} → 흔들림이 분산의 ${pct(noise ** 2 / sd(a) ** 2)}`);

const line = (lab: string, rat: number[], abs: number[], ks?: number[]) => {
  const d = dist(rat);
  const ad = dist(abs);
  const lnsd = sd(rat.map(Math.log));
  console.log(`| ${lab} | ×${f2(d.med)} | ×${f2(d.p10)} | ×${f2(d.p90)} | ×${f2(d.spread)} | ${f2(d.cv)} | ${f2(lnsd)} | ${pct(rat.filter((x) => x < 1).length / rat.length)} | ${pct(rat.filter((x) => x < 1.3).length / rat.length)} | ${pct(rat.filter((x) => x > 3).length / rat.length)} | ×${f2(ad.spread)} | ${f2(ad.cv)} | ${ks ? `${f2(med(ks))} (${pct(ks.filter((k) => k <= 0.2501 || k >= 3.999).length / ks.length)})` : '-'} |`);
};
console.log('\n등급 3, 맞춤에 안 쓴 씨앗 47·58 (무작위 840)');
console.log('| 지렛대 | 합침÷따로 가운데 | p10 | p90 | p90/p10 | CV | ln sd | ×1 아래 | ×1.3 아래 | ×3 넘음 | 합친 처치 p90/p10 | 합친 CV | k 가운데 (묶임) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const sh = (r: any) => l1.get(L.key(r))!.sh;
line('지금 (배율 1)', rows.map((r) => R(l1.get(L.key(r))!.fh, sh(r))), rows.map((r) => l1.get(L.key(r))!.fh));
const names: Record<string, string> = { b15: 'β15 B 갈래 표 (15개)', b30: 'β30 두 갈래 표 (30개)', a: 'α 짝 예산 (짝마다 비율 맞춤)', g: 'γ 절대 띠 (짝마다 처치 맞춤)' };
for (const n of ['b15', 'b30', 'a', 'g']) line(names[n], rows.map((r) => R(r.h[n], sh(r))), rows.map((r) => r.h[n]), rows.map((r) => r.ks[n]));
const noMg = rows.filter((r) => !r.A.startsWith('arm_m_') && !r.B.startsWith('arm_m_'));
console.log(`\n(주문 뺀 ${noMg.length})`);
line('지금 (배율 1)', noMg.map((r) => R(l1.get(L.key(r))!.fh, sh(r))), noMg.map((r) => l1.get(L.key(r))!.fh));
for (const n of ['b15', 'b30', 'a', 'g']) line(names[n], noMg.map((r) => R(r.h[n], sh(r))), noMg.map((r) => r.h[n]), noMg.map((r) => r.ks[n]));

// 같은 k 로 등급 5: 등급이 주는 차이가 남나
console.log('\n같은 k 를 등급 5 에 (씨앗 12·31, 적 ×14)');
const r5 = rows.map((r) => { const q = p5.get(L.key(r))!; return R(q.f.kills, q.s.kills); });
const r3 = rows.map((r) => { const q = L.p3.get(L.key(r))!; return R(q.f.kills, q.s.kills); });
console.log(`지금: 등급 3 가운데 ×${f2(med(r3))} → 등급 5 ×${f2(med(r5))} (CV ${f2(dist(r5).cv)}, p90/p10 ×${f2(dist(r5).spread)})`);
for (const n of ['b30', 'a']) {
  const x5 = rows.map((r) => R(r.g5[n], p5.get(L.key(r))!.s.kills));
  const x3 = rows.map((r) => R(r.h[n], sh(r)));
  console.log(`${names[n]}: 등급 3 ×${f2(med(x3))} → 등급 5 ×${f2(med(x5))} (CV ${f2(dist(x5).cv)}, p90/p10 ×${f2(dist(x5).spread)}) · 짝마다 등급5÷등급3 가운데 ×${f2(med(x5.map((v, i) => v / x3[i])))}`);
}
const t = JSON.parse(readFileSync(`${OUT}/lev-tables.json`, 'utf8'));
console.log('\nβ15 B 갈래 배율:', Object.entries(t.bMean).sort((x: any, y: any) => x[1] - y[1]).map(([k, v]: any) => `${CATEGORY_LABEL[k as never]} ×${f2(v)}`).join(' · '));
console.log('β30 A 갈래 몫:', Object.entries(t.A).sort((x: any, y: any) => x[1] - y[1]).map(([k, v]: any) => `${CATEGORY_LABEL[k as never]} ×${f2(v)}`).join(' · '));
console.log('β30 B 갈래 몫:', Object.entries(t.B).sort((x: any, y: any) => x[1] - y[1]).map(([k, v]: any) => `${CATEGORY_LABEL[k as never]} ×${f2(v)}`).join(' · '), `· 바탕 ×${f2(t.mu)}`);
