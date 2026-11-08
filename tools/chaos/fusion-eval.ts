// 도파민 모드 융합 등장 횟수: npx tsx tools/chaos/fusion-eval.ts [판 수=10]
import { FIXED_DT } from '../../src/data/balance';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';
const runs = Number(process.argv[2] ?? 10);
let fus = 0, waves = 0, mins = 0;
const names: string[] = [];
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
  const f = w.chaos!.owned().filter((id) => id.startsWith('fus_'));
  fus += f.length; names.push(...f); waves += w.wave; mins += w.time / 60;
}
console.log(`융합 판당 ${(fus / runs).toFixed(1)}개 · 웨이브 ${(waves / runs).toFixed(1)} · ${(mins / runs).toFixed(1)}분 · ${[...new Set(names)].join(' ')}`);
