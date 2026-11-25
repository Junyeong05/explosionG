import { run2 } from '../carry/check2';
const t0 = Date.now();
const A = 'arm_tr_mines', B = 'arm_dog';
for (const seed of [12, 31]) {
  const f = run2([A, B], [[A, B]], { seed, mode: 4, v5: true, level: 3, fuseRule: 'width', hp: 7 });
  const s = run2([A, B], [], { seed, level: 3, hp: 7 });
  console.log(seed, f.kills, s.kills);
}
console.log('4 runs ms', Date.now() - t0);
const t1 = Date.now();
const r = run2([A], [], { seed: 12, level: 3, hp: 7 });
console.log('solo', r.kills, Date.now() - t1);
