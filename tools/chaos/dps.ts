// 도파민 모드 무기 피해 측정: 무기 하나만 레벨 L 로 두고 적 60마리(체력 무한)에 준 초당 피해 (D 기준).
// 실행: npx tsx tools/chaos/dps.ts [레벨=1] [무기id,무기id…]
// 무기 하나씩, 레벨 L 로 30초 동안 적 60마리(체력 무한)에 준 피해. D(기본 피해) 기준 초당 피해로 비교
import { FIXED_DT } from '../../src/data/balance';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';
import { WEAPONS } from '../../src/data/chaos';
const L = Number(process.argv[2] ?? 1);
const only = process.argv[3]?.split(',');
const rows: { name: string; cat: string; dps: number }[] = [];
for (const spec of WEAPONS) {
  if (spec.cat === 'passive' || spec.id === 'arm_bomb') continue;
  if (only && !only.includes(spec.id)) continue;
  const w = new World({ seed: 3, mode: 'chapter', chapterId: 'ch1', meta: { ...NO_META }, sandbox: true, rules: { chaos: true } });
  (w as any).offerQueue.length = 0;
  for (let i = 0; i < 60; i++) {
    const e = w.spawnEnemy('normal', 30 + (i % 10) * 33, 200 + Math.floor(i / 10) * 55)!;
    e.speed = 0; e.hp = e.maxHp = 1e6;
  }
  for (let i = 0; i < L; i++) w.augments.acquire(spec.id, w);
  const D = w.stats.tapDamage;
  let t = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const cmds: any[] = [];
    if (spec.cat === 'hand' && i % 24 === 0) {
      const vis = w.enemies.filter((e) => !e.dead);
      const e = vis[(i / 24) % vis.length | 0];
      if (e) cmds.push({ t: 'press', x: e.x, y: e.y }, { t: 'release', x: e.x, y: e.y });
    }
    w.step(FIXED_DT, cmds);
    w.drainEvents();
    t += FIXED_DT;
  }
  let dmg = 0;
  for (const e of w.enemies) dmg += e.maxHp - e.hp;
  rows.push({ name: `${spec.emoji} ${spec.name}`, cat: spec.cat, dps: dmg / t / D });
}
rows.sort((a, b) => b.dps - a.dps);
for (const r of rows) console.log(`${r.cat.padEnd(7)} ${r.name.padEnd(14)} ${r.dps.toFixed(1)}`);
