/**
 * 합성 210 검증: 미리보기 카드와 같은 조건(대표 무기 3레벨, 적 14마리 유지, 18초)으로 210가지를 다 돌려
 * 실린 것이 몇 번 열렸나·물체 수·처치 수를 본다. 안 열리는 짝, 너무 많이 열리는 짝을 찾는 데 쓴다.
 *   npx tsx tools/carry/check.ts            표 전체
 *   npx tsx tools/carry/check.ts gun>summon  하나만
 *   npx tsx tools/carry/check.ts --deep      깊이 2 예시만
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { linkRules } from '../../src/data/links';
import { NO_META } from '../../src/sim/stats';
import type { Command } from '../../src/sim/types';
import { World } from '../../src/sim/World';

const FW = BALANCE.field.width;

export interface RunResult {
  opens: number;
  deep: number;
  kills: number;
  maxActors: number;
}

export function runCombo(
  weapons: string[],
  attach: [string, string][],
  opt: { seconds?: number; taps?: boolean; seed?: number; onEnd?: (opened: ReadonlyMap<string, number>) => void } = {},
): RunResult {
  const w = new World({ seed: opt.seed ?? 12, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true } });
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
  for (const [a, b] of attach) if (!w.chaos!.attach(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
  let spawnT = 0;
  let tapT = 1;
  let maxActors = 0;
  const steps = Math.round((opt.seconds ?? 18) / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    const cmds: Command[] = [];
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
    if (opt.taps) {
      tapT -= FIXED_DT;
      if (tapT <= 0) {
        tapT = 0.45;
        let best: { x: number; y: number } | null = null;
        for (const e of w.enemies) if (!e.dead && e.y > 60 && (!best || e.y > best.y)) best = e;
        if (best) cmds.push({ t: 'press', x: best.x, y: best.y }, { t: 'release', x: best.x, y: best.y });
      }
    }
    skip();
    w.step(FIXED_DT, cmds);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    maxActors = Math.max(maxActors, w.chaos!.actors.length);
  }
  opt.onEnd?.(w.chaos!.opened);
  let opens = 0;
  let deep = 0;
  const top = new Set(attach.filter(([a]) => !attach.some(([, b]) => b === a)).map(([a]) => a));
  for (const [k, n] of w.chaos!.opened) {
    opens += n;
    if (!top.has(k.split('>')[0])) deep += n;
  }
  return { opens, deep, kills: w.kills, maxActors };
}

const isMain = process.argv[1]?.endsWith('check.ts');
if (isMain) {
  const arg = process.argv[2];
  if (arg === '--deep') {
    const g = 'arm_g_carbine';
    const s = 'arm_dog';
    const t = 'arm_tr_mines';
    console.log('총+소환수', runCombo([g, s], [[g, s]]));
    console.log('함정+(총+소환수)', runCombo([t, g, s], [[g, s], [t, g]]));
    console.log('(총+소환수)+함정', runCombo([g, s, t], [[g, s], [g, t]]));
  } else {
    const rows = linkRules().filter((r) => !arg || r.key === arg);
    const out: string[] = [];
    let zero = 0;
    for (const r of rows) {
      const taps = r.from === 'hand' || r.to === 'hand';
      const res = runCombo([r.carrier, r.payload], [[r.carrier, r.payload]], { taps });
      if (res.opens === 0) zero++;
      out.push(`${r.key.padEnd(16)} 열림 ${String(res.opens).padStart(3)}  처치 ${String(res.kills).padStart(3)}  물체 최대 ${res.maxActors}`);
    }
    console.log(out.join('\n'));
    console.log(`\n${rows.length}가지 중 안 열린 것 ${zero}`);
  }
}
