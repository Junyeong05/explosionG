// 보통 도파민 엔드리스 봇 판의 합성 카드: 처음 나오는 때 · 레벨 업 가운데 합성 카드가 낀 몫 · 이미 합친 무기가 낀 몫 · 한 몸 크기
//   npx tsx tools/chaos/fuse-when.ts [판 수=8] ['{"BALANCE.chaos 덮어쓰기":…}']
// 합성 카드 종류: 새 짝 (둘 다 아직 안 합침) · 몸에 더함 (A 가 이미 합친 무기) · 몸째 (B 가 이미 합친 무기) · 사슬 (A 가 다른 무기 안에 든 무기)
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { parseFuse } from '../../src/data/combineV4';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const runs = Number(process.argv[2] ?? 8);
Object.assign(BALANCE.chaos as object, JSON.parse(process.argv[3] ?? '{}'));
const rows: string[] = [];
const firstOffer: number[] = [];
const tot = { offers: 0, withFuse: 0, cards: 0, fresh: 0, grow: 0, whole: 0, chain: 0, picked: 0 };
const bodies: number[] = [];
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  let offerAt = -1;
  let seen = 0;
  let offers = 0;
  let lastOffer: unknown = null;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    if (w.offer && w.offer !== lastOffer) {
      lastOffer = w.offer;
      if (w.offer.kind !== 'starter') offers++;
      const fs = w.offer.choices.filter((c) => c.startsWith('fuse:'));
      if (fs.length) {
        seen++;
        if (offerAt < 0) offerAt = w.time;
      }
      const c = w.chaos!;
      for (const id of fs) {
        const p = parseFuse(id)!;
        tot.cards++;
        if (c.parent.has(p[0])) tot.chain++;
        else if (c.fusion.has(p[0])) tot.grow++;
        else if (c.fusion.has(p[1])) tot.whole++;
        else tot.fresh++;
      }
    }
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
  }
  const c = w.chaos!;
  const size = (r: string): number => 1 + (c.fusion.kids.get(r) ?? []).reduce((t, k) => t + size(k), 0);
  const roots = [...c.fusion.kids.keys()].filter((r) => !c.parent.has(r));
  for (const r of roots) bodies.push(size(r));
  tot.offers += offers;
  tot.withFuse += seen;
  tot.picked += c.parent.size;
  if (offerAt >= 0) firstOffer.push(offerAt);
  rows.push(`씨앗 ${s}: 첫 합성 카드 ${offerAt < 0 ? '없음' : `${(offerAt / 60).toFixed(1)}분`} · 레벨 업 ${offers} 중 합성 카드 ${seen} · 합친 무기 ${c.parent.size} · 몸 ${roots.map(size).join('+') || '-'} · 웨이브 ${w.wave} (${(w.time / 60).toFixed(1)}분)`);
}
console.log(rows.join('\n'));
const med = [...firstOffer].sort((a, b) => a - b)[Math.floor(firstOffer.length / 2)] ?? -1;
const pc = (n: number) => `${Math.round((n / Math.max(1, tot.cards)) * 100)}%`;
console.log(`첫 합성 카드 가운데값 ${(med / 60).toFixed(1)}분 · 나온 판 ${firstOffer.length}/${runs}`);
console.log(`레벨 업 ${tot.offers} 중 합성 카드가 낀 것 ${tot.withFuse} (${Math.round((tot.withFuse / Math.max(1, tot.offers)) * 100)}%) · 합성 카드 ${tot.cards}: 새 짝 ${pc(tot.fresh)} · 몸에 더함 ${pc(tot.grow)} · 몸째 ${pc(tot.whole)} · 사슬 ${pc(tot.chain)}`);
console.log(`한 몸 크기 (무기 수): ${bodies.sort((a, b) => b - a).join(' ')} · 가장 큰 몸 가운데값 ${bodies.length ? bodies[Math.floor(bodies.length / 2)] : 0}`);
