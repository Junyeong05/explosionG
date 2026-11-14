/**
 * 끌어모으기 · 적 충돌 점검 (11-14 플레이 피드백): 끌어모으는 무기 하나를 3레벨로 들고 적 24마리를 한가운데 넓게 깔아 8초.
 *   npx tsx tools/chaos/pull-check.ts
 * 겹침 = 중심이 6px 안에 붙은 다른 적 수 (가장 많이 겹친 순간), 뭉침 = 가장 붐빈 순간 반경 30 안 적 수, 처치·피해.
 * "전" 은 끌림 ×1 · 범위 ×1 · 충돌 없음, "후" 는 지금 BALANCE.
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { NO_META } from '../../src/sim/stats';
import type { Command } from '../../src/sim/types';
import { World } from '../../src/sim/World';

const C = BALANCE.chaos as unknown as Record<string, number>;
const NOW = { pullMul: C.pullMul, pullRadiusMul: C.pullRadiusMul, sepCore: C.sepCore, ...JSON.parse(process.argv[2] ?? '{}') };
const OLD = { pullMul: 1, pullRadiusMul: 1, sepCore: 0 };
const WEAPONS = ['arm_h_gravity', 'arm_hole', 'arm_blackhole', 'arm_m_wormhole', 'arm_magnet', 'arm_t_blacktower', 'arm_f_whirlpool', 'arm_f_gravity', 'arm_orbgun'];

function run(id: string, seed: number): { stack: number; crowd: number; kills: number; dmg: number } {
  const w = new World({ seed, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: false });
  const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string; gauge: number };
  const skip = () => {
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (let i = 0; i < 3; i++) w.augments.acquire(id, w);
  skip();
  const FW = BALANCE.field.width;
  for (let i = 0; i < 24; i++) w.spawnEnemy('normal', FW / 2 + w.rng.range(-110, 110), 300 + w.rng.range(-90, 90), 8);
  let stack = 0;
  let crowd = 0;
  const hand = ARMS[id].cat === 'hand';
  for (let s = 0; s < 8 / FIXED_DT; s++) {
    const cmds: Command[] = [];
    // 손: 1초마다 가운데를 탭 (누르고 바로 뗌)
    if (hand && s % 60 === 0) {
      a.gauge = 1;
      cmds.push({ t: 'press', x: FW / 2, y: 300 });
    } else if (hand && s % 60 === 2) cmds.push({ t: 'release', x: FW / 2, y: 300 });
    skip();
    w.step(FIXED_DT, cmds);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    const alive = w.enemies.filter((e) => !e.dead);
    for (const e of alive) {
      let n = 0;
      let m = 0;
      for (const o of alive) {
        if (o === e) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < 6) n++;
        if (d < 30) m++;
      }
      stack = Math.max(stack, n);
      crowd = Math.max(crowd, m + 1);
    }
  }
  const dmg = w.enemies.reduce((t, e) => t + (e.maxHp - Math.max(0, e.hp)), 0);
  return { stack, crowd, kills: w.kills, dmg };
}

const rows: string[] = [];
let k0 = 0;
let k1 = 0;
for (const id of WEAPONS) {
  if (!ARMS[id]) continue;
  const r: Record<string, { stack: number; crowd: number; kills: number; dmg: number }> = {};
  for (const [name, set] of [['전', OLD], ['후', NOW]] as const) {
    Object.assign(C, set);
    let stack = 0, crowd = 0, kills = 0, dmg = 0;
    for (const seed of [3, 11]) {
      const x = run(id, seed);
      stack = Math.max(stack, x.stack);
      crowd = Math.max(crowd, x.crowd);
      kills += x.kills;
      dmg += x.dmg;
    }
    r[name] = { stack, crowd, kills, dmg };
  }
  k0 += r['전'].dmg;
  k1 += r['후'].dmg;
  rows.push(`${ARMS[id].name.padEnd(8)} 한 점 겹침 ${r['전'].stack} → ${r['후'].stack} · 반경 30 안 ${r['전'].crowd} → ${r['후'].crowd} · 처치 ${r['전'].kills} → ${r['후'].kills} · 피해 ${Math.round(r['전'].dmg)} → ${Math.round(r['후'].dmg)}`);
}
Object.assign(C, NOW);
console.log(rows.join('\n'));
console.log(`${JSON.stringify(NOW)} 피해 합 ${Math.round(k0)} → ${Math.round(k1)} (${Math.round((k1 / Math.max(1, k0)) * 100)}%)`);
