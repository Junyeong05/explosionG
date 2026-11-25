import { sim } from './harness';
import { run2 } from '../carry/check2';
const A = 'arm_tr_mines', B = 'arm_dog';
const t0 = Date.now();
for (const seed of [12, 31]) {
  const f = sim([A, B], [[A, B]], { seed, level: 3, hp: 7 });
  const f2 = sim([A, B], [[A, B]], { seed, level: 3, hp: 7, mul: 0.5 });
  const s = sim([A, B], [], { seed, level: 3, hp: 7 });
  const r = run2([A, B], [[A, B]], { seed, mode: 4, v5: true, level: 3, fuseRule: 'width', hp: 7 });
  console.log(seed, JSON.stringify(f), f2.kills, s.kills, 'run2', r.kills);
}
console.log(Date.now() - t0);
