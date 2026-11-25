// 회의(11-25) 플레이어·경제: 판 밖 "전체 화력" 배율이 판 결과를 얼마나 옮기나 vs 같은 실력(봇)·같은 강화에서 판마다(뽑힌 무기·합성) 얼마나 흔들리나.
//   npx tsx tools/meeting/player-meta.ts <배율=1> <씨앗 시작=1> <씨앗 끝=12>
// 배율은 MetaModifiers.tapDamageMul (도파민 모드 무기 피해 D 에 곱해짐). 합성 문은 기본(폭=칸·레벨=등급). 읽기만 함 (src 안 고침).
import { FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';

const mul = Number(process.argv[2] ?? 1);
const s0 = Number(process.argv[3] ?? 1);
const s1 = Number(process.argv[4] ?? 12);
for (let s = s0; s <= s1; s++) {
  const cfg = createRunConfig(defaultSave(), 'endless', s);
  cfg.meta = { ...cfg.meta, tapDamageMul: mul };
  const w = new World({ ...cfg, recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) w.step(FIXED_DT, bot.think(w, FIXED_DT));
  const c = (w as any).chaos;
  const owned: string[] = c ? c.owned().filter((id: string) => ARMS[id].cat !== 'passive') : [];
  const cats = new Set(owned.map((id) => ARMS[id].cat)).size;
  const fused = c ? c.parent.size : 0;
  const lv5 = owned.filter((id) => c.lv(id) >= 5).length;
  // 피해 몫 1등 무기 (판을 누가 끌었나)
  const tbl = c ? c.damageTable() : [];
  const tot = tbl.reduce((t: number, r: any) => t + r.dmg, 0) || 1;
  const top = tbl[0] ? `${tbl[0].name}:${Math.round((100 * tbl[0].dmg) / tot)}%` : '-';
  console.log(JSON.stringify({ mul, seed: s, wave: w.wave, min: +(w.time / 60).toFixed(2), weapons: owned.length, cats, fused, lv5, top }));
}
