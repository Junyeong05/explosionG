/** 회의 측정 통계 도우미 */
export const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
export const q = (a: number[], p: number) => {
  const s = sorted(a);
  if (!s.length) return NaN;
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
export const med = (a: number[]) => q(a, 0.5);
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
export const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1));
};
export const cv = (a: number[]) => sd(a) / mean(a);
export const corr = (x: number[], y: number[]) => {
  const mx = mean(x), my = mean(y);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < x.length; i++) {
    a += (x[i] - mx) * (y[i] - my);
    b += (x[i] - mx) ** 2;
    c += (y[i] - my) ** 2;
  }
  return a / Math.sqrt(b * c);
};
const rank = (a: number[]) => {
  const idx = a.map((v, i) => [v, i] as const).sort((p, r) => p[0] - r[0]);
  const r = new Array(a.length);
  idx.forEach(([, i], k) => (r[i] = k));
  return r as number[];
};
export const spearman = (x: number[], y: number[]) => corr(rank(x), rank(y));
/** 분포 한 줄 */
export function dist(a: number[]) {
  const s = sorted(a);
  return {
    n: a.length,
    med: med(a),
    p10: q(a, 0.1),
    p90: q(a, 0.9),
    min: s[0],
    max: s[s.length - 1],
    cv: cv(a),
    spread: q(a, 0.9) / q(a, 0.1),
    mm: s[s.length - 1] / Math.max(1e-9, s[0]),
  };
}
export const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
export const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');
export const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
/** y 를 묶음 g 로 설명하는 몫 (R², 한 요인) */
export function r2one(y: number[], g: string[]) {
  const m = mean(y);
  const by = new Map<string, number[]>();
  g.forEach((k, i) => (by.get(k) ?? by.set(k, []).get(k)!).push(y[i]));
  const gm = new Map([...by].map(([k, v]) => [k, mean(v)] as const));
  let ss = 0, st = 0;
  y.forEach((v, i) => {
    ss += (v - gm.get(g[i])!) ** 2;
    st += (v - m) ** 2;
  });
  return 1 - ss / st;
}
/** 두 요인 더하기 모형 y = μ + a[g1] + b[g2] (번갈아 맞춤) → R², 계수 */
export function r2two(y: number[], g1: string[], g2: string[]) {
  const mu = mean(y);
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  for (let it = 0; it < 50; it++) {
    for (const [G, M, O, OM] of [[g1, a, g2, b], [g2, b, g1, a]] as const) {
      const acc = new Map<string, [number, number]>();
      y.forEach((v, i) => {
        const r = v - mu - (OM.get(O[i]) ?? 0);
        const e = acc.get(G[i]) ?? [0, 0];
        e[0] += r;
        e[1]++;
        acc.set(G[i], e);
      });
      for (const [k, [s, n]] of acc) M.set(k, s / n);
    }
  }
  let ss = 0, st = 0;
  y.forEach((v, i) => {
    ss += (v - mu - a.get(g1[i])! - b.get(g2[i])!) ** 2;
    st += (v - mu) ** 2;
  });
  return { r2: 1 - ss / st, mu, a, b };
}
