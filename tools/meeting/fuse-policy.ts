/**
 * 합성을 하나 안 하나 (11-25 유저: "무기 상한이 없어 많이 가질수록 딜인데, 합성을 굳이 하려 할까?")
 * 보통 엔드리스 봇 판을 고르는 법만 바꿔서:
 *   never  합성 카드가 떠도 다른 카드(새 무기·강화)를 고름
 *   bot    지금 봇 (합성 카드 점수 2.5~3: 보통·희귀 카드보다 먼저)
 *   always 합성 카드가 뜨면 늘 합성
 * 규칙은 세이브 기본(폭=칸). 카드 난수와 전투 난수가 하나라 판끼리 흔들림이 크다 → 같은 씨앗 짝으로 비교하고 판을 많이.
 *   POLICY=never|bot|always MEET_OUT=<폴더> npx tsx tools/meeting/fuse-policy.ts <shard> <n> [판 수=48]
 */
import { writeFileSync } from 'node:fs';
import { FIXED_DT } from '../../src/data/balance';
import { defaultSave } from '../../src/meta/save';
import { createRunConfig } from '../../src/meta/progression';
import { Bot } from '../../src/sim/bot';
import { World } from '../../src/sim/World';
import { OUT, shardArgs } from './common';

const POLICY = process.env.POLICY ?? 'bot';
const proto = Bot.prototype as unknown as { pickIndex: (choices: readonly string[]) => number };
const orig = proto.pickIndex;
proto.pickIndex = function (this: unknown, choices: readonly string[]) {
  const fi = choices.findIndex((c) => c.startsWith('fuse:'));
  if (fi >= 0 && POLICY === 'always') return fi;
  if (fi >= 0 && POLICY === 'never') {
    const rest = choices.map((c, i) => [c, i] as const).filter(([c]) => !c.startsWith('fuse:'));
    if (!rest.length) return fi;
    const k = orig.call(this, rest.map(([c]) => c));
    return rest[k][1];
  }
  return orig.call(this, choices);
};

const { i: shard, mine } = shardArgs();
const runs = Number(process.argv[4] ?? 48);
const seeds = mine(Array.from({ length: runs }, (_, k) => k + 1));
const rows: unknown[] = [];
const t0 = Date.now();
for (const s of seeds) {
  const w = new World({ ...createRunConfig(defaultSave(), 'endless', s), recordEvents: false, rules: { chaos: true } });
  const bot = new Bot({ seed: s, pressDelay: [0.12, 0.28] });
  let offersWithFuse = 0;
  let last: unknown = null;
  for (let i = 0; i < 60 * 60 * 40 && w.phase !== 'ended'; i++) {
    if (w.offer && w.offer !== last) {
      last = w.offer;
      if (w.offer.choices.some((c) => c.startsWith('fuse:'))) offersWithFuse++;
    }
    w.step(FIXED_DT, bot.think(w, FIXED_DT));
  }
  const c = w.chaos!;
  const owned = (w.augments as unknown as { owned: Map<string, unknown> }).owned.size;
  rows.push({ seed: s, wave: w.wave, min: +(w.time / 60).toFixed(2), fused: c.parent.size, offersWithFuse, owned });
}
writeFileSync(`${OUT}/policy-${POLICY}-${shard}.json`, JSON.stringify(rows));
console.log(`${POLICY} shard ${shard}: ${rows.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
