import { ARMS, WEAPONS, ATTACK_CATEGORIES } from '../../src/data/chaos';
import { traitOf } from '../../src/data/combineV4';
import { SAMPLE, SAMPLE_SPELL } from '../../src/data/links';
const by: Record<string, number> = {};
const tr: Record<string, Record<string, number>> = {};
let n = 0;
for (const w of Object.values(ARMS)) {
  if (w.cat === 'passive' || w.fusion) continue;
  n++;
  by[w.cat] = (by[w.cat] ?? 0) + 1;
  const t = traitOf(w.id) ?? '-';
  (tr[w.cat] ??= {})[t] = (tr[w.cat][t] ?? 0) + 1;
}
console.log('attack non-fusion', n, 'WEAPONS', WEAPONS.length, 'ARMS', Object.keys(ARMS).length);
console.log(by);
console.log(JSON.stringify(tr));
console.log(SAMPLE, SAMPLE_SPELL);
console.log(Object.values(ARMS).filter(w=>w.fusion).length, 'fusion weapons');
const kinds: Record<string, number> = {};
for (const w of Object.values(ARMS)) if (w.cat === 'magic') kinds[w.kind] = (kinds[w.kind] ?? 0) + 1;
console.log('magic kinds', kinds);
