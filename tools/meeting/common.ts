/** 회의 측정 공통: 무기 풀 · 표본 · 결과 폴더 */
import { ARMS, ATTACK_CATEGORIES } from '../../src/data/chaos';
import type { AttackCat } from '../../src/data/links';
import { rng } from './harness';

export const OUT = process.env.MEET_OUT ?? '/tmp/meeting-raw';
export const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
export const pool = (cat: string) =>
  Object.values(ARMS)
    .filter((w) => w.cat === cat && !w.fusion)
    .map((w) => w.id)
    .sort();
export const ALL = CATS.flatMap((c) => pool(c));
/** 등급 → 적 체력 배율 (tools/carry/grade.ts 와 같음) */
export const HP: Record<number, number> = { 1: 3, 2: 5, 3: 7, 4: 10, 5: 14 };

/** 갈래 짝 210 × 무기 짝 k (같은 갈래 안에서 무작위, 씨앗 고정) + 대표 짝 */
export function pairSample(k = 4): { A: string; B: string; rep: boolean }[] {
  const R = rng(20261125);
  const out: { A: string; B: string; rep: boolean }[] = [];
  for (const a of CATS)
    for (const b of CATS) {
      if (a === b) continue;
      const As = R.shuffle(pool(a)).slice(0, k);
      const Bs = R.shuffle(pool(b)).slice(0, k);
      for (let i = 0; i < k; i++) out.push({ A: As[i], B: Bs[i], rep: false });
    }
  return out;
}

export const shardArgs = () => {
  const i = Number(process.argv[2] ?? 0);
  const n = Number(process.argv[3] ?? 1);
  return { i, n, mine: <T>(xs: T[]) => xs.filter((_, j) => j % n === i) };
};
