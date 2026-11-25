// 회의(11-25) 플레이어: 일찍 끝나는 판 (나쁜 운이 판을 끝내나). 시작 무기·처음 고른 것·끝날 때 무기와 웨이브.
//   npx tsx tools/meeting/player-early.ts <씨앗 시작=1> <씨앗 끝=40> [배율=1]
// 봇은 보통 봇 (tools/meeting/player-meta.ts 와 같은 설정). 읽기만 함.
import { FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const s0 = Number(process.argv[2] ?? 1);
const s1 = Number(process.argv[3] ?? 40);
const mul = Number(process.argv[4] ?? 1);
for (let s = s0; s <= s1; s++) {
  const cfg = createRunConfig(defaultSave(), 'endless', s);
  cfg.meta = { ...cfg.meta, tapDamageMul: mul };
  const w = new World({ ...cfg, recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  const picks: string[] = [];
  let at2 = '';
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    const cmds = bot.think(w, FIXED_DT);
    for (const c of cmds) if (c.t === 'choose' && w.offer) picks.push(w.offer.choices[(c as any).index]);
    w.step(FIXED_DT, cmds);
    if (!at2 && w.time >= 120) {
      const c = (w as any).chaos;
      at2 = c.owned().filter((id: string) => ARMS[id].cat !== 'passive').map((id: string) => `${ARMS[id].name}${c.lv(id)}`).join(',');
    }
  }
  const c = (w as any).chaos;
  const owned: string[] = c.owned().filter((id: string) => ARMS[id].cat !== 'passive');
  const nm = (id: string) => (ARMS[id] ? `${ARMS[id].name}(${ARMS[id].cat})` : id);
  console.log(JSON.stringify({ seed: s, wave: w.wave, min: +(w.time / 60).toFixed(2), starter: nm(picks[0] ?? ''), first5: picks.slice(1, 6).map(nm), weapons: owned.length, at2min: at2 }));
}
