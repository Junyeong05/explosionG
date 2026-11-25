/**
 * 지렛대 2단계: 1단계 맞춤(배율 ×0.25~4 처치 곡선, 씨앗 12·31)에서 짝마다 B 반응 세기 배율 k 를 정하고,
 * 맞춤에 안 쓴 씨앗 47·58 로 다시 돌려 편차가 얼마나 줄었나 본다 (등급 3). 같은 k 로 등급 5 도 (씨앗 12·31).
 *   α 짝 예산: 짝마다 합침÷따로 = 가운데값(T) 이 되게 (이상적인 위 한계, 무기 짝 11만에 짝마다는 못 함)
 *   β15 B 갈래 표: α 의 ln k 를 B 갈래로 평균 (숫자 15개)
 *   β30 두 갈래 표: ln k ≈ a[A 갈래] + b[B 갈래] (숫자 30개)
 *   γ 절대 띠: 합친 무기 처치 = T × 따로 처치 가운데값 이 되게 (재료 힘까지 맞춤, 짝마다)
 *   MEET_OUT=<폴더> npx tsx tools/meeting/levers2.ts <shard> <n>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { ARMS } from '../../src/data/chaos';
import { inputFor } from '../../src/data/combineV2';
import { HP, OUT, shardArgs } from './common';
import { simSeeds } from './harness';
import { med, r2two } from './stats';

const key = (p: { A: string; B: string; rep: boolean }) => `${p.A}>${p.B}${p.rep ? '*' : ''}`;

export function levers() {
  const lev1: any[] = readdirSync(OUT).filter((f) => /^lev1-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const pairs: any[] = readdirSync(OUT).filter((f) => /^pairs-235-\d\.json$/.test(f)).flatMap((f) => JSON.parse(readFileSync(`${OUT}/${f}`, 'utf8')));
  const p3 = new Map(pairs.filter((r) => r.L === 3).map((r) => [key(r), r] as const));
  const R = (k: number, s: number) => (k + 2) / (s + 2);
  const rnd = lev1.filter((p) => !p.rep);
  const T = med(rnd.map((p) => { const r = p3.get(key(p))!; return R(r.f.kills, r.s.kills); }));
  const Sbar = med(rnd.map((p) => p3.get(key(p))!.s.kills));
  /** 처치 곡선에서 비율 target 이 되는 배율 (log-log 선형, 단조로 펴서, ×0.25~4 에 묶음) */
  const solve = (p: any, target: number) => {
    const r = p3.get(key(p))!;
    const xs = [0.25, 0.5, 1, 2, 4];
    const ys = xs.map((m) => R(m === 1 ? r.f.kills : p.cal[m], r.s.kills));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1]);
    if (target <= ys[0]) return 0.25;
    if (target >= ys[4]) return 4;
    for (let i = 0; i < 4; i++)
      if (target <= ys[i + 1]) {
        const a = Math.log(ys[i]), b = Math.log(ys[i + 1]);
        const t = b > a ? (Math.log(target) - a) / (b - a) : 0;
        return Math.exp(Math.log(xs[i]) + t * (Math.log(xs[i + 1]) - Math.log(xs[i])));
      }
    return 1;
  };
  const kA = new Map<string, number>();
  const kG = new Map<string, number>();
  for (const p of lev1) {
    const s = p3.get(key(p))!.s.kills;
    kA.set(key(p), solve(p, T));
    kG.set(key(p), solve(p, T * (Sbar + 2) / (s + 2)));
  }
  // 표는 무작위 840 으로 맞춘다
  const lk = rnd.map((p) => Math.log(kA.get(key(p))!));
  const ca = rnd.map((p) => ARMS[p.A].cat as string);
  const cb = rnd.map((p) => ARMS[p.B].cat as string);
  const bMean = new Map<string, number>();
  for (const c of new Set(cb)) bMean.set(c, med(lk.filter((_, i) => cb[i] === c)));
  const two = r2two(lk, ca, cb);
  const k15 = (p: any) => Math.exp(bMean.get(ARMS[p.B].cat)!);
  const k30 = (p: any) => Math.min(4, Math.max(0.25, Math.exp(two.mu + two.a.get(ARMS[p.A].cat)! + two.b.get(ARMS[p.B].cat)!)));
  return { lev1, p3, T, Sbar, kA, kG, k15, k30, bMean, two, key };
}

if (process.argv[1]?.endsWith('levers2.ts')) {
  const { i, mine } = shardArgs();
  const L = levers();
  const t0 = Date.now();
  const rows: any[] = [];
  for (const p of mine(L.lev1)) {
    const input = inputFor(ARMS[p.A].cat as never, ARMS[p.B].cat as never);
    const ks: Record<string, number> = { a: L.kA.get(key(p))!, b15: L.k15(p), b30: L.k30(p), g: L.kG.get(key(p))! };
    const h: Record<string, number> = {};
    const g5: Record<string, number> = {};
    for (const [n, k] of Object.entries(ks)) {
      h[n] = simSeeds([p.A, p.B], [[p.A, p.B]], { level: 3, hp: HP[3], input, mul: k }, [47, 58]).kills;
      if (n === 'a' || n === 'b30') g5[n] = simSeeds([p.A, p.B], [[p.A, p.B]], { level: 5, hp: HP[5], input, mul: k }, [12, 31]).kills;
    }
    rows.push({ A: p.A, B: p.B, rep: p.rep, ks, h, g5 });
  }
  writeFileSync(`${OUT}/lev2-${i}.json`, JSON.stringify(rows));
  if (i === 0) writeFileSync(`${OUT}/lev-tables.json`, JSON.stringify({ T: L.T, Sbar: L.Sbar, bMean: Object.fromEntries([...L.bMean].map(([k, v]) => [k, Math.exp(v)])), A: Object.fromEntries([...L.two.a].map(([k, v]) => [k, Math.exp(v)])), B: Object.fromEntries([...L.two.b].map(([k, v]) => [k, Math.exp(v)])), mu: Math.exp(L.two.mu) }));
  console.log(`lev2 shard ${i}: ${rows.length} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}
