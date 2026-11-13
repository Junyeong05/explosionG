// 합성(v4 극적 반응)을 봇 엔드리스 판에 넣었을 때 판 길이와 웨이브 체력 상승치:
//   npx tsx tools/chaos/fusion-sweep.ts [판 수=6] [체력 상승치 목록=0.4,0.7,1.0] ['{"enemyHpLatePerWave":0.5}' …]
//   세 번째부터는 BALANCE.chaos 덮어쓰기 (enemyHpPerWave 는 0.4 그대로, 후반·합성 상승치만)
// 봇은 20초마다, 3레벨 넘은 무기 중 아직 안 합친 다른 갈래 둘(레벨 높은 순)을 합친다 (높은 쪽이 몸).
// 맨 앞 줄은 합성 없는 지금 판 (enemyHpPerWave 0.4).
import { FIXED_DT, BALANCE } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const runs = Number(process.argv[2] ?? 6);
const list = (process.argv[3] ?? '0.4,0.7,1.0').split(',').map(Number);
const base = BALANCE.chaos.enemyHpPerWave;

function autoFuse(w: World): void {
  const c = w.chaos!;
  const free = c
    .owned()
    .filter((id) => ARMS[id].cat !== 'passive' && !c.parent.has(id) && !c.fusion.has(id) && c.lv(id) >= 3)
    .sort((a, b) => c.lv(b) - c.lv(a));
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (ARMS[free[i]].cat === ARMS[free[j]].cat) continue;
      if (c.fuse4(free[i], free[j])) {
        c.fusion.drama = true;
        return;
      }
    }
  }
}

function sweep(hp: number, fuse: boolean): string {
  (BALANCE as unknown as { chaos: { enemyHpPerWave: number } }).chaos.enemyHpPerWave = hp;
  const waves: number[] = [];
  const mins: number[] = [];
  let fused = 0;
  for (let s = 1; s <= runs; s++) {
    const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
    const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
    let next = 20;
    for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
      w.step(FIXED_DT, bot.think(w, FIXED_DT));
      if (fuse && w.time >= next) {
        next += 20;
        autoFuse(w);
      }
    }
    fused += w.chaos!.fusion.active ? [...w.chaos!.parent.keys()].length : 0;
    waves.push(w.wave);
    mins.push(w.time / 60);
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return `${fuse ? '합성' : '합성 없음'} 체력 +${hp}/웨이브: 웨이브 평균 ${avg(waves).toFixed(1)} (${Math.min(...waves)}~${Math.max(...waves)}) · ${avg(mins).toFixed(1)}분${fuse ? ` · 판마다 합친 무기 ${(fused / runs).toFixed(1)}` : ''}`;
}

console.log(sweep(base, false));
const overs = process.argv.slice(4).map((x) => JSON.parse(x) as Record<string, number>);
if (!overs.length) for (const hp of list) console.log(sweep(hp, true));
for (const o of overs) {
  const C = (BALANCE as unknown as { chaos: Record<string, number> }).chaos;
  const keep = { ...C };
  Object.assign(C, o);
  console.log(JSON.stringify(o), sweep(base, true));
  Object.assign(C, keep);
}
