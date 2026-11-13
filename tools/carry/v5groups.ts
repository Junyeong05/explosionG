/**
 * 합성 v5 미리보기 · 측정이 같이 쓰는 "같은 갈래, 다른 무기" 묶음 (브라우저에서도 돌게 node 모듈 없이).
 * 갈래 짝 하나에 A 무기·B 무기를 바꿔 넷: B 는 성질이 다른 것끼리, A 는 갈래 안에서 고루.
 */
import { ARMS } from '../../src/data/chaos';
import { traitOf } from '../../src/data/combineV4';
import type { AttackCat } from '../../src/data/links';

export const GROUPS: [AttackCat, AttackCat][] = [
  ['trap', 'summon'],
  ['trap', 'charge'],
  ['gun', 'magic'],
  ['swarm', 'ray'],
];

const pool = (cat: AttackCat) =>
  Object.values(ARMS)
    .filter((w) => w.cat === cat && !w.fusion)
    .map((w) => w.id)
    .sort();

/** 갈래 짝 하나에서 무기 짝 n 개 */
export function groupPairs(a: AttackCat, b: AttackCat, n = 4): [string, string][] {
  const As = pool(a);
  const Bs = pool(b);
  // B: 성질마다 하나씩 (많은 성질부터 고르면 늘 같은 것만 나와서, 드문 성질부터)
  const byT = new Map<string, string[]>();
  for (const id of Bs) {
    const t = traitOf(id) ?? '-';
    const l = byT.get(t) ?? [];
    l.push(id);
    byT.set(t, l);
  }
  const ts = [...byT.keys()].sort((x, y) => byT.get(x)!.length - byT.get(y)!.length || x.localeCompare(y));
  const pickB: string[] = [];
  for (let round = 0; pickB.length < n && round < 4; round++) for (const t of ts) if (pickB.length < n && byT.get(t)![round]) pickB.push(byT.get(t)![round]);
  // A: 갈래 안에서 고루 (간격을 두고)
  const step = Math.max(1, Math.floor(As.length / n));
  return pickB.map((B, i) => [As[(i * step) % As.length], B]);
}
