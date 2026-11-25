/**
 * 레드팀 측정 (11-25 회의): 적 체력이 오르면 짝 순위가 바뀌나 (체력과 무관한 처형·매혹 · 성질 고정 피해).
 *   npx tsx tools/meeting/red-hp.ts
 */
import { inputFor, samplesV2 } from '../../src/data/combineV2';
import { run2 } from '../carry/check2';
const pairs = ['trap>summon', 'magic>summon', 'trap>turret', 'gun>throw', 'ray>gun', 'gun>swarm', 'summon>spinner', 'sound>swarm', 'gun>hand'];
for (const hp of [7, 28]) {
  const out: string[] = [];
  for (const k of pairs) {
    const [a, b] = k.split('>') as [never, never];
    const [A, B] = samplesV2(a, b);
    let f = 0, s = 0;
    for (const seed of [12, 31]) {
      f += run2([A, B], [[A, B]], { input: inputFor(a, b), seed, mode: 4, v5: true, level: 3, fuseRule: 'width', hp }).kills;
      s += run2([A, B], [], { input: inputFor(a, b), seed, level: 3, hp }).kills;
    }
    out.push(`${k} ${f}/${s} ×${(f / Math.max(1, s)).toFixed(2)}`);
  }
  console.log(`체력 ${hp}: ${out.join(' · ')}`);
}
