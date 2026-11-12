/**
 * 합성 v2 검증: 210가지를 미리보기와 같은 조건(대표 무기 3레벨, 적 14마리 유지, 18초)으로 돌려
 * 규칙이 몇 번 해냈나(fired), 처치 수를 보고, 같은 두 무기를 따로 가진 판과 처치 수를 비교한다.
 *   npx tsx tools/carry/check2.ts              표 전체
 *   npx tsx tools/carry/check2.ts trap>gun     하나만
 */
import { writeFileSync } from 'node:fs';
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { HELPER, inputFor, rulesV2, samplesV2 } from '../../src/data/combineV2';
import { rulesV3 } from '../../src/data/combineV3';
import { NO_META } from '../../src/sim/stats';
import type { Command } from '../../src/sim/types';
import { World } from '../../src/sim/World';
import { InputDriver } from './input';

const FW = BALANCE.field.width;

export interface Run2 {
  fired: number;
  kills: number;
  maxActors: number;
  /** 방어선에 닿은 적 (막아 낸 정도) */
  leaks: number;
  /** 해낸 짝 (무기 id>무기 id) */
  keys: string[];
}

export function run2(weapons: string[], fuse: [string, string][], opt: { seconds?: number; input?: ReturnType<typeof inputFor>; seed?: number; mode?: 2 | 3; ceil?: boolean } = {}): Run2 {
  const w = new World({ seed: opt.seed ?? 12, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true });
  let leaks = 0;
  const skip = () => {
    const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (const id of weapons) for (let i = 0; i < 3; i++) w.augments.acquire(id, w);
  for (const [a, b] of fuse) if (!(opt.mode === 3 ? w.chaos!.fuse3(a, b) : w.chaos!.fuse(a, b))) throw new Error(`못 합침: ${a} > ${b}`);
  if (opt.ceil) w.chaos!.fusion.ceil = true;
  const drv = opt.input ? new InputDriver(opt.input) : null;
  let spawnT = 0;
  let maxActors = 0;
  const steps = Math.round((opt.seconds ?? 18) / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    spawnT -= FIXED_DT;
    if (spawnT <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < 14) {
        spawnT = 1 / 8;
        const roll = w.rng.next();
        const kind = roll < 0.7 ? 'normal' : roll < 0.85 ? 'armored' : 'rusher';
        w.spawnEnemy(kind, w.rng.range(30, FW - 30), w.rng.range(90, BALANCE.field.height * 0.52), 3);
      }
    }
    const cmds: Command[] = drv ? drv.step(w, FIXED_DT) : [];
    skip();
    w.step(FIXED_DT, cmds);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    maxActors = Math.max(maxActors, w.chaos!.actors.length);
    for (const ev of w.drainEvents()) if (ev.type === 'leak') leaks++;
  }
  let fired = 0;
  const keys: string[] = [];
  for (const [k, n] of w.chaos!.fusion.fired) {
    fired += n;
    if (n > 0) keys.push(k);
  }
  return { fired, kills: w.kills, maxActors, leaks, keys };
}


if (process.argv[1]?.endsWith('check2.ts')) {
  const arg = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];
  const mode: 2 | 3 = process.argv.includes('--v3') ? 3 : 2;
  const rows = rulesV2().filter((r) => !arg || r.key === arg);
  const names3 = new Map(rulesV3().map((r) => [r.key, r.name] as const));
  const out: string[] = [];
  let zero = 0;
  const ratios: number[] = [];
  const res: [string, number, number][] = [];
  for (const r of rows) {
    const [A, B] = samplesV2(r.from, r.to);
    const input = inputFor(r.from, r.to);
    const extra = HELPER[r.from] ? [HELPER[r.from]!] : [];
    // 씨앗 둘의 합 (한 판은 흔들림이 커서)
    const f1 = run2([A, B, ...extra], [[A, B]], { input, seed: 12, mode });
    const f2 = run2([A, B, ...extra], [[A, B]], { input, seed: 31, mode });
    const a1 = run2([A, B, ...extra], [], { input, seed: 12 });
    const a2 = run2([A, B, ...extra], [], { input, seed: 31 });
    const fused = { fired: f1.fired + f2.fired, kills: f1.kills + f2.kills, maxActors: Math.max(f1.maxActors, f2.maxActors), leaks: f1.leaks + f2.leaks };
    const apart = { kills: a1.kills + a2.kills, leaks: a1.leaks + a2.leaks };
    if (fused.fired === 0) zero++;
    const ratio = fused.kills / Math.max(1, apart.kills);
    ratios.push(ratio);
    res.push([r.key, ratio, fused.fired]);
    out.push(`${r.key.padEnd(16)} ${(mode === 3 ? names3.get(r.key) ?? r.name : r.name).padEnd(10)} 해냄 ${String(fused.fired).padStart(4)}  처치 ${String(fused.kills).padStart(3)} / 따로 ${String(apart.kills).padStart(3)}  (×${ratio.toFixed(2)})  놓침 ${fused.leaks} / 따로 ${apart.leaks}  물체 ${fused.maxActors}`);
  }
  console.log(out.join('\n'));
  if (process.argv.includes('--write') && !arg) {
    const lines = res.map(([k, r, n]) => `  '${k}': [${r.toFixed(2)}, ${n}],`);
    writeFileSync(mode === 3 ? 'tools/showcase/pages/combine3-results.ts' : 'tools/showcase/pages/combine2-results.ts', `// npx tsx tools/carry/check2.ts --write 로 만든 측정값: [처치 비율 (합침 ÷ 따로, 18초 두 판), 규칙이 해낸 횟수]\nexport const RESULTS: Record<string, [number, number]> = {\n${lines.join('\n')}\n};\n`);
  }
  ratios.sort((a, b) => a - b);
  const med = ratios[Math.floor(ratios.length / 2)] ?? 0;
  console.log(`\n${rows.length}가지 중 한 번도 안 한 것 ${zero}. 처치 비율(합침 ÷ 따로) 가운데값 ×${med.toFixed(2)}, ×1 미만 ${ratios.filter((x) => x < 1).length}개`);
}
