/**
 * 회의(11-25 조합 편차) 측정 하네스. tools/carry/check2.ts 의 run2 와 같은 판 (적 14 유지, 18초, 체력 배율 hp)에
 * 피해 합(무기별) · B 반응 세기 배율 덮어쓰기(mul)만 더했다. src/ 는 건드리지 않는다 (Chaos 인스턴스의 gradeMul 만 감쌈).
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import type { InputPattern } from '../../src/data/combineV2';
import { NO_META } from '../../src/sim/stats';
import type { Command } from '../../src/sim/types';
import { World } from '../../src/sim/World';
import { InputDriver } from '../carry/input';

const FW = BALANCE.field.width;

export interface Sim {
  kills: number;
  /** 실제로 깎은 체력 합 (Chaos.dmgBy, 넘친 피해 뺌) */
  dmg: number;
  /** 무기 id → 피해 */
  by: Record<string, number>;
  leaks: number;
  /** B 가 나간 수 · 극적 반응 수 (fusion.stat4 합) */
  fires: number;
  drama: number;
  res: number;
}

export interface SimOpt {
  seed: number;
  level: number;
  hp: number;
  input?: InputPattern | null;
  seconds?: number;
  /** B 반응 세기 배율에 곱함 (지렛대 측정). 숫자 하나 또는 몸(뿌리 A id)마다 */
  mul?: number | ((rootId: string) => number);
}

export function sim(weapons: string[], fuse: [string, string][], opt: SimOpt): Sim {
  const fused = fuse.length > 0;
  const w = new World({ seed: opt.seed, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true, fuseRule: fused ? 'width' : undefined });
  const ch = w.chaos!;
  if (opt.mul !== undefined) {
    const orig = ch.gradeMul.bind(ch);
    const m = opt.mul;
    (ch as unknown as { gradeMul: (id: string) => number }).gradeMul = (id: string) => orig(id) * (typeof m === 'number' ? m : m(ch.rootOf(id)));
  }
  const skip = () => {
    const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
    a.offerQueue.length = 0;
    if (a.phase === 'choosing') {
      a.offer = null;
      a.phase = 'playing';
    }
  };
  skip();
  for (const id of weapons) for (let i = 0; i < opt.level; i++) w.augments.acquire(id, w);
  for (const [a, b] of fuse) if (!ch.fuse4(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
  if (fused) {
    ch.fusion.drama = true;
    ch.fusion.v5 = true;
  }
  const drv = opt.input ? new InputDriver(opt.input) : null;
  let spawnT = 0;
  let leaks = 0;
  let res = 0;
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
        w.spawnEnemy(kind, w.rng.range(30, FW - 30), w.rng.range(90, BALANCE.field.height * 0.52), opt.hp);
      }
    }
    const cmds: Command[] = drv ? drv.step(w, FIXED_DT) : [];
    skip();
    w.step(FIXED_DT, cmds);
    skip();
    (w as unknown as { life: number }).life = w.stats.maxLife;
    for (const ev of w.drainEvents()) {
      if (ev.type === 'leak') leaks++;
      else if (ev.type === 'react' && ev.text.endsWith('공명!')) res++;
    }
  }
  let fires = 0;
  let drama = 0;
  for (const s of ch.fusion.stat4.values()) {
    fires += s.fires;
    drama += s.drama;
  }
  const by: Record<string, number> = {};
  let dmg = 0;
  for (const [k, v] of ch.dmgBy) {
    by[k] = Math.round(v);
    dmg += v;
  }
  return { kills: w.kills, dmg: Math.round(dmg), by, leaks, fires, drama, res };
}

/** 씨앗 여럿의 합 */
export function simSeeds(weapons: string[], fuse: [string, string][], opt: Omit<SimOpt, 'seed'>, seeds: number[]): Sim {
  const out: Sim = { kills: 0, dmg: 0, by: {}, leaks: 0, fires: 0, drama: 0, res: 0 };
  for (const seed of seeds) {
    const r = sim(weapons, fuse, { ...opt, seed });
    out.kills += r.kills;
    out.dmg += r.dmg;
    out.leaks += r.leaks;
    out.fires += r.fires;
    out.drama += r.drama;
    out.res += r.res;
    for (const [k, v] of Object.entries(r.by)) out.by[k] = (out.by[k] ?? 0) + v;
  }
  return out;
}

/** 결정적 난수 (표본 뽑기용) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    shuffle<T>(a: T[]): T[] {
      const b = [...a];
      for (let i = b.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [b[i], b[j]] = [b[j], b[i]];
      }
      return b;
    },
  };
}
