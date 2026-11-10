/**
 * 합성 v2 성능: 무기 12개 + 합성 다섯(겹친 둘) 판을 길게 돌려 스텝 시간·물체 수·합성 내부 기억 크기를 본다.
 *   npx tsx tools/carry/perf-v2.ts [초]
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { NO_META } from '../../src/sim/stats';
import { World } from '../../src/sim/World';

const W12 = ['arm_g_carbine', 'arm_dog', 'arm_tr_mines', 'arm_a_bomber', 'arm_f_lava', 'arm_s_guitar', 'arm_sw_mosquito', 'arm_sp_disc', 'arm_laser', 'arm_th_volley', 'arm_cannon', 'arm_sl_fairy'];
const FUSE: [string, string][] = [['arm_g_carbine', 'arm_dog'], ['arm_tr_mines', 'arm_g_carbine'], ['arm_a_bomber', 'arm_f_lava'], ['arm_s_guitar', 'arm_sw_mosquito'], ['arm_laser', 'arm_sl_fairy'], ['arm_th_volley', 'arm_sp_disc'], ['arm_cannon', 'arm_th_volley']];

export function perf(seconds: number, fuse: boolean): { msPerStep: number; worstMs: number; maxActors: number; memo: number; kills: number } {
  const w = new World({ seed: 7, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true } });
  const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
  const skip = () => {
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (const id of W12) for (let i = 0; i < 3; i++) w.augments.acquire(id, w);
  if (fuse) for (const [x, y] of FUSE) w.chaos!.fuse(x, y);
  let spawnT = 0;
  let total = 0;
  let worst = 0;
  let maxActors = 0;
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    spawnT -= FIXED_DT;
    if (spawnT <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < 32) {
        spawnT = 1 / 10;
        w.spawnEnemy(w.rng.next() < 0.8 ? 'normal' : 'armored', w.rng.range(30, BALANCE.field.width - 30), w.rng.range(90, BALANCE.field.height * 0.52), 7);
      }
    }
    skip();
    const t0 = performance.now();
    w.step(FIXED_DT, []);
    const dt = performance.now() - t0;
    total += dt;
    if (i > 60) worst = Math.max(worst, dt);
    (w as unknown as { life: number }).life = w.stats.maxLife;
    maxActors = Math.max(maxActors, w.chaos!.actors.length);
  }
  const f = w.chaos!.fusion as unknown as { st: Map<unknown, unknown>; thr: Map<unknown, unknown>; cnt: Map<unknown, unknown> };
  return { msPerStep: total / steps, worstMs: worst, maxActors, memo: f.st.size + f.thr.size + f.cnt.size, kills: w.kills };
}

if (process.argv[1]?.endsWith('perf-v2.ts')) {
  const sec = Number(process.argv[2] ?? 120);
  for (const fuse of [false, true]) {
    const r = perf(sec, fuse);
    console.log(`${fuse ? '합성 다섯' : '합성 없음'} ${sec}초: 스텝 평균 ${r.msPerStep.toFixed(3)}ms, 최악 ${r.worstMs.toFixed(2)}ms, 물체 최대 ${r.maxActors}, 합성 기억 ${r.memo}, 처치 ${r.kills}`);
  }
}
