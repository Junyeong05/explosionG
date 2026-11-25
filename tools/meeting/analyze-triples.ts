/** 겹친 합성 정리: MEET_OUT=<폴더> npx tsx tools/meeting/analyze-triples.ts */
import { readFileSync, readdirSync } from 'node:fs';
import { ARMS, CATEGORY_LABEL } from '../../src/data/chaos';
import { OUT } from './common';
import { dist, f2, med, pct } from './stats';

const rows: any[] = readdirSync(OUT).filter((f) => /^triples-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
const R = (k: number, s: number) => (k + 2) / (s + 2);
const all: number[] = [];
const best: number[] = [];
const worst: number[] = [];
const bw: number[] = [];
const kidOrd: number[] = [];
const bodyEff: number[] = [];
const path: number[] = [];
const midDiff: number[] = [];
const addThird: number[] = [];
const addThirdLow: number[] = [];
const absF: number[] = [];
const absS: number[] = [];
const bestBody = new Map<string, number>();
for (const t of rows) {
  const S = t.sep.kills;
  absS.push(S);
  const rs = t.full.map((f: any) => R(f.kills, S));
  all.push(...rs);
  for (const f of t.full) absF.push(f.kills);
  best.push(Math.max(...rs));
  worst.push(Math.min(...rs));
  bw.push(Math.max(...rs) / Math.min(...rs));
  const per: number[] = [];
  for (let x = 0; x < 3; x++) {
    const fs = t.full.filter((f: any) => f.body === x);
    const a = R(fs[0].kills, S), b = R(fs[1].kills, S);
    kidOrd.push(Math.max(a, b) / Math.min(a, b));
    per.push(Math.sqrt(a * b));
    // 같은 몸, 순서만 다른 길: A+B → +C 와 A+C → +B (중간 상태 + 마지막)
    const hY = t.half.find((h: any) => h.body === x && h.kid === fs[0].kids[0]);
    const hZ = t.half.find((h: any) => h.body === x && h.kid === fs[1].kids[0]);
    const m1 = R(hY.kills, S), m2 = R(hZ.kills, S);
    midDiff.push(Math.max(m1, m2) / Math.min(m1, m2));
    path.push(Math.max(a, b) / Math.min(a, b));
    // 셋째를 몸에 넣기 vs 따로 둔 채 (두 몸 상태)
    addThird.push(a / m1, b / m2);
  }
  bodyEff.push(Math.max(...per) / Math.min(...per));
  const bx = per.indexOf(Math.max(...per));
  const c = CATEGORY_LABEL[t.cats[bx] as never];
  bestBody.set(c, (bestBody.get(c) ?? 0) + 1);
}
const line = (lab: string, a: number[]) => {
  const d = dist(a);
  console.log(`${lab}: 가운데 ×${f2(d.med)} · p10 ×${f2(d.p10)} · p90 ×${f2(d.p90)} · 최대 ×${f2(d.max)} · 최소 ×${f2(d.min)} · CV ${f2(d.cv)}`);
};
console.log(`묶음 ${rows.length} (등급 3, 적 ×10)`);
line('셋 한 몸 합침÷셋 따로 (순서 여섯 모두)', all);
line('묶음마다 가장 좋은 순서', best);
line('묶음마다 가장 나쁜 순서', worst);
line('묶음 안 가장 좋은÷가장 나쁜 순서', bw);
line('같은 몸, 넣은 순서만 다름 (A+B→+C vs A+C→+B 마지막)', kidOrd);
line('같은 몸, 중간 상태 (A+B 에 C 따로 vs A+C 에 B 따로)', midDiff);
line('몸을 무엇으로 (세 몸 중 좋은÷나쁜, 넣은 순서 평균)', bodyEff);
line('셋째를 몸에 넣기 ÷ 둘 합친 채 셋째 따로', addThird);
console.log(`셋째를 넣어 오히려 약해짐: ${pct(addThird.filter((x) => x < 1).length / addThird.length)}`);
const ds = dist(absS), df = dist(absF);
console.log(`셋 따로 처치 p90/p10 ×${f2(ds.spread)} → 셋 한 몸 처치 p90/p10 ×${f2(df.spread)} (CV ${f2(ds.cv)} → ${f2(df.cv)})`);
console.log('가장 좋은 몸 갈래 (묶음 수):', [...bestBody].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
