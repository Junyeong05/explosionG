// 도파민 모드 판 흐름 (봇 엔드리스): 분마다 가진 공격 무기 수 · 최고 레벨(5) 무기 수, 다른 갈래 무기 둘이 처음 최고 레벨이 되는 때,
// 레벨 업 고른 것의 몫 (무기 레벨 업 · 새 무기 · 보조 · 합성).  npx tsx tools/chaos/pace.ts [판 수=8]
// 합성 사다리 구상(docs/design/fusion-ladder.md)의 근거
import { FIXED_DT } from '../../src/data/balance';
import { ARMS, MAX_LEVEL } from '../../src/data/chaos';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const runs = Number(process.argv[2] ?? 8);
const at = [3, 6, 9, 12];
const owned: number[][] = at.map(() => []);
const maxed: number[][] = at.map(() => []);
const pair5: number[] = [];
const first5: number[] = [];
const picks = { up: 0, fresh: 0, passive: 0, fuse: 0, other: 0 };
let levelUps = 0;
let minutes = 0;
for (let s = 1; s <= runs; s++) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  const c = w.chaos!;
  let p5 = -1;
  let f5 = -1;
  let k = 0;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    const offer = w.phase === 'choosing' ? w.offer : null;
    const before = offer ? new Map(c.owned().map((id) => [id, c.lv(id)] as const)) : null;
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
    if (offer && w.phase !== 'choosing' && before) {
      if (offer.kind !== 'start') levelUps++;
      const now = c.owned();
      const added = now.filter((id) => !before.has(id));
      const upped = now.filter((id) => before.has(id) && c.lv(id) > (before.get(id) ?? 0));
      if (c.parent.size > 0 && offer.choices.some((x) => x.startsWith('fuse:')) && added.length === 0 && upped.length === 0) picks.fuse++;
      else if (added.some((id) => ARMS[id]?.cat === 'passive') || upped.some((id) => ARMS[id]?.cat === 'passive')) picks.passive++;
      else if (added.length) picks.fresh++;
      else if (upped.length) picks.up++;
      else picks.other++;
    }
    const attack = c.owned().filter((id) => ARMS[id]?.cat !== 'passive');
    const max = attack.filter((id) => c.lv(id) >= MAX_LEVEL);
    if (f5 < 0 && max.length) f5 = w.time;
    if (p5 < 0 && new Set(max.map((id) => ARMS[id].cat)).size >= 2) p5 = w.time;
    while (k < at.length && w.time >= at[k] * 60) {
      owned[k].push(attack.length);
      maxed[k].push(max.length);
      k++;
    }
  }
  minutes += w.time / 60;
  if (p5 >= 0) pair5.push(p5 / 60);
  if (f5 >= 0) first5.push(f5 / 60);
}
const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-');
const med = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)].toFixed(1) : '-');
console.log(`판 ${runs} · 평균 ${(minutes / runs).toFixed(1)}분 · 레벨 업 분당 ${(levelUps / minutes).toFixed(1)}번`);
at.forEach((m, i) => console.log(`${m}분: 살아 있는 판 ${owned[i].length} · 공격 무기 평균 ${avg(owned[i])} · 최고 레벨 무기 평균 ${avg(maxed[i])}`));
console.log(`첫 최고 레벨 무기 가운데값 ${med(first5)}분 (${first5.length}판) · 다른 갈래 최고 레벨 둘 가운데값 ${med(pair5)}분 (${pair5.length}판)`);
const n = Object.values(picks).reduce((x, y) => x + y, 0) || 1;
console.log(`고른 것: 무기 레벨 업 ${Math.round((picks.up / n) * 100)}% · 새 무기 ${Math.round((picks.fresh / n) * 100)}% · 보조 ${Math.round((picks.passive / n) * 100)}% · 합성 ${Math.round((picks.fuse / n) * 100)}% · 기타 ${Math.round((picks.other / n) * 100)}%`);
