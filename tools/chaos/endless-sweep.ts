// 도파민 모드 엔드리스 봇 판 길이: npx tsx tools/chaos/endless-sweep.ts [판 수=8] '{"enemyHpPerWave":0.4}' (BALANCE.chaos 덮어쓰기)
import { FIXED_DT, BALANCE } from '../../src/data/balance';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';
const runs = Number(process.argv[2] ?? 8);
const over = JSON.parse(process.argv[3] ?? '{}');
Object.assign((BALANCE as any).chaos, over);
const waves: number[] = [], mins: number[] = [];
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
  waves.push(w.wave); mins.push(w.time / 60);
}
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`${JSON.stringify(over)} 웨이브 평균 ${avg(waves).toFixed(1)} (${Math.min(...waves)}~${Math.max(...waves)}) · ${avg(mins).toFixed(1)}분 (${Math.min(...mins).toFixed(1)}~${Math.max(...mins).toFixed(1)})`);
