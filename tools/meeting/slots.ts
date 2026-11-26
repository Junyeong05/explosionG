/**
 * 받침 자리 실험 (11-26 유저: "로디드 다이스는 칸이 한정돼서 꽉 채우고 → 합치고 → 다음으로 넘어가는 근거 있는 판단이 생기는데,
 * 이 게임은 무기 수 제한이 없어서 언제 합칠지 판단할 거리가 뭔지 모르겠다")
 * 보통 엔드리스 봇 판에 자리 상한만 바꿔서: 꽉 차면 새 무기 카드 없음 · 합성 카드 확정 · 합치면 자리 하나 빔 (src/sim/chaos.ts slotCap)
 *   SLOTS=0(없음)|6|8|10 PER_BOSS=0|1 RULE=now|width MEET_OUT=<폴더> npx tsx tools/meeting/slots.ts <shard> <n> [판 수=48]
 */
import { writeFileSync } from 'node:fs';
import { FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import type { FuseRule } from '../../src/data/fuseRules';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';
import { OUT, shardArgs } from './common';

const SLOTS = Number(process.env.SLOTS ?? 0);
const PER_BOSS = Number(process.env.PER_BOSS ?? 0);
const RULE = (process.env.RULE ?? 'now') as FuseRule;
const tag = `slots-${SLOTS}-${PER_BOSS}-${RULE}`;

const { i: shard, mine } = shardArgs();
const runs = Number(process.argv[4] ?? 48);
const seeds = mine(Array.from({ length: runs }, (_, k) => k + 1));
const rows: unknown[] = [];
const t0 = Date.now();
for (const s of seeds) {
  const cfg = createRunConfig(defaultSave(), 'endless', s);
  const w = new World({ ...cfg, fuseRule: RULE, recordEvents: false, rules: { chaos: true }, weaponSlots: SLOTS || undefined, slotsPerBoss: PER_BOSS || undefined });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  const c = w.chaos!;
  let fullSec = 0;
  let firstFull = -1;
  let firstFuse = -1;
  let offers = 0;
  let offersFull = 0;
  let last: unknown = null;
  let acc = 0;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    if (w.offer && w.offer !== last) {
      last = w.offer;
      offers++;
      if (c.slotsFull()) offersFull++;
    }
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
    acc += FIXED_DT;
    if (acc >= 1) {
      acc -= 1;
      if (c.slotsFull()) {
        fullSec++;
        if (firstFull < 0) firstFull = w.time / 60;
      }
      if (firstFuse < 0 && c.parent.size > 0) firstFuse = w.time / 60;
    }
  }
  const bodies = c.bodyCount();
  const weapons = c.owned().filter((id) => ARMS[id].cat !== 'passive').length;
  rows.push({ seed: s, wave: w.wave, min: +(w.time / 60).toFixed(2), fused: c.parent.size, bodies, weapons, cap: Number.isFinite(c.slotCap()) ? c.slotCap() : 0, fullPct: +(fullSec / Math.max(1, w.time)).toFixed(3), firstFull: +firstFull.toFixed(2), firstFuse: +firstFuse.toFixed(2), offers, offersFull });
}
writeFileSync(`${OUT}/${tag}-${shard}.json`, JSON.stringify(rows));
console.log(`${tag} shard ${shard}: ${rows.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
