/**
 * 레드팀 측정 (11-25 회의): 판 전체에서 "어느 짝을 합쳤나" 만으로 얼마나 벌어지나.
 *   POLICY=top|bottom|none npx tsx tools/meeting/red-endless.ts [판 수=12]
 * 보통 봇 · 엔드리스 · 폭=칸. 합성 카드가 뜨면 그 카드를 정책대로 바꿔 끼운다 (봇은 합성 카드를 늘 고른다).
 * top = B 가 손·떼·정령 (210 측정 위 셋), bottom = B 가 장판·주문·소환수 (아래 셋). 칸·레벨·카드 수는 그대로.
 */
import { FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { fuseId, parseFuse } from '../../src/data/combineV4';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const runs = Number(process.argv[2] ?? 12);
const pol = process.env.POLICY ?? 'none';
const TOP = ['hand', 'swarm', 'spirit'];
const BOT = ['field', 'magic', 'summon'];
const waves: number[] = [], mins: number[] = [], swaps: number[] = [];
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true }, fuseRule: (process.env.RULE ?? 'width') as never });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  let last: unknown = null;
  let sw = 0;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    if (w.offer && w.offer !== last) {
      last = w.offer;
      const idx = w.offer.choices.findIndex((c) => c.startsWith('fuse:'));
      if (idx >= 0 && pol !== 'none') {
        const want = pol === 'top' ? TOP : BOT;
        const cs = w.chaos!.fuseCandidates(400).filter(([, b]) => want.includes(ARMS[b].cat));
        if (cs.length) {
          const p = cs[0];
          (w.offer.choices as string[])[idx] = fuseId(p[0], p[1]);
          sw++;
        }
      }
    }
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
  }
  waves.push(w.wave); mins.push(w.time / 60); swaps.push(sw);
  void parseFuse;
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`[${pol}] 웨이브 평균 ${avg(waves).toFixed(1)} (${Math.min(...waves)}~${Math.max(...waves)}) · ${avg(mins).toFixed(1)}분 · 바꿔 낀 카드 판당 ${avg(swaps).toFixed(1)} · 웨이브 ${waves.join(',')}`);
