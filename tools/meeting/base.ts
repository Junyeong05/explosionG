/**
 * 기본 편차: 공격 무기 327 하나씩, 레벨 1·3·5, 적 체력 ×7 고정 (레벨끼리 견주게), 18초 두 판 (씨앗 12·31).
 * + 레벨 3 정지 표적 60마리(체력 무한) 20초 초당 피해 (tools/chaos/dps.ts 방식, D 기준) — 교차 확인.
 *   MEET_OUT=<폴더> npx tsx tools/meeting/base.ts <shard> <n>
 */
import { writeFileSync } from 'node:fs';
import { FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { ALL, OUT, shardArgs } from './common';
import { simSeeds } from './harness';

function staticDps(id: string, L: number, sec = 20): number {
  const spec = ARMS[id];
  const w = new World({ seed: 3, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META }, sandbox: true, rules: { chaos: true } });
  (w as any).offerQueue.length = 0;
  for (let i = 0; i < 60; i++) {
    const e = w.spawnEnemy('normal', 30 + (i % 10) * 33, 200 + Math.floor(i / 10) * 55)!;
    e.speed = 0;
    e.hp = e.maxHp = 1e6;
  }
  for (let i = 0; i < L; i++) w.augments.acquire(id, w);
  const D = w.stats.tapDamage;
  const steps = Math.round(sec / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    const cmds: any[] = [];
    if (spec.cat === 'hand' && i % 24 === 0) {
      const vis = w.enemies.filter((e) => !e.dead);
      const e = vis[(i / 24) % vis.length | 0];
      if (e) cmds.push({ t: 'press', x: e.x, y: e.y }, { t: 'release', x: e.x, y: e.y });
    }
    const a = w as any;
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') { a.offer = null; a.phase = 'playing'; }
    w.step(FIXED_DT, cmds);
    w.drainEvents();
  }
  let dmg = 0;
  for (const e of w.enemies) dmg += e.maxHp - e.hp;
  return dmg / sec / D;
}

const { i, mine } = shardArgs();
const rows: any[] = [];
const t0 = Date.now();
for (const id of mine(ALL)) {
  const cat = ARMS[id].cat;
  const input = cat === 'hand' ? 'tap' : null;
  const row: any = { id, cat, name: ARMS[id].name, cd: ARMS[id].cd };
  for (const L of [1, 3, 5]) {
    const r = simSeeds([id], [], { level: L, hp: 7, input }, [12, 31]);
    row[`k${L}`] = r.kills;
    row[`d${L}`] = r.dmg;
  }
  row.sdps3 = +staticDps(id, 3).toFixed(2);
  rows.push(row);
}
writeFileSync(`${OUT}/base-${i}.json`, JSON.stringify(rows));
console.log(`base shard ${i}: ${rows.length} 무기 · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
