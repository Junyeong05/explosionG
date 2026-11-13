// 보통 도파민 엔드리스 봇 판에서 합성 카드가 처음 나오는 때 · 처음 고르는 때 · 판 끝까지 합성 수
//   npx tsx tools/chaos/fuse-when.ts [판 수=8]
import { FIXED_DT } from '../../src/data/balance';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const runs = Number(process.argv[2] ?? 8);
const rows: string[] = [];
const firstOffer: number[] = [];
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  let offerAt = -1;
  let seen = 0;
  let lastOffer: unknown = null;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    if (w.offer && w.offer !== lastOffer) {
      lastOffer = w.offer;
      if (w.offer.choices.some((c) => c.startsWith('fuse:'))) {
        seen++;
        if (offerAt < 0) offerAt = w.time;
      }
    }
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
  }
  const fused = w.chaos?.fusion.kids.size ?? 0;
  if (offerAt >= 0) firstOffer.push(offerAt);
  rows.push(`씨앗 ${s}: 첫 합성 카드 ${offerAt < 0 ? '없음' : `${(offerAt / 60).toFixed(1)}분`} · 합성 카드 나온 레벨 업 ${seen}번 · 합친 몸 ${fused} · 웨이브 ${w.wave} (${(w.time / 60).toFixed(1)}분)`);
}
console.log(rows.join('\n'));
const med = [...firstOffer].sort((a, b) => a - b)[Math.floor(firstOffer.length / 2)] ?? -1;
console.log(`첫 합성 카드 가운데값 ${(med / 60).toFixed(1)}분 · 나온 판 ${firstOffer.length}/${runs}`);
