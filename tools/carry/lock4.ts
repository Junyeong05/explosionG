/**
 * 잠금 검사 (v4 극적 반응): 조합으로 적이 아예 방어선 쪽으로 못 다가오게 되나.
 *   npx tsx tools/carry/lock4.ts [--write]
 * 적을 아주 단단하게 (체력 ×40, 14마리 유지, 30초) 해서 잘 안 죽게 하고, 적이 다가오는 빠르기(px/s)와
 * 묶임·얼림·매혹·밀려남으로 보낸 시간 몫을 잰다. 같은 무기를 따로 가진 판과 비교해
 * 다가오는 빠르기가 따로의 35% 아래이거나 제어 몫이 60% 넘으면 "잠금".
 * 제어 저항(BALANCE.chaos.ccMax) 을 끈 판 · 켠 판을 같이 잰다.
 */
import { writeFileSync } from 'node:fs';
import { BALANCE } from '../../src/data/balance';
import { ARMS, ATTACK_CATEGORIES, CATEGORY_LABEL } from '../../src/data/chaos';
import { inputFor, samplesV2 } from '../../src/data/combineV2';
import type { AttackCat } from '../../src/data/links';
import { Rng } from '../../src/core/rng';
import { FUN } from '../showcase/pages/fun-results';
import { run2 } from './check2';

const CATS = ATTACK_CATEGORIES as readonly AttackCat[];
const L = (c: AttackCat) => CATEGORY_LABEL[c];
const C = BALANCE.chaos as unknown as { ccMax: number };
const ccOn = C.ccMax;

interface Case { title: string; weapons: string[]; fuse: [string, string][]; input?: ReturnType<typeof inputFor>; level?: number }
const cases: Case[] = [];
for (const a of CATS) for (const b of CATS) {
  if (a === b) continue;
  const [A, B] = samplesV2(a, b);
  cases.push({ title: `${L(a)}+${L(b)}`, weapons: [A, B], fuse: [[A, B]], input: inputFor(a, b) });
}
for (const f of FUN) cases.push({ title: `재밌는 ${f.title}`, weapons: f.weapons.filter((w) => f.fuse.some(([p, c]) => p === w || c === w)), fuse: f.fuse, input: (f.input as ReturnType<typeof inputFor>) ?? null });
// 제어를 잔뜩 쌓은 무작위 (묶고·얼리고·밀고·매혹하는 갈래 위주)
const CTRL: AttackCat[] = ['trap', 'summon', 'magic', 'sound', 'spinner', 'field', 'swarm', 'charge'];
const rng = new Rng(77);
for (let n = 0; n < 60; n++) {
  const cats = [...CTRL].sort(() => rng.next() - 0.5).slice(0, 4 + rng.int(2));
  const ws = cats.map((c) => samplesV2(c, c === 'magic' ? 'trap' : 'magic')[0]);
  const fuse: [string, string][] = [];
  for (let i = ws.length - 1; i >= 1; i--) fuse.push([ws[i % 2 === 1 ? 0 : i - 1], ws[i]]);
  // 셋에 하나는 무기 레벨 6 (제어가 길어진다)
  cases.push({ title: `제어 ${cats.map((c) => L(c)).join('·')}${n % 3 === 0 ? ' (레벨 6)' : ''}`, weapons: ws, fuse, level: n % 3 === 0 ? 6 : 3 });
}

interface Row { title: string; sepAdv: number; offAdv: number; onAdv: number; offCtl: number; onCtl: number; offLock: boolean; onLock: boolean; onLeaks: number; sepLeaks: number }
const rows: Row[] = [];
// 잠금 = 다가오는 빠르기가 따로 가진 판의 35% 아래 (제어 몫은 참고로만: 저항이 걸려도 밀려난 시간은 세진다)
const lock = (adv: number, sep: number, _ctl: number) => adv < Math.max(0.35 * sep, 0.5);
for (const k of cases) {
  const opt = { seconds: 30, hp: 40, input: k.input ?? undefined, seed: 12, level: k.level ?? 3 };
  const sep = run2(k.weapons, [], opt);
  C.ccMax = 1e9;
  const off = run2(k.weapons, k.fuse, { ...opt, mode: 4, drama: true });
  C.ccMax = ccOn;
  const on = run2(k.weapons, k.fuse, { ...opt, mode: 4, drama: true });
  rows.push({ title: k.title, sepAdv: sep.advance, offAdv: off.advance, onAdv: on.advance, offCtl: off.ctlShare, onCtl: on.ctlShare, offLock: lock(off.advance, sep.advance, off.ctlShare), onLock: lock(on.advance, sep.advance, on.ctlShare), onLeaks: on.leaks, sepLeaks: sep.leaks });
}

const n = rows.length;
const offL = rows.filter((r) => r.offLock);
const onL = rows.filter((r) => r.onLock);
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const out: string[] = [];
out.push(`잠금 검사 ${n} 조합 (210 + 재밌는 ${FUN.length} + 제어 잔뜩 60, 그중 20 은 레벨 6), 적 체력 ×40, 30초`);
out.push(`다가오는 빠르기 가운데값 px/s: 따로 ${med(rows.map((r) => r.sepAdv)).toFixed(1)} · 저항 없음 ${med(rows.map((r) => r.offAdv)).toFixed(1)} · 저항 ${med(rows.map((r) => r.onAdv)).toFixed(1)}`);
out.push(`제어 몫 가운데값: 저항 없음 ${(med(rows.map((r) => r.offCtl)) * 100).toFixed(0)}% · 저항 ${(med(rows.map((r) => r.onCtl)) * 100).toFixed(0)}%`);
out.push(`잠금: 저항 없음 ${offL.length} · 저항 ${onL.length}`);
for (const r of offL.sort((a, b) => a.offAdv / Math.max(0.1, a.sepAdv) - b.offAdv / Math.max(0.1, b.sepAdv)).slice(0, 15)) out.push(`  ${r.title.padEnd(26)} 다가옴 따로 ${r.sepAdv.toFixed(1)} → 저항 없음 ${r.offAdv.toFixed(1)} (제어 ${(r.offCtl * 100).toFixed(0)}%) → 저항 ${r.onAdv.toFixed(1)} (제어 ${(r.onCtl * 100).toFixed(0)}%)`);
if (onL.length) out.push(`저항 켜도 남은 잠금: ${onL.map((r) => r.title).join(', ')}`);
console.log(out.join('\n'));
void ARMS;
if (process.argv.includes('--write')) {
  writeFileSync('tools/showcase/pages/lock4-results.ts', `// npx tsx tools/carry/lock4.ts --write (잠금 검사)\nexport const LOCK4 = ${JSON.stringify({ n, offLocks: offL.length, onLocks: onL.length, sepAdv: med(rows.map((r) => r.sepAdv)), offAdv: med(rows.map((r) => r.offAdv)), onAdv: med(rows.map((r) => r.onAdv)), offCtl: med(rows.map((r) => r.offCtl)), onCtl: med(rows.map((r) => r.onCtl)), worst: offL.slice(0, 10).map((r) => ({ title: r.title, sep: r.sepAdv, off: r.offAdv, on: r.onAdv, offCtl: r.offCtl, onCtl: r.onCtl })), left: onL.map((r) => r.title) }, null, 2)};\n`);
}
