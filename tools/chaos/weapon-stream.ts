// 무기 하나씩 (레벨 L) 적이 화면 위에서 줄지어 내려오는 판에 30초: 처치·놓침·첫 처치까지 걸린 시간.
// 사거리 배율을 바꿔 가며 비교 (답답한 무기 찾기): npx tsx tools/chaos/weapon-stream.ts [레벨=3] [사거리 배율 목록=1,1.4] [--write]
import { writeFileSync } from 'node:fs';
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { CATEGORY_LABEL, WEAPONS } from '../../src/data/chaos';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';

const L = Number(process.argv[2] ?? 3);
const muls = (process.argv[3] ?? '1,1.4').split(',').map(Number);
const C = BALANCE.chaos as unknown as { rangeMul: number };
const keep = C.rangeMul;

function run(id: string): { kills: number; leaks: number; first: number } {
  const w = new World({ seed: 7, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true });
  const skip = () => {
    const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (let i = 0; i < L; i++) w.augments.acquire(id, w);
  let spawn = 0;
  let leaks = 0;
  let first = 30;
  const hand = WEAPONS.find((s) => s.id === id)!.cat === 'hand';
  for (let i = 0; i < Math.round(30 / FIXED_DT); i++) {
    spawn -= FIXED_DT;
    if (spawn <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < 10) {
        spawn = 0.35;
        w.spawnEnemy(w.rng.next() < 0.8 ? 'normal' : 'armored', w.rng.range(30, BALANCE.field.width - 30), w.rng.range(10, 60), 3);
      }
    }
    const cmds: { t: 'press' | 'release'; x: number; y: number }[] = [];
    if (hand && i % 20 === 0) {
      const e = w.enemies.filter((q) => !q.dead).sort((a, b) => b.y - a.y)[0];
      if (e) cmds.push({ t: 'press', x: e.x, y: e.y }, { t: 'release', x: e.x, y: e.y });
    }
    skip();
    w.step(FIXED_DT, cmds as never);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    for (const ev of w.drainEvents()) if (ev.type === 'leak') leaks++;
    if (w.kills > 0 && first === 30) first = w.time;
  }
  return { kills: w.kills, leaks, first };
}

const rows: { id: string; name: string; cat: string; r: { kills: number; leaks: number; first: number }[] }[] = [];
for (const s of WEAPONS) {
  if (s.cat === 'passive' || s.id === 'arm_bomb' || s.fusion) continue;
  const r = muls.map((m) => {
    C.rangeMul = m;
    return run(s.id);
  });
  rows.push({ id: s.id, name: s.name, cat: s.cat, r });
}
C.rangeMul = keep;
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const cats = [...new Set(rows.map((r) => r.cat))];
console.log(`무기 ${rows.length}개, 레벨 ${L}, 30초, 사거리 배율 ${muls.join(' / ')}`);
for (const c of cats) {
  const rs = rows.filter((r) => r.cat === c);
  console.log(`${CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL].padEnd(5)} 처치 ${muls.map((_, i) => med(rs.map((r) => r.r[i].kills))).join(' → ')}  놓침 ${muls.map((_, i) => med(rs.map((r) => r.r[i].leaks))).join(' → ')}  첫 처치 ${muls.map((_, i) => med(rs.map((r) => r.r[i].first)).toFixed(1)).join(' → ')}초`);
}
const last = muls.length - 1;
const all = rows.map((r) => r.r[last].kills);
const m = med(all);
console.log(`\n전체 처치 가운데값 ${m} (배율 ${muls[last]})`);
const low = [...rows].sort((a, b) => a.r[last].kills - b.r[last].kills).slice(0, 15);
const high = [...rows].sort((a, b) => b.r[last].kills - a.r[last].kills).slice(0, 12);
console.log('가장 약한 15:', low.map((r) => `${r.name}(${CATEGORY_LABEL[r.cat as keyof typeof CATEGORY_LABEL]}) ${r.r[last].kills}/놓침 ${r.r[last].leaks}`).join(', '));
console.log('가장 센 12:', high.map((r) => `${r.name}(${CATEGORY_LABEL[r.cat as keyof typeof CATEGORY_LABEL]}) ${r.r[last].kills}`).join(', '));
if (process.argv.includes('--write')) writeFileSync('tools/chaos/weapon-stream.json', JSON.stringify(rows, null, 1));
