import { ARMS, CATEGORY_COLOR, type WeaponParams, type WeaponSpec } from '../data/chaos';
import { V2, rulesV2 } from '../data/combineV2';

/** 짝 이름 (갈래 A>B → 이름) */
const NAME = new Map(rulesV2().map((r) => [r.key, r.name] as const));
import { clamp, dist2 } from '../core/math';
import type { Actor, Chaos } from './chaos';
import type { Enemy } from './types';

/**
 * 합성 v2 (src/data/combineV2.ts, docs/design/combine-210-v2.md): 합친 무기 = A 의 몸 × B 의 동사.
 * B 는 A 안에 들어가 따로 쏘지 않고, A 가 내보내는 것(총탄·포탄·소환수·함정…)이 B 처럼 바뀐다.
 * Chaos 가 A 의 사건(쏨·맞음·빗나감·처치·착탄·밟힘·고리·장판·줄기·튕김·구름·혼·탭)마다 여기를 부르고,
 * 짝 규칙(RULES, 갈래 A>B 210가지)이 B 를 그 자리에서 쓴다. B 가 낸 것은 B 의 것(src = B)이라
 * B 가 또 무엇을 합쳤으면 그 규칙이 이어서 걸린다 (함정 + (총 + 소환수): 함정이 쏜 총탄이 전향탄).
 * v1 (Chaos.attach · carry) 과는 따로 돈다.
 */

/** chaos.ts 의 TAG_MINI 와 같은 값 (값을 가져오면 순환 import) */
const TAG_MINI = 1;
/** 정령이 터질 때 나간 혼탄 */
export const TAG_BURSTB = 2;
/** 아군으로 일어난 적 (합성) */
export const TAG_ALLY = 16;
/** 무엇의 둘레를 도는 날 (fusion 이 자리를 옮김) */
export const TAG_ORBIT = 32;
/** 튕겨 다음 적으로 가는 총탄 (trail = 남은 튕김) */
export const TAG_RICO = 64;
/** 떨어진 뒤 다음 적으로 다시 튀는 포탄·낙하물 (trail = 남은 횟수) */
export const TAG_HOP = 128;
/** 떨어진 뒤 투척으로 이어지는 낙하물 (trail = 튕김 수) */
export const TAG_HOPTOSS = 256;

type Pt = { x: number; y: number };
export interface Ctx {
  f: Fusion;
  A: WeaponSpec;
  B: WeaponSpec;
}
/** 짝 규칙: A 의 사건마다 */
interface H {
  shot?(x: Ctx, a: Actor): void;
  hit?(x: Ctx, e: Enemy, px: number, py: number, a: Actor | null): void;
  removed?(x: Ctx, a: Actor): void;
  kill?(x: Ctx, e: Enemy, by: Actor | null): void;
  /** 어느 무기가 잡았든 (표식·옮는 주문 등) */
  anyKill?(x: Ctx, e: Enemy): void;
  /** 포탄·낙하물이 닿기 직전. true 면 원래 폭발 대신 */
  land?(x: Ctx, px: number, py: number, a: Actor): boolean | void;
  trapPlace?(x: Ctx, a: Actor): void;
  trigger?(x: Ctx, a: Actor): void;
  unitSpawn?(x: Ctx, a: Actor): void;
  unitReach?(x: Ctx, a: Actor, e: Enemy): void;
  cast?(x: Ctx, px: number, py: number, targets: Enemy[]): void;
  /** 달리는 몸이 화면 끝에 닿음. true 면 사라지지 않음 */
  edge?(x: Ctx, a: Actor): boolean | void;
  move?(x: Ctx, a: Actor, d: number): void;
  pulse?(x: Ctx, px: number, py: number, r: number, hits: Enemy[]): void;
  bounce?(x: Ctx, a: Actor): void;
  zone?(x: Ctx, px: number, py: number, r: number, ttl: number): void;
  /** 장판 위 적, 1초마다 */
  zoneTick?(x: Ctx, z: Actor, on: Enemy[]): void;
  /** 줄기가 붙은 동안 0.1초마다 */
  ray?(x: Ctx, a: Actor, t: Enemy, ramp: number): void;
  rayUp?(x: Ctx, a: Actor, t: Enemy, lvl: number): void;
  rayRetarget?(x: Ctx, a: Actor): void;
  tossEnd?(x: Ctx, a: Actor): void;
  /** 구름이 덮은 적, 0.25초마다 */
  cloud?(x: Ctx, a: Actor, under: Enemy[]): void;
  soul?(x: Ctx, d: Actor, px: number, py: number): void;
  /** 정령 터짐. true 면 원래 혼탄 대신 */
  burst?(x: Ctx, d: Actor): boolean | void;
  press?(x: Ctx, px: number, py: number): void;
  release?(x: Ctx, px: number, py: number, held: number): void;
  tick?(x: Ctx, dt: number): void;
}

export class Fusion {
  /** A id → 안에 합친 B id 들 */
  readonly kids = new Map<string, string[]>();
  /** 규칙이 무엇을 해낸 횟수 ("A id>B id") — 검증·미리보기 */
  readonly fired = new Map<string, number>();
  private timers: { at: number; fn: () => void; src: string; depth: number; key: string }[] = [];
  /** 지금 도는 짝 ("A id>B id") */
  private curKey = '';
  private thr = new Map<string, number>();
  private cnt = new Map<string, number>();
  /** 규칙별 상태 */
  readonly st = new Map<string, unknown>();
  /** 최근 처치 자리 (혼 빙의) */
  deaths: { x: number; y: number; t: number }[] = [];
  /** 최근 누른 자리 (손: 잇기·삼각형·경로·박자) */
  presses: { x: number; y: number; t: number }[] = [];
  holding: { x: number; y: number; t: number } | null = null;
  /** 폭발·장판이 낸 처치를 누구 몫으로 칠지 */
  private credit: { x: number; y: number; r: number; src: string; depth: number; until: number; actor: Actor | null }[] = [];
  /** 정령을 합친 무기의 처치 혼 (겹친 합성에서 안쪽 정령이 터지게) */
  private relay = new Map<string, number>();
  /** 둘레를 도는 날 */
  private orbits = new Map<number, { cx: number; cy: number; follow: Actor | null; rad: number; ang: number; spd: number }>();
  /** 날려 보낸 적 (부딪친 적도 피해) */
  private flung: { e: Enemy; until: number; dmg: number; hit: Set<number> }[] = [];
  /** 피해를 나누는 사슬 */
  private shares: { es: Enemy[]; until: number }[] = [];
  private sharing = false;

  constructor(readonly c: Chaos) {}

  get active(): boolean {
    return this.kids.size > 0;
  }

  // ─── 합치기 ────────────────────────────────────────────

  /** B 를 A 안에 합친다 (v2). 같은 갈래, 이미 들어간 무기, 고리는 안 된다 */
  fuse(a: string, b: string): boolean {
    const A = ARMS[a];
    const B = ARMS[b];
    const c = this.c;
    if (!A || !B || a === b || A.cat === B.cat || A.cat === 'passive' || B.cat === 'passive') return false;
    if (c.parent.has(b)) return false;
    for (let x: string | undefined = a; x; x = c.parent.get(x)) if (x === b) return false;
    const kids = this.kids.get(a) ?? [];
    kids.push(b);
    this.kids.set(a, kids);
    c.parent.set(b, a);
    c.cooldowns.delete(b);
    for (let i = c.actors.length - 1; i >= 0; i--) {
      const x = c.actors[i];
      if (x.src === b && x.depth === 0 && (x.kind === 'ray' || x.kind === 'drone')) c.actors.splice(i, 1);
    }
    return true;
  }

  has(id: string): boolean {
    return this.kids.has(id);
  }

  /** src 의 짝 규칙을 차례로. 그동안 새로 생기는 것은 B 의 것 (src = B, 깊이 +1) */
  private run(src: string, fn: (h: H, x: Ctx) => unknown, deep = true): boolean {
    const kids = this.kids.get(src);
    if (!kids) return false;
    const c = this.c;
    if (deep && c.curDepth >= V2.maxDepth) return false;
    const A = ARMS[src];
    let any = false;
    for (const b of kids) {
      const B = ARMS[b];
      const key = `${A.cat}>${B.cat}`;
      const h = RULES[key];
      if (!h) continue;
      const sSrc = c.curSrc;
      const sDepth = c.curDepth;
      const n0 = c.actors.length;
      c.curSrc = b;
      c.curDepth = sDepth + 1;
      const sKey = this.curKey;
      this.curKey = `${src}>${b}`;
      let r: unknown;
      try {
        r = fn(h, { f: this, A, B });
      } finally {
        c.curSrc = sSrc;
        c.curDepth = sDepth;
        this.curKey = sKey;
      }
      if (r === true) any = true;
      if (r === true || c.actors.length > n0) this.bump(`${src}>${b}`);
    }
    return any;
  }

  /** 규칙이 액터를 만들지 않고 해낸 일 (주문·약화 등) 도 센다 */
  did(x?: Ctx): void {
    const k = x ? `${x.A.id}>${x.B.id}` : this.curKey;
    if (k) this.bump(k);
  }

  /** 해낸 횟수 +1. 이 판에서 처음이면 이름을 알린다 (게임 안 발견: 이름만, 규칙 문장은 숨김) */
  private bump(k: string): void {
    const n = this.fired.get(k) ?? 0;
    this.fired.set(k, n + 1);
    if (n > 0) return;
    const [a, b] = k.split('>');
    const name = NAME.get(`${ARMS[a]?.cat}>${ARMS[b]?.cat}`);
    if (name) this.c.w.emit({ type: 'fusion', name, a, b });
  }

  // ─── Chaos 가 부르는 사건 ──────────────────────────────

  shot(src: string, a: Actor): void {
    this.run(src, (h, x) => h.shot?.(x, a), false);
  }
  hit(src: string, e: Enemy, px: number, py: number, a: Actor | null): void {
    this.run(src, (h, x) => h.hit?.(x, e, px, py, a));
  }
  removed(a: Actor): void {
    this.run(a.src, (h, x) => h.removed?.(x, a));
  }
  kill(e: Enemy): void {
    const c = this.c;
    this.deaths.push({ x: e.x, y: e.y, t: c.w.time });
    if (this.deaths.length > 40) this.deaths.shift();
    let src = c.curSrc;
    let depth = c.curDepth;
    let by: Actor | null = c.curActor && c.curActor.src === src ? c.curActor : null;
    if (!src || !this.kids.has(src)) {
      const cr = this.creditAt(e.x, e.y);
      if (cr) {
        src = cr.src;
        depth = cr.depth;
        by = cr.actor && c.actors.includes(cr.actor) ? cr.actor : null;
      }
    }
    const sd = c.curDepth;
    c.curDepth = depth;
    if (src) {
      this.run(src, (h, x) => h.kill?.(x, e, by));
      this.spiritRelay(src, e);
    }
    c.curDepth = sd;
    for (const a of this.kids.keys()) this.run(a, (h, x) => h.anyKill?.(x, e), false);
  }
  land(src: string, px: number, py: number, a: Actor): boolean {
    // 다음 적으로 다시 튀는 포탄·낙하물
    if (a.tag & TAG_HOP && a.trail > 0) this.nextHop(a, px, py);
    if (a.tag & TAG_HOPTOSS) this.tossFrom(a, px, py);
    return this.run(src, (h, x) => h.land?.(x, px, py, a));
  }
  trapPlace(src: string, a: Actor): void {
    this.run(src, (h, x) => h.trapPlace?.(x, a), false);
  }
  trigger(src: string, a: Actor): void {
    // 알(떼 + 함정) 이 밟히면 작은 구름이 깨어난다
    const egg = this.st.get(`egg:${a.id}`) as WeaponSpec | undefined;
    if (egg) this.cloud(egg, a.x, a.y, 26, 2);
    const blade = this.st.get(`tblade:${a.id}`) as WeaponSpec | undefined;
    if (blade) this.blade(blade, a.x, a.y, this.c.w.rng.range(0, Math.PI * 2), 3, 0.8);
    this.run(src, (h, x) => h.trigger?.(x, a));
  }
  unitSpawn(src: string, a: Actor): void {
    this.run(src, (h, x) => h.unitSpawn?.(x, a), false);
  }
  unitReach(src: string, a: Actor, e: Enemy): void {
    this.run(src, (h, x) => h.unitReach?.(x, a, e));
  }
  cast(src: string, px: number, py: number, targets: Enemy[]): void {
    this.run(src, (h, x) => h.cast?.(x, px, py, targets));
  }
  edge(src: string, a: Actor): boolean {
    return this.run(src, (h, x) => h.edge?.(x, a), false);
  }
  move(src: string, a: Actor, d: number): void {
    this.run(src, (h, x) => h.move?.(x, a, d));
  }
  /** 공중의 '닿음' (낙하물이 아닌 공중 무기: 레이저 기둥·번개·폭풍·공습·핵) */
  impact(src: string, x: number, y: number, r: number, dmg: number, p?: WeaponParams): void {
    if (!this.every(`imp:${src}`, 0.12)) return;
    this.land(src, x, y, this.ghost(x, y, r, dmg, p));
  }
  /** 투척의 '맞음' (투척물이 아닌 투척 무기: 분열 폭탄) */
  throwImpact(src: string, x: number, y: number): void {
    const e = this.nearest(x, y, 50);
    if (e && this.every(`thi:${src}`, 0.1)) this.hit(src, e, x, y, null);
  }
  /** 목록에 없는 임시 물체 (사건을 넘길 때) */
  ghost(x: number, y: number, r: number, dmg: number, p?: WeaponParams): Actor {
    return { id: -1, kind: 'ring', x, y, vx: 0, vy: 0, t: 0, ttl: 0, tx: x, ty: y, n: 0, dir: 1, m: 1, gated: false, hits: null, grabbed: null, reels: null, p: p ?? null, emoji: null, dmg, left: 0, r, cd: 0, src: '', target: null, depth: this.c.curDepth, tag: 0, trail: 0 };
  }
  /** A 가 정령 B 를 합쳤고 B 가 또 무엇을 합쳤으면: A 의 처치마다 혼이 B 로, 여섯이면 B 가 그 자리에서 터진다 */
  private spiritRelay(src: string, e: Enemy): void {
    const kids = this.kids.get(src);
    if (!kids) return;
    for (const b of kids) {
      if (ARMS[b].cat !== 'spirit' || !this.kids.has(b) || this.c.curDepth >= V2.maxDepth) continue;
      const n = (this.relay.get(b) ?? 0) + 1;
      const g = this.ghost(e.x, e.y, 0, this.dmg(ARMS[b]));
      g.left = n;
      this.soul(b, g, e.x, e.y);
      if (n >= V2.spiritBurst) {
        this.relay.set(b, 0);
        const s = this.c.curSrc;
        this.c.curSrc = b;
        if (!this.burst(b, g)) this.radial(ARMS[b], e.x, e.y, 8, 1, 200);
        this.c.curSrc = s;
        this.ring(e.x, e.y, 40, this.col(ARMS[b]), 0.4);
      } else this.relay.set(b, n);
    }
  }
  /** src 의 kind 물체 중 (x, y) 에서 가장 가까운 것 */
  nearestOf(src: string, kind: Actor['kind'], x: number, y: number, r: number): Actor | null {
    let best: Actor | null = null;
    let bd = r * r;
    for (const a of this.c.actors) {
      if (a.src !== src || a.kind !== kind) continue;
      const d = dist2(a.x, a.y, x, y);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  /** 달리는 몸이 움직임: 화면 안에서 80 마다 move */
  moved(a: Actor, px: number, py: number): void {
    const c = this.c;
    if (a.x < 0 || a.x > c.w.field.width || a.y < 0 || a.y > c.LINE) return;
    const k = `mv:${a.id}`;
    const d = ((this.st.get(k) as number | undefined) ?? 0) + Math.hypot(a.x - px, a.y - py);
    if (d < 80) {
      this.st.set(k, d);
      return;
    }
    this.st.set(k, 0);
    this.move(a.src, a, d);
  }
  pulse(src: string, px: number, py: number, r: number, hits: Enemy[]): void {
    this.run(src, (h, x) => h.pulse?.(x, px, py, r, hits));
  }
  bounce(src: string, a: Actor): void {
    this.run(src, (h, x) => h.bounce?.(x, a));
  }
  zone(src: string, px: number, py: number, r: number, ttl: number): void {
    if (!this.kids.has(src)) return;
    // 장판 위 적을 1초마다 보는 표시 (안 그림)
    const z = this.c.add('fzone', px, py, { ttl, r });
    if (z) {
      z.src = src;
      z.cd = 0.5;
    }
    this.credit.push({ x: px, y: py, r, src, depth: this.c.curDepth, until: this.c.w.time + ttl, actor: null });
    this.run(src, (h, x) => h.zone?.(x, px, py, r, ttl));
  }
  zoneTick(z: Actor, on: Enemy[]): void {
    this.run(z.src, (h, x) => h.zoneTick?.(x, z, on));
  }
  ray(src: string, a: Actor, t: Enemy, ramp: number): void {
    this.run(src, (h, x) => h.ray?.(x, a, t, ramp));
    // 배율이 0.5 오를 때마다 (×1.5 → 3, ×2 → 4 … ×4 → 8)
    const k = `rl:${a.id}`;
    const lvl = Math.floor(ramp * 2);
    const was = (this.st.get(k) as number | undefined) ?? 2;
    if (lvl < was) this.st.set(k, lvl);
    else if (lvl > was) {
      this.st.set(k, lvl);
      this.rayUp(src, a, t, lvl);
    }
  }
  rayUp(src: string, a: Actor, t: Enemy, lvl: number): void {
    this.run(src, (h, x) => h.rayUp?.(x, a, t, lvl));
  }
  rayRetarget(src: string, a: Actor): void {
    this.run(src, (h, x) => h.rayRetarget?.(x, a), false);
  }
  tossEnd(src: string, a: Actor): void {
    this.run(src, (h, x) => h.tossEnd?.(x, a));
  }
  cloud(src: string, a: Actor, under: Enemy[]): void;
  cloud(B: WeaponSpec, x: number, y: number, r: number, ttl: number, mul?: number, target?: Enemy | null): Actor | null;
  cloud(a1: string | WeaponSpec, a2: number | Actor, a3: number | Enemy[], r?: number, ttl?: number, mul = 1, target: Enemy | null = null): Actor | null | void {
    if (typeof a1 === 'string') {
      const a = a2 as Actor;
      const under = a3 as Enemy[];
      this.run(a1, (h, x) => h.cloud?.(x, a, under));
      return;
    }
    return this.spawnCloud(a1, a2 as number, a3 as number, r!, ttl!, mul, target);
  }
  soul(src: string, d: Actor, px: number, py: number): void {
    this.run(src, (h, x) => h.soul?.(x, d, px, py));
  }
  burst(src: string, d: Actor): boolean {
    return this.run(src, (h, x) => h.burst?.(x, d));
  }

  /** 누름 (탭). 손이 몸이면 손 + B, 손이 실렸으면 A + 손 (손 쿨다운마다) */
  press(px: number, py: number): void {
    if (!this.active) return;
    const c = this.c;
    const t = c.w.time;
    this.presses.push({ x: px, y: py, t });
    if (this.presses.length > 8) this.presses.shift();
    this.holding = { x: px, y: py, t };
    for (const [a, kids] of this.kids) {
      const A = ARMS[a];
      if (A.cat === 'hand') {
        this.run(a, (h, x) => h.press?.(x, px, py), false);
        continue;
      }
      for (const b of kids) {
        if (ARMS[b].cat !== 'hand') continue;
        if ((c.cooldowns.get(b) ?? 0) > 0) continue;
        c.cooldowns.set(b, c.cooldownOf(b));
        // 손은 합쳐도 탭 공격 그대로 (그 위에 A 를 다루는 것이 얹힌다)
        const H = ARMS[b];
        const sSrc = c.curSrc;
        c.curSrc = b;
        c.tapEffect(H, c.eff(H).p, c.D * c.dmgMul(H), px, py);
        c.curSrc = sSrc;
        this.runOne(a, b, (h, x) => h.press?.(x, px, py));
      }
    }
  }

  release(px: number, py: number): void {
    if (!this.active || !this.holding) return;
    const held = this.c.w.time - this.holding.t;
    this.holding = null;
    for (const [a, kids] of this.kids) {
      for (const b of kids) {
        if (ARMS[a].cat !== 'hand' && ARMS[b].cat !== 'hand') continue;
        this.runOne(a, b, (h, x) => h.release?.(x, px, py, held));
      }
    }
  }

  private runOne(a: string, b: string, fn: (h: H, x: Ctx) => unknown): void {
    const kids = this.kids.get(a);
    if (!kids) return;
    const only = [b];
    this.kids.set(a, only);
    try {
      this.run(a, fn, false);
    } finally {
      this.kids.set(a, kids);
    }
  }

  /** 자동으로 쏘지 않게 막는가 (주문을 손에 쥠, 고리를 붙잡음) */
  blocks(id: string): boolean {
    const kids = this.kids.get(id);
    if (!kids) return false;
    const A = ARMS[id];
    for (const b of kids) {
      if (ARMS[b].cat !== 'hand') continue;
      if (A.cat === 'magic') return true;
      if (A.cat === 'sound' && this.holding) return true;
    }
    return false;
  }

  /** 사거리 배율 (혼 울림) */
  rangeMul(id: string): number {
    return (this.st.get(`range:${id}`) as number | undefined) ?? 1;
  }

  /** 정령 쿨다운 배율 (혼 연사) */
  droneRate(d: Actor): number {
    const kids = this.kids.get(d.src);
    if (!kids) return 1;
    for (const b of kids) if (ARMS[b].cat === 'gun') return 1 / (1 + 0.1 * d.left);
    return 1;
  }

  /** 피해가 들어간 적: 사슬로 이어진 적에게 30% (주문 사슬) */
  damaged(e: Enemy, dmg: number): void {
    if (this.sharing || this.shares.length === 0) return;
    const t = this.c.w.time;
    this.sharing = true;
    try {
      for (const s of this.shares) {
        if (s.until < t || !s.es.includes(e)) continue;
        for (const o of s.es) if (o !== e && !o.dead) this.c.hit(o, dmg * 0.3, {}, this.c.w.newChain(1));
      }
    } finally {
      this.sharing = false;
    }
  }

  /** 폭발 자리 기록 (그 폭발로 죽은 적을 낸 무기 몫으로) */
  noteBoom(x: number, y: number, r: number): void {
    const c = this.c;
    if (!c.curSrc || !this.kids.has(c.curSrc)) return;
    this.credit.push({ x, y, r: r + 10, src: c.curSrc, depth: c.curDepth, until: c.w.time + 0.6, actor: c.curActor });
    if (this.credit.length > 80) this.credit.shift();
  }

  private creditAt(x: number, y: number): { src: string; depth: number; actor: Actor | null } | null {
    const t = this.c.w.time;
    for (let i = this.credit.length - 1; i >= 0; i--) {
      const k = this.credit[i];
      if (k.until < t) continue;
      if (dist2(x, y, k.x, k.y) <= k.r * k.r) return k;
    }
    return null;
  }

  /** 매 스텝 (Chaos.update 끝): 미뤄 둔 일, 도는 날, 날려 보낸 적, 짝마다 늘 하는 일 */
  update(dt: number): void {
    if (!this.active) return;
    const c = this.c;
    const t = c.w.time;
    if (this.timers.length) {
      const due = this.timers.filter((x) => x.at <= t);
      this.timers = this.timers.filter((x) => x.at > t);
      for (const x of due) {
        // 미뤄 둔 일도 그 짝의 것 (B 의 것으로 생기고, 해낸 횟수에 든다)
        const s = [c.curSrc, c.curDepth, this.curKey] as const;
        c.curSrc = x.src;
        c.curDepth = x.depth;
        this.curKey = x.key;
        const n0 = c.actors.length;
        x.fn();
        if (c.actors.length > n0 && x.key) this.bump(x.key);
        c.curSrc = s[0];
        c.curDepth = s[1];
        this.curKey = s[2];
      }
    }
    this.credit = this.credit.filter((k) => k.until >= t);
    this.shares = this.shares.filter((s) => s.until >= t);
    // 도는 날
    for (const [id, o] of this.orbits) {
      const a = c.actors.find((x) => x.id === id);
      if (!a) {
        this.orbits.delete(id);
        continue;
      }
      if (o.follow) {
        if (!c.actors.includes(o.follow)) {
          // 따르던 것이 사라지면 날이 흩어진다
          this.orbits.delete(id);
          a.tag &= ~TAG_ORBIT;
          const g = c.w.rng.range(0, Math.PI * 2);
          a.vx = Math.cos(g) * 260;
          a.vy = Math.sin(g) * 260;
          continue;
        }
        o.cx = o.follow.x;
        o.cy = o.follow.y;
      }
      o.ang += o.spd * dt;
      a.x = o.cx + Math.cos(o.ang) * o.rad;
      a.y = o.cy + Math.sin(o.ang) * o.rad;
      a.vx = a.vy = 0;
    }
    // 날려 보낸 적이 부딪친 적
    for (const fl of this.flung) {
      if (fl.e.dead || fl.until < t) continue;
      for (const o of c.w.enemiesNear(fl.e.x, fl.e.y, fl.e.radius + 8)) {
        if (o === fl.e || fl.hit.has(o.id)) continue;
        fl.hit.add(o.id);
        c.hit(o, fl.dmg, {}, c.w.newChain(1));
        c.push(o, fl.e.x, fl.e.y, 60);
      }
    }
    this.flung = this.flung.filter((fl) => !fl.e.dead && fl.until >= t);
    for (const a of this.kids.keys()) this.run(a, (h, x) => h.tick?.(x, dt), false);
  }

  // ─── 도구 ──────────────────────────────────────────────

  now(): number {
    return this.c.w.time;
  }
  p(B: WeaponSpec): WeaponParams {
    return this.c.eff(B).p;
  }
  /** A 한 방 세기 (같은 갈래 가운데값 대비 0.5 ~ 2) */
  k(A: WeaponSpec): number {
    return clamp(this.c.carryPower(A), V2.kMin, V2.kMax);
  }
  /** B 한 번의 피해 (B 레벨 포함, 깎지 않고 합성 배율까지) */
  dmg(B: WeaponSpec, mul = 1): number {
    const p = this.p(B);
    return (p.dmg ?? (p.dps ? p.dps * 0.8 : 2)) * this.c.D * this.c.dmgMul(B) * V2.verbMul * mul;
  }
  later(sec: number, fn: () => void): void {
    this.timers.push({ at: this.now() + sec, fn, src: this.c.curSrc, depth: this.c.curDepth, key: this.curKey });
  }
  /** key 가 sec 초 안에 이미 했으면 false */
  every(key: string, sec: number): boolean {
    const t = this.now();
    const last = this.thr.get(key);
    if (last !== undefined && t - last < sec) return false;
    this.thr.set(key, t);
    return true;
  }
  count(key: string, inc = 1): number {
    const v = (this.cnt.get(key) ?? 0) + inc;
    this.cnt.set(key, v);
    return v;
  }
  setCount(key: string, v: number): void {
    this.cnt.set(key, v);
  }
  near(x: number, y: number, r: number, n = 99, exclude: Enemy | null = null): Enemy[] {
    const c = this.c;
    return c.w
      .enemiesNear(x, y, r)
      .filter((e) => e !== exclude && c.visible(e))
      .sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y))
      .slice(0, n);
  }
  nearest(x: number, y: number, r: number, exclude: Enemy | null = null): Enemy | null {
    return this.near(x, y, r, 1, exclude)[0] ?? null;
  }
  dense(): Enemy | null {
    return this.c.pickTarget('dense', undefined, this.c.LINE - 30);
  }
  strong(): Enemy | null {
    return this.c.pickTarget('strong', undefined, this.c.LINE - 30);
  }
  /** 무기 자리 (없으면 방어선 가운데) */
  mount(id: string): Pt {
    const m = this.c.mountOf(this.root(id));
    return m ? { x: m.x, y: m.y - 8 } : { x: this.c.w.field.width / 2, y: this.c.LINE - 10 };
  }
  root(id: string): string {
    let x = id;
    for (let p = this.c.parent.get(x); p; p = this.c.parent.get(x)) x = p;
    return x;
  }
  of(src: string, kind?: Actor['kind']): Actor[] {
    return this.c.actors.filter((a) => a.src === src && (!kind || a.kind === kind));
  }
  ring(x: number, y: number, r: number, color: string, ttl = 0.35): void {
    this.c.add('ring', x, y, { ttl, r, emoji: color });
  }
  mark(x: number, y: number, r: number, color: string, ttl: number): Actor | null {
    return this.c.add('mark', x, y, { ttl, r, emoji: color });
  }

  // ─── B 를 쓰는 것들 ─────────────────────────────────────

  bulletAt(B: WeaponSpec, x: number, y: number, ang: number, mul = 1, range = 240, p?: WeaponParams): Actor | null {
    const b = this.c.bullet(B.id, x, y, ang, p ?? this.p(B), this.dmg(B, mul), range, 0);
    // 낸 것은 B 의 것: B 가 합친 '쏠 때' 규칙도 걸린다 (겹친 합성)
    if (b && B.cat === 'gun' && this.kids.has(B.id)) this.shot(B.id, b);
    return b;
  }
  radial(B: WeaponSpec, x: number, y: number, n: number, mul = 1, range = 240): void {
    const off = this.c.w.rng.range(0, 1);
    for (let i = 0; i < n; i++) this.bulletAt(B, x, y, ((i + off) / n) * Math.PI * 2, mul, range);
  }
  shootAt(B: WeaponSpec, x: number, y: number, e: Enemy, mul = 1, p?: WeaponParams): Actor | null {
    return this.bulletAt(B, x, y, Math.atan2(e.y - y, e.x - x), mul, 280, p);
  }
  fan(B: WeaponSpec, x: number, y: number, n: number, mul = 1, exclude: Enemy | null = null, r = 200): number {
    const es = this.near(x, y, r, n, exclude);
    for (const e of es) this.shootAt(B, x, y, e, mul);
    return es.length;
  }
  blast(x: number, y: number, r: number, dmg: number, color = '#ffb347', p?: WeaponParams): void {
    this.c.boom(x, y, r * this.c.areaMul, dmg, p);
    this.ring(x, y, r, color, 0.3);
  }
  allies(): number {
    let n = 0;
    for (const a of this.c.actors) if (a.tag & TAG_ALLY) n++;
    return n;
  }
  /** 아군으로 일어난다 (소환수 B 의 모습, 다른 적을 맡음) */
  ally(B: WeaponSpec, x: number, y: number, ttl: number = V2.allySec, mul = 1): Actor | null {
    if (this.allies() >= V2.allyCap) return null;
    const base = B.cat === 'summon' ? this.p(B) : this.p(ARMS.arm_dog);
    const p = { ...base, melee: Math.max(3, base.melee ?? 0) };
    const a = this.c.add('walker', x, y, { ttl, p, emoji: p.emoji ?? B.emoji, dmg: (p.dmg ?? 2) * this.c.D * this.c.dmgMul(B) * mul, r: this.c.LINE - 20, left: p.melee });
    if (a) a.tag |= TAG_ALLY;
    this.ring(x, y, 16, '#7dff9a', 0.45);
    return a;
  }
  /** 소환수 B (맡을 적을 정해 줄 수 있음) */
  unit(B: WeaponSpec, x: number, y: number, ttl = 8, mul = 1, target: Enemy | null = null): Actor | null {
    const p = this.p(B.cat === 'summon' ? B : ARMS.arm_dog);
    const a = this.c.add('walker', x, y, { ttl, p, emoji: p.emoji ?? B.emoji, dmg: this.dmg(B.cat === 'summon' ? B : ARMS.arm_dog, mul), r: this.c.LINE - 20, left: p.melee ?? 0 });
    if (a && target) a.target = target;
    if (a && B.cat === 'summon' && this.kids.has(B.id) && this.c.curSrc === B.id) this.unitSpawn(B.id, a);
    this.ring(x, y, 14, '#7dff9a');
    return a;
  }
  spellKind(B: WeaponSpec): string {
    const p = this.p(B);
    return B.kind === 'spell' ? p.spell ?? 'stop' : B.kind === 'freezeAll' ? 'freeze' : B.kind === 'pullAt' ? 'pull' : 'stop';
  }
  /** 주문 지속 = 그 주문 지속 × 0.5 × k(A) × mul */
  spellDur(A: WeaponSpec, B: WeaponSpec, mul = 1): number {
    const p = this.p(B);
    return (p.ttl ?? p.freeze ?? 2) * 0.5 * this.k(A) * mul;
  }
  /** 적들에게 B 주문. 분신·가속은 rootId 무기에 */
  spellOn(B: WeaponSpec, es: Enemy[], dur: number, rootId: string): void {
    const c = this.c;
    const kind = this.spellKind(B);
    const t = this.now();
    // 낸 주문은 B 의 시전: B 가 합친 것이 따라간다 (겹친 합성)
    const live = es.filter((e) => !e.dead);
    if (B.cat === 'magic' && this.kids.has(B.id) && c.curSrc === B.id && live.length && this.every(`nest:${B.id}`, 0.5)) {
      const cx = live.reduce((s, e) => s + e.x, 0) / live.length;
      const cy = live.reduce((s, e) => s + e.y, 0) / live.length;
      this.cast(B.id, cx, cy, live);
    }
    switch (kind) {
      case 'clone':
        c.cloned.set(rootId, Math.max(c.cloned.get(rootId) ?? 0, t + dur));
        return;
      case 'haste':
        c.hasteUntil = Math.max(c.hasteUntil, t + dur);
        return;
    }
    let recalls = 0;
    for (const e of es) {
      if (e.dead || e.def.boss || e.charm > 0) continue;
      e.pack = null;
      switch (kind) {
        case 'stop':
          e.held = Math.max(e.held, dur);
          this.ring(e.x, e.y, 14, '#c9b8ff', 0.3);
          break;
        case 'freeze':
          e.frozen = Math.max(e.frozen, dur);
          this.ring(e.x, e.y, 14, '#9fe8ff', 0.3);
          break;
        case 'poly':
          e.poly = Math.max(e.poly, dur);
          this.ring(e.x, e.y, 16, '#b4a0ff', 0.35);
          break;
        case 'charm':
          if (this.allies() + this.charmed() >= V2.allyCap) break;
          e.charm = dur;
          this.ring(e.x, e.y, 16, '#ff6fb5', 0.35);
          break;
        case 'recall':
          if (recalls++ >= 2) break;
          this.ring(e.x, e.y, 18, '#9fd8ff');
          e.kx = e.ky = 0;
          e.y = c.w.rng.range(40, 120);
          this.ring(e.x, e.y, 18, '#9fd8ff');
          break;
        case 'pull':
          e.held = Math.max(e.held, dur * 0.5);
          break;
      }
    }
  }
  charmed(): number {
    let n = 0;
    for (const e of this.c.w.enemies) if (!e.dead && e.charm > 0) n++;
    return n;
  }
  spellAt(A: WeaponSpec, B: WeaponSpec, x: number, y: number, r: number, durMul = 1, n = 99): Enemy[] {
    const es = this.near(x, y, r, n);
    this.spellOn(B, es, this.spellDur(A, B, durMul), this.root(A.id));
    this.mark(x, y, r, '#c77dff', 0.35);
    return es;
  }
  trap(B: WeaponSpec, x: number, y: number, ttl = 12, mul = 1, fromX?: number, fromY?: number): Actor | null {
    const p = this.p(B.cat === 'trap' ? B : ARMS.arm_tr_mines);
    const c = this.c;
    const traps = c.actors.filter((a) => a.kind === 'trap');
    if (traps.length >= 36) traps[0].ttl = 0;
    const tx = clamp(x, 12, c.w.field.width - 12);
    const ty = clamp(y, 30, c.LINE - 16);
    return c.spawnTrap(p, this.dmg(B.cat === 'trap' ? B : ARMS.arm_tr_mines, mul), (p.boom ?? 40) * 0.8, p.melee ?? 1, fromX ?? tx, fromY ?? ty - 30, tx, ty, ttl, p.emoji ?? B.emoji);
  }
  drop(B: WeaponSpec, x: number, y: number, delay = 0, mul = 1, rMul = 0.8, look?: string): Actor | null {
    const p = this.p(B.cat === 'air' ? B : ARMS.arm_a_piano);
    const a = this.c.add('faller', x + 24, y - 240, { tx: x, ty: y, ttl: 3 + delay, p, emoji: look ?? p.emoji ?? B.emoji, dmg: this.dmg(B.cat === 'air' ? B : ARMS.arm_a_piano, mul), r: Math.max(24, ((p.radius ?? 40) + (p.boom ?? 0)) * rMul) });
    if (a) a.t = -delay;
    if (a && B.cat === 'air' && this.kids.has(B.id) && this.c.curSrc === B.id) this.shot(B.id, a);
    return a;
  }
  dash(B: WeaponSpec, x: number, y: number, ang: number, ttl = 1.6, mul = 1, look?: string, speedMul = 1.2): Actor | null {
    const p = this.p(B.cat === 'charge' ? B : ARMS.arm_c_bikers);
    const sp = (p.speed ?? 230) * speedMul;
    const vx = Math.cos(ang) * sp;
    const a = this.c.add('stamp', x, y, { vx, vy: Math.sin(ang) * sp, dir: vx >= 0 ? 1 : -1, ttl, p, emoji: look ?? p.emoji ?? B.emoji, dmg: this.dmg(B.cat === 'charge' ? B : ARMS.arm_c_bikers, mul), hits: true });
    if (a && B.cat === 'charge' && this.kids.has(B.id) && this.c.curSrc === B.id) this.shot(B.id, a);
    return a;
  }
  /** 둘레를 밀어내고 멈칫 (음파) */
  shock(x: number, y: number, r: number, knock: number, stun: number, dmg = 0, color = '#ffd36b'): Enemy[] {
    const c = this.c;
    const es = this.near(x, y, r);
    const chain = c.w.newChain(1);
    for (const e of es) {
      if (dmg > 0) c.hit(e, dmg, {}, chain);
      if (e.dead || e.def.boss) continue;
      if (knock) c.push(e, x, y, knock);
      if (stun) {
        e.held = Math.max(e.held, stun);
        e.pack = null;
      }
    }
    this.ring(x, y, r, color, 0.4);
    // 낸 충격파는 B 의 고리: B 가 합친 것이 따라간다 (겹친 합성)
    const src = c.curSrc;
    if (src && ARMS[src]?.cat === 'sound' && this.kids.has(src) && this.every(`nestp:${src}`, 0.3)) this.pulse(src, x, y, r, es);
    return es;
  }
  blade(B: WeaponSpec, x: number, y: number, ang: number, ttl: number, mul = 1, speed?: number, look?: WeaponParams): Actor | null {
    const p = look ?? this.p(B.cat === 'spinner' ? B : ARMS.arm_sp_disc);
    const sp = speed ?? p.speed ?? 260;
    const a = this.c.add('saw', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, ttl, p, dmg: this.dmg(B.cat === 'spinner' ? B : ARMS.arm_sp_disc, mul), hits: true, r: this.c.LINE - 30 });
    if (a && sp > 0 && B.cat === 'spinner' && this.kids.has(B.id) && this.c.curSrc === B.id) this.shot(B.id, a);
    return a;
  }
  /** 무엇의 둘레를 도는 날 */
  orbit(B: WeaponSpec, cx: number, cy: number, rad: number, ttl: number, follow: Actor | null = null, ang = 0, mul = 0.8): Actor | null {
    const a = this.blade(B, cx, cy, 0, ttl, mul, 0);
    if (!a) return null;
    a.tag |= TAG_ORBIT;
    this.orbits.set(a.id, { cx, cy, follow, rad, ang, spd: 4.5 });
    return a;
  }
  release2(a: Actor): void {
    this.orbits.delete(a.id);
    a.tag &= ~TAG_ORBIT;
  }
  zoneAt(B: WeaponSpec, x: number, y: number, r: number, ttl: number, mul = 1): void {
    const c = this.c;
    const F = B.cat === 'field' ? B : ARMS.arm_f_lava;
    const p = this.p(F);
    const rr = r * c.areaMul;
    switch (F.kind) {
      case 'frostArea':
        for (const e of this.near(x, y, rr)) if (!e.def.boss) e.frozen = Math.max(e.frozen, Math.min(1.2, ttl));
        this.ring(x, y, rr, '#9fe8ff', 0.5);
        break;
      case 'pullAt':
        c.add('vortex', x, y, { ttl: Math.min(1.2, ttl), r: rr, p: { ...p, boom: (p.boom ?? 60) * 0.4 }, dmg: this.dmg(F, mul * 0.5) });
        break;
      case 'bubble': {
        const a = c.add('bubble', x, y, { ttl: Math.min(2, ttl), r: rr, p, dmg: this.dmg(F, mul * 0.6), grabbed: true });
        if (a) for (const e of this.near(x, y, rr)) if (!e.def.boss) a.grabbed!.push(e);
        break;
      }
      default:
        c.w.addZone({ x, y, radius: rr, dps: (p.dps ?? 1) * c.D * c.dmgMul(F) * mul, ttl, chainId: c.w.newChain(1), source: 'exp' });
        this.ring(x, y, rr, p.color ?? '#ff8a3c', 0.35);
    }
    if (c.curSrc) this.credit.push({ x, y, r: rr, src: c.curSrc, depth: c.curDepth, until: this.now() + ttl, actor: null });
    // 장판을 낸 무기가 장판이고 무엇을 합쳤으면, 이 장판도 그 장판이다 (겹친 합성)
    if (F.cat === 'field' && c.curSrc === F.id && this.kids.has(F.id)) this.zone(F.id, x, y, rr, Math.max(3, ttl));
  }
  /** 두 점을 잇는 줄 (지나는 적을 dps 로 지짐). 끝이 적을 따라갈 수 있음 */
  tether(x1: number, y1: number, x2: number, y2: number, ttl: number, color: string, dps: number, e1: Enemy | null = null, e2: Enemy | null = null, w = 2): Actor | null {
    const a = this.c.add('tether', x1, y1, { tx: x2, ty: y2, ttl, emoji: color, dmg: dps, r: w });
    if (a) {
      a.target = e1;
      a.grabbed = e2 ? [e2] : null;
    }
    return a;
  }
  /** 다음 적으로 튕기는 투척물 */
  hop(B: WeaponSpec, x: number, y: number, n: number, mul = 1, exclude: Enemy | null = null): Actor | null {
    const t = this.nearest(x, y, 170, exclude);
    if (!t) return null;
    const T = B.cat === 'throw' ? B : ARMS.arm_th_volley;
    const p = this.p(T);
    const a = this.c.lob('tossed', x, y - 4, t.x, t.y, 420);
    if (a) {
      a.p = p;
      a.emoji = p.emoji ?? T.emoji;
      a.dmg = this.dmg(T, mul);
      a.left = n;
      a.hits = new Set(exclude ? [exclude.id] : []);
      a.dir = 0;
      if (T === B && this.kids.has(T.id) && this.c.curSrc === T.id) this.shot(T.id, a);
    }
    return a;
  }
  infest(e: Enemy, dur = 1.5): void {
    if (e.dead) return;
    e.infest = Math.max(e.infest, dur);
    e.pack = null;
  }
  private spawnCloud(B: WeaponSpec, x: number, y: number, r: number, ttl: number, mul = 1, target: Enemy | null = null): Actor | null {
    const S = B.cat === 'swarm' ? B : ARMS.arm_sw_mosquito;
    const p = this.p(S);
    const a = this.c.add('swarm', x, y, { ttl, p, emoji: p.emoji ?? '🦟', dmg: this.dmg(S, mul), r: r * this.c.areaMul, n: Math.round(6 + r / 6) });
    if (a) a.target = target ?? this.nearest(x, y, 120);
    if (a && S === B && this.kids.has(S.id) && this.c.curSrc === S.id) this.shot(S.id, a);
    return a;
  }
  /** 작은 정령 (혼 다섯이면 터짐) */
  orb(B: WeaponSpec, x: number, y: number, ttl = 6, mul = 1): Actor | null {
    const S = B.cat === 'spirit' ? B : ARMS.arm_sl_fairy;
    const p = this.p(S);
    const a = this.c.add('drone', x, y - 30, { ttl, p, r: 200, tx: x, ty: y - 30 });
    if (a) {
      a.tag |= TAG_MINI;
      a.dmg = this.dmg(S, mul);
    }
    return a;
  }
  shell(B: WeaponSpec, x: number, y: number, tx: number, ty: number, mul = 1, p?: WeaponParams): Actor | null {
    const T = B.cat === 'turret' ? B : ARMS.arm_cannon;
    const pp = p ?? this.p(T);
    const a = this.c.lob('thrown', x, y, tx, ty, pp.speed ?? 480);
    if (a) {
      a.p = pp;
      a.emoji = pp.emoji ?? null;
      a.dmg = this.dmg(T, mul);
      if (this.kids.has(T.id) && this.c.curSrc === T.id) this.shot(T.id, a);
    }
    return a;
  }
  /** 튕겨 다음 적으로 가는 총탄 */
  ricochet(x: number, y: number, from: Enemy | null, dmg: number, p: WeaponParams, n: number, src: string): void {
    const t = this.nearest(x, y, 180, from);
    if (!t) return;
    const s = this.c.curSrc;
    this.c.curSrc = src;
    const b = this.c.bullet(src, x, y, Math.atan2(t.y - y, t.x - x), { ...p, pierce: 0 }, dmg, 200, 0);
    this.c.curSrc = s;
    if (b) {
      b.tag |= TAG_RICO;
      b.trail = n - 1;
      if (from) b.hits!.add(from.id);
    }
  }
  /** 떨어진 포탄·낙하물이 다음 적 위로 다시 */
  private nextHop(a: Actor, x: number, y: number): void {
    const t = this.nearest(x, y, 200);
    if (!t) return;
    if (a.kind === 'faller') {
      const b = this.c.add('faller', t.x + 16, t.y - 160, { tx: t.x, ty: t.y, ttl: 3, p: a.p ?? undefined, emoji: a.emoji ?? undefined, dmg: a.dmg * 0.8, r: a.r });
      if (b) {
        b.tag |= TAG_HOP;
        b.trail = a.trail - 1;
        b.src = a.src;
      }
    } else {
      const b = this.c.lob('thrown', x, y, t.x, t.y, 360);
      if (b) {
        b.p = a.p;
        b.emoji = a.emoji;
        b.dmg = a.dmg * 0.8;
        b.src = a.src;
        b.tag |= TAG_HOP;
        b.trail = a.trail - 1;
      }
    }
  }
  /** 하늘에서 내리꽂힌 뒤 투척으로 이어짐 (투척 + 공중) */
  private tossFrom(a: Actor, x: number, y: number): void {
    const t = this.nearest(x, y, 170);
    if (!t) return;
    const b = this.c.lob('tossed', x, y - 4, t.x, t.y, 420);
    if (b) {
      b.p = a.p;
      b.emoji = (this.st.get(`tosslook:${a.id}`) as string | undefined) ?? a.emoji;
      b.dmg = a.dmg * 0.7;
      b.left = a.trail;
      b.hits = new Set();
      b.dir = 0;
      b.src = a.src;
    }
  }
  fling(e: Enemy, fromX: number, fromY: number, force: number, dmg: number, sec = 0.5): void {
    if (e.dead || e.def.boss) return;
    this.c.push(e, fromX, fromY, force);
    this.flung.push({ e, until: this.now() + sec, dmg, hit: new Set([e.id]) });
  }
  share(es: Enemy[], sec: number): void {
    if (es.length > 1) this.shares.push({ es, until: this.now() + sec });
  }
  /** 이어진 두 점 사이 (선분) 에서 가까운 적 */
  onSegment(x1: number, y1: number, x2: number, y2: number, w: number): Enemy[] {
    const out: Enemy[] = [];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const L2 = dx * dx + dy * dy || 1;
    for (const e of this.c.w.enemies) {
      if (e.dead || !this.c.visible(e)) continue;
      const k = clamp(((e.x - x1) * dx + (e.y - y1) * dy) / L2, 0, 1);
      if (dist2(e.x, e.y, x1 + dx * k, y1 + dy * k) <= (w + e.radius) ** 2) out.push(e);
    }
    return out;
  }
  /** 수명이 다한 함정 하나 터뜨리기 (원격 기폭) */
  detonate(a: Actor): void {
    const c = this.c;
    const p = a.p ?? {};
    c.boom(a.x, a.y, a.r, a.dmg, p);
    this.ring(a.x, a.y, a.r, p.color ?? '#ffb347', 0.3);
    const s = c.curSrc;
    c.curSrc = a.src;
    this.trigger(a.src, a);
    c.curSrc = s;
  }
  col(B: WeaponSpec): string {
    return CATEGORY_COLOR[B.cat];
  }
}

// ═══ 210 규칙 (갈래 A>B) ═══════════════════════════════════════════
// 문장은 src/data/combineV2.ts. 여기는 그 문장을 실제로 하는 것.

const W = 360;
/** 돌격 갈래에서 달리는 것 (chaos.ts MOVERS 와 같게) */
const RUN = new Set<Actor['kind']>(['stamp', 'sweep', 'dino', 'cow', 'train', 'dragon', 'tornado', 'donkey']);
/** 연속으로 누른 점들 (잇기·삼각형·경로) */
function recent(f: Fusion, sec: number, n: number): (Pt & { t: number })[] {
  const t = f.now();
  return f.presses.filter((p) => t - p.t <= sec).slice(-n);
}
function angTo(x: number, y: number, e: Pt): number {
  return Math.atan2(e.y - y, e.x - x);
}
function along(x1: number, y1: number, x2: number, y2: number, step: number, max: number): Pt[] {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.min(max, Math.max(1, Math.floor(L / step)));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n });
  return out;
}
function inTri(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  const s = (p1: Pt, p2: Pt, p3: Pt) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
  const d1 = s(p, a, b);
  const d2 = s(p, b, c);
  const d3 = s(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const RULES: Record<string, H> = {
  // ── 손공격 + B: B 를 내 손 입력으로 ────────────────────────────
  'hand>gun': {
    // 손가락 총구: 누르는 동안 손가락 자리에서 연사 ×2
    tick({ f, B }) {
      const h = f.holding;
      if (!h) return;
      const cd = Math.max(0.05, f.c.cooldownOf(B.id) * 0.5);
      if (!f.every(`hg:${B.id}`, cd)) return;
      const e = f.nearest(h.x, h.y, 170);
      if (e) f.shootAt(B, h.x, h.y, e);
      f.mark(h.x, h.y, 10, f.col(B), 0.12);
    },
  },
  'hand>turret': {
    // 조준 포격: 누르면 조준, 떼면 누른 시간만큼 포탄
    tick({ f, B }) {
      const h = f.holding;
      if (h && f.every(`ht:${B.id}`, 0.15)) f.mark(h.x, h.y, 50 - Math.min(30, (f.now() - h.t) * 25), f.col(B), 0.16);
    },
    release({ f, B }, x, y, held) {
      const n = Math.min(6, 1 + Math.floor(held / 0.3));
      const m = f.mount(B.id);
      for (let i = 0; i < n; i++) {
        const g = f.c.w.rng.range(0, Math.PI * 2);
        const r = f.c.w.rng.range(0, 40);
        f.later(i * 0.1, () => f.shell(B, m.x, m.y, x + Math.cos(g) * r, y + Math.sin(g) * r));
      }
    },
  },
  'hand>summon': {
    // 표식: 소환수 셋이 표식된 적만, 쓰러지면 셋 더
    press({ f, A, B }, x, y) {
      if (!f.every(`hs:${A.id}`, f.c.cooldownOf(A.id))) return;
      const e = f.nearest(x, y, 90);
      if (!e) return;
      f.st.set(`mark:${A.id}`, e);
      f.mark(e.x, e.y, 18, '#7dff9a', 2);
      for (let i = 0; i < 3; i++) f.unit(B, e.x + (i - 1) * 16, e.y + 22, 6, 1, e);
    },
    anyKill({ f, A, B }, e) {
      if (f.st.get(`mark:${A.id}`) !== e) return;
      f.st.delete(`mark:${A.id}`);
      for (let i = 0; i < 3; i++) f.unit(B, e.x + (i - 1) * 16, e.y, 6);
    },
  },
  'hand>magic': {
    // 결계: 세 곳을 이은 삼각형 안 적 모두에게
    press({ f, A, B }) {
      const pts = recent(f, 2.5, 3);
      if (pts.length < 3 || !f.every(`hm:${A.id}`, 1)) return;
      const [a, b, c] = pts;
      f.tether(a.x, a.y, b.x, b.y, 0.6, f.col(B), 0);
      f.tether(b.x, b.y, c.x, c.y, 0.6, f.col(B), 0);
      f.tether(c.x, c.y, a.x, a.y, 0.6, f.col(B), 0);
      const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
      const es = f.c.w.enemies.filter((e) => !e.dead && f.c.visible(e) && inTri(e, a, b, c));
      f.spellOn(B, es, f.spellDur(A, B, clamp(12000 / Math.max(3000, area), 0.4, 2)), f.root(A.id));
      f.presses.length = 0;
      f.did({ f, A, B });
    },
  },
  'hand>trap': {
    // 철조망: 두 곳 사이 함정 줄
    press({ f, A, B }) {
      const pts = recent(f, 1.5, 2);
      if (pts.length < 2 || !f.every(`htr:${A.id}`, 0.8)) return;
      const [a, b] = pts;
      const ttl = (f.p(B).ttl ?? 12) * 0.6;
      for (const p of along(a.x, a.y, b.x, b.y, 34, 8)) f.trap(B, p.x, p.y, ttl, 0.7, p.x, p.y - 20);
      f.tether(a.x, a.y, b.x, b.y, ttl, f.col(B), 0, null, null, 1);
      f.presses.length = 0;
    },
  },
  'hand>air': {
    // 폭격 경로: 연달아 탭한 자리를 따라 줄줄이
    press({ f, A, B }) {
      const key = `ha:${A.id}`;
      const n = f.count(key);
      f.later(0.6, () => {
        if (f.count(key, 0) !== n) return;
        const pts = recent(f, 2.5, 4);
        if (pts.length < 2) return;
        let i = 0;
        for (let s = 1; s < pts.length; s++) for (const p of along(pts[s - 1].x, pts[s - 1].y, pts[s].x, pts[s].y, 44, 4)) f.drop(B, p.x, p.y, 0.08 * i++, 0.8);
        f.presses.length = 0;
      });
    },
  },
  'hand>charge': {
    // 돌격 길 긋기: 첫 자리에서 둘째 자리 쪽으로
    press({ f, A, B }) {
      const pts = recent(f, 1.5, 2);
      if (pts.length < 2 || !f.every(`hc:${A.id}`, 0.8)) return;
      const [a, b] = pts;
      f.dash(B, a.x, a.y, angTo(a.x, a.y, b), 2.2);
      f.tether(a.x, a.y, b.x, b.y, 0.4, f.col(B), 0);
      f.presses.length = 0;
    },
  },
  'hand>sound': {
    // 박자: 0.4~0.8초 박자로 이어 치면 고리가 커진다
    press({ f, A, B }, x, y) {
      const pts = recent(f, 2, 2);
      let m = (f.st.get(`beat:${A.id}`) as number | undefined) ?? 1;
      if (pts.length === 2) {
        const dt = pts[1].t - pts[0].t;
        m = dt >= 0.4 && dt <= 0.8 ? Math.min(3, m * 1.4) : 1;
      } else m = 1;
      f.st.set(`beat:${A.id}`, m);
      const p = f.p(B);
      f.shock(x, y, 60 * m, (p.knock ?? 40) * m, 0.2 * m, f.dmg(B, m), f.col(B));
    },
  },
  'hand>spinner': {
    // 슬링: 누르면 손가락 둘레에 날, 떼면 몰린 쪽으로
    tick({ f, A, B }) {
      const h = f.holding;
      if (!h) return;
      const mine = (f.st.get(`sling:${A.id}`) as Actor[] | undefined) ?? [];
      if (mine.length < 5 && f.every(`hsp:${A.id}`, 0.4)) {
        const a = f.orbit(B, h.x, h.y, 26, 6, null, (mine.length / 5) * Math.PI * 2);
        if (a) mine.push(a);
        f.st.set(`sling:${A.id}`, mine);
      }
    },
    release({ f, A }, x, y) {
      const mine = (f.st.get(`sling:${A.id}`) as Actor[] | undefined) ?? [];
      const t = f.dense();
      for (const a of mine) {
        f.release2(a);
        const g = t ? angTo(x, y, t) + f.c.w.rng.range(-0.4, 0.4) : f.c.w.rng.range(0, Math.PI * 2);
        a.vx = Math.cos(g) * 300;
        a.vy = Math.sin(g) * 300;
        a.ttl = a.t + 3;
      }
      f.st.set(`sling:${A.id}`, []);
    },
  },
  'hand>field': {
    // 덧칠: 연달아 탭한 자리를 이어 장판 길
    press({ f, B }) {
      const pts = recent(f, 1.2, 2);
      if (pts.length < 2) return;
      const ttl = f.p(B).ttl ?? 3;
      for (const p of along(pts[0].x, pts[0].y, pts[1].x, pts[1].y, 36, 5)) f.zoneAt(B, p.x, p.y, 26, ttl);
    },
  },
  'hand>ray': {
    // 광선 벽: 두 곳 사이 3초, 오래 걸칠수록 세게
    press({ f, A, B }) {
      const pts = recent(f, 1.5, 2);
      if (pts.length < 2 || !f.every(`hr:${A.id}`, 0.8)) return;
      const [a, b] = pts;
      f.tether(a.x, a.y, b.x, b.y, 3, B.p.color ?? '#ff3cc8', f.dmg(B, 2.5), null, null, 4);
      f.presses.length = 0;
    },
  },
  'hand>throw': {
    // 튕김 경로: 지난 탭에서 지금 탭으로, 이을수록 세짐
    press({ f, A, B }, x, y) {
      const pts = recent(f, 1.5, 2);
      if (pts.length < 2) {
        f.setCount(`hth:${A.id}`, 0);
        return;
      }
      const n = f.count(`hth:${A.id}`);
      const mul = Math.pow(1.2, n);
      const a = pts[0];
      const t = f.c.lob('tossed', a.x, a.y, x, y, 520);
      if (t) {
        const p = f.p(B);
        t.p = p;
        t.emoji = p.emoji ?? B.emoji;
        t.dmg = f.dmg(B, mul);
        t.left = 0;
        t.hits = new Set();
        t.dir = 0;
      }
      for (const e of f.onSegment(a.x, a.y, x, y, 10)) f.c.hit(e, f.dmg(B, 0.5 * mul), {}, f.c.w.newChain(1));
    },
  },
  'hand>swarm': {
    // 벌집 두드리기: 같은 곳을 이어 칠수록 뭉쳐 커진다
    press({ f, A, B }, x, y) {
      const cur = f.st.get(`hive:${A.id}`) as Actor | undefined;
      if (cur && f.c.actors.includes(cur) && dist2(cur.x, cur.y, x, y) < 70 * 70) {
        cur.r = Math.min(cur.r * 1.3, 90);
        cur.n = Math.min(40, cur.n + 4);
        cur.ttl = cur.t + 3;
        f.ring(x, y, cur.r, f.col(B));
        return;
      }
      const a = f.cloud(B, x, y, 30, 3, 1, f.nearest(x, y, 80));
      if (a) f.st.set(`hive:${A.id}`, a);
    },
  },
  'hand>spirit': {
    // 혼 빙의: 탭한 자리 최근 처치의 혼이 혼탄으로
    press({ f, A, B }, x, y) {
      if (!f.every(`hsp2:${A.id}`, f.c.cooldownOf(A.id))) return;
      const t = f.now();
      const souls = f.deaths.filter((d) => t - d.t < 4 && dist2(d.x, d.y, x, y) < 130 * 130).slice(-5);
      const p = { ...f.p(B), homing: 6 };
      for (const d of souls) {
        const e = f.nearest(d.x, d.y, 220);
        if (e) f.shootAt(B, d.x, d.y, e, 1.5, p);
        f.ring(d.x, d.y, 10, p.color ?? '#b4a0ff');
      }
      if (souls.length) f.did({ f, A, B });
    },
  },

  // ── 총 + B: 총탄이 B 처럼 ──────────────────────────────────────
  'gun>hand': {
    // 모아 쏘기: 절반은 쌓고, 탭하면 쏟는다
    shot({ f, A }, a) {
      const n = f.count(`store:${A.id}`, 0);
      if (n < 30 && f.count(`par:${A.id}`) % 2 === 0) {
        a.ttl = 0;
        f.setCount(`store:${A.id}`, n + 1);
      }
    },
    press({ f, A }, x, y) {
      const n = f.count(`store:${A.id}`, 0);
      if (n <= 0) return;
      f.setCount(`store:${A.id}`, 0);
      const m = f.mount(A.id);
      const p = f.p(A);
      const k = Math.round(n * 1.5);
      for (let i = 0; i < k; i++) {
        const g = Math.atan2(y - m.y, x - m.x) + f.c.w.rng.range(-0.12, 0.12);
        const b = f.c.bullet(A.id, m.x, m.y, g, p, (p.dmg ?? 1) * f.c.D * f.c.dmgMul(A), 600, i * 0.02);
        void b;
      }
      f.mark(x, y, 22, '#ffffff', 0.5);
    },
    tick({ f, A }) {
      const n = f.count(`store:${A.id}`, 0);
      if (n > 0 && f.every(`storeviz:${A.id}`, 0.5)) {
        const m = f.mount(A.id);
        f.mark(m.x, m.y - 10, 6 + n * 0.5, '#ffffff', 0.5);
      }
    },
  },
  'gun>turret': {
    // 유탄: 맞은 자리가 터진다
    hit({ f, A, B }, e, x, y) {
      if (!f.every(`gt:${A.id}:${e.id}`, 0.3)) return;
      f.blast(x, y, 45, f.dmg(B, 0.35 * f.k(A)), f.col(B), f.p(B));
    },
  },
  'gun>summon': {
    // 전향탄: 쓰러뜨린 적이 아군으로
    kill({ f, B }, e) {
      f.ally(B, e.x, e.y);
    },
  },
  'gun>magic': {
    // 주문탄: 다섯 발째마다
    hit({ f, A, B }, e) {
      if (f.count(`gm:${A.id}`) % 5 !== 0) return;
      f.spellOn(B, [e], f.spellDur(A, B), f.root(A.id));
      f.did({ f, A, B });
    },
  },
  'gun>trap': {
    // 불발 지뢰: 빗나간 탄이 지뢰
    removed({ f, B }, a) {
      if (a.kind !== 'bullet' || (a.hits && a.hits.size > 0)) return;
      if (a.x < 8 || a.x > W - 8 || a.y < 30 || a.y > f.c.LINE - 20) return;
      if (f.of(B.id, 'trap').length >= 20) return;
      f.trap(B, a.x, a.y, 8, 0.8, a.x, a.y - 10);
    },
    shot({ f, A }, a) {
      // 세 발에 한 발은 흩어져 빗나가기 쉽게 (빗나간 탄이 지뢰가 되는 맛)
      if (f.count(`gtr:${A.id}`) % 3 !== 0) return;
      const g = Math.atan2(a.vy, a.vx) + f.c.w.rng.range(-0.35, 0.35);
      const sp = Math.hypot(a.vx, a.vy);
      a.vx = Math.cos(g) * sp;
      a.vy = Math.sin(g) * sp;
    },
  },
  'gun>air': {
    // 곡사: 솟았다 표적 위로 내리꽂힘
    shot({ f, A, B }, a) {
      const t = f.c.pickTarget('random', f.c.mountOf(A.id), f.c.rangeOf(A));
      if (!t) return;
      a.ttl = 0;
      f.did();
      const s = f.c.curSrc;
      f.c.curSrc = B.id;
      const d = f.c.add('faller', t.x + 10, t.y - 170, { tx: t.x, ty: t.y, ttl: 2, p: { ...f.p(B), size: 14 }, emoji: B.emoji, dmg: a.dmg * 1.3, r: 30 });
      f.c.curSrc = s;
      if (d) d.src = B.id;
    },
  },
  'gun>charge': {
    // 관통 가속
    shot(_x, a) {
      a.left = 99;
    },
    hit(x, _e, _px, _py, a) {
      if (!a || a.kind !== 'bullet') return;
      x.f.did(x);
      a.dmg *= 1.25;
      a.vx *= 1.1;
      a.vy *= 1.1;
    },
  },
  'gun>sound': {
    // 총구 충격파
    shot({ f, A, B }, a) {
      if (!f.every(`gs:${A.id}`, 0.3)) return;
      const m = f.mount(A.id);
      const g = Math.atan2(a.vy, a.vx);
      const p = f.p(B);
      for (const e of f.near(m.x, m.y, 110)) {
        let d = Math.atan2(e.y - m.y, e.x - m.x) - g;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) > 0.7 || e.def.boss) continue;
        f.c.push(e, m.x, m.y, p.knock ?? 50);
        e.held = Math.max(e.held, 0.3);
      }
      f.ring(m.x + Math.cos(g) * 30, m.y + Math.sin(g) * 30, 40, f.col(B), 0.25);
    },
  },
  'gun>spinner': {
    // 부메랑 탄: 끝에서 돌아오며 다시
    shot(_x, a) {
      a.left += 1;
    },
    removed({ f, A, B }, a) {
      if (a.kind !== 'bullet' || a.tag & TAG_RICO) return;
      if (!f.every(`gsp:${A.id}`, 0.08)) return;
      const m = f.mount(A.id);
      const d = Math.hypot(m.x - a.x, m.y - a.y);
      const b = f.c.bullet(B.id, a.x, a.y, Math.atan2(m.y - a.y, m.x - a.x), { ...(a.p ?? {}), pierce: 3, tracer: undefined }, a.dmg * 0.8, d, 0);
      if (b) b.tag |= TAG_RICO;
    },
  },
  'gun>field': {
    // 불길 탄도: 지나간 줄에 장판
    shot({ f }, a) {
      f.st.set(`from:${a.id}`, { x: a.x, y: a.y });
    },
    removed({ f, A, B }, a) {
      const o = f.st.get(`from:${a.id}`) as Pt | undefined;
      f.st.delete(`from:${a.id}`);
      if (!o || !f.every(`gf:${A.id}`, 0.2)) return;
      for (const p of along(o.x, o.y, a.x, a.y, 40, 5)) if (p.y < f.c.LINE - 10) f.zoneAt(B, p.x, p.y, 16, 1.5, 0.6);
    },
  },
  'gun>ray': {
    // 집중 사격: 같은 적에 계속 맞힐수록 굵어짐
    hit({ f, A, B }, e, _x, _y, a) {
      const key = `gr:${A.id}`;
      const last = f.st.get(key) as { id: number; n: number } | undefined;
      const n = last && last.id === e.id ? Math.min(13, last.n + 1) : 0;
      f.st.set(key, { id: e.id, n });
      if (n > 0 && a) {
        f.c.hit(e, a.dmg * 0.15 * n, {}, f.c.w.newChain(1));
        f.did();
      }
      if (n >= 3 && f.every(`grv:${A.id}`, 0.15)) {
        const m = f.mount(A.id);
        f.tether(m.x, m.y, e.x, e.y, 0.12, B.p.color ?? '#ff3cc8', 0, null, e, 1 + n * 0.2);
      }
    },
  },
  'gun>throw': {
    // 도탄: 맞고 다른 적으로 두 번
    hit({ f, B }, e, x, y, a) {
      if (!a || a.kind !== 'bullet' || a.tag & TAG_RICO) return;
      f.ricochet(x, y, e, a.dmg * 0.85, a.p ?? {}, 2, B.id);
    },
  },
  'gun>swarm': {
    // 벌레탄: 맞은 적에 벌레가 붙어 갉음
    hit({ f, A, B }, e) {
      f.infest(e, 1.5);
      if (f.every(`gsw:${A.id}:${e.id}`, 1.2) && f.of(B.id, 'swarm').length < 6) f.cloud(B, e.x, e.y, 12, 1.5, 0.5, e);
    },
  },
  'gun>spirit': {
    // 혼 탄창
    kill({ f, A }) {
      f.setCount(`soul:${A.id}`, Math.min(30, f.count(`soul:${A.id}`, 0) + 3));
    },
    shot({ f, A, B }, a) {
      const n = f.count(`soul:${A.id}`, 0);
      if (n <= 0) return;
      f.setCount(`soul:${A.id}`, n - 1);
      const p = { ...f.p(B), homing: 6 };
      const e = f.nearest(a.x, a.y, 300);
      if (e) f.shootAt(B, a.x, a.y, e, 1, p);
    },
  },

  // ── 포격 + B: 포탄이 B 처럼 ────────────────────────────────────
  'turret>hand': {
    // 지정 포격: 탭한 곳이 표적, 탭마다 한 발
    press({ f, A }, x, y) {
      f.st.set(`aim:${A.id}`, { x, y, until: f.now() + 3 });
      f.mark(x, y, 26, '#ffffff', 3);
      const m = f.mount(A.id);
      const p = f.p(A);
      const a = f.c.lob('thrown', m.x, m.y, x, y, p.speed ?? 480);
      if (a) {
        a.p = p;
        a.emoji = p.emoji ?? null;
        a.dmg = (p.dmg ?? 2) * f.c.D * f.c.dmgMul(A);
        a.src = A.id;
      }
    },
    shot({ f, A }, a) {
      const aim = f.st.get(`aim:${A.id}`) as { x: number; y: number; until: number } | undefined;
      if (!aim || aim.until < f.now()) return;
      const dur = a.ttl - 0.02;
      a.tx = aim.x + f.c.w.rng.range(-20, 20);
      a.ty = aim.y + f.c.w.rng.range(-20, 20);
      a.vx = (a.tx - a.x) / dur;
      a.vy = (a.ty - a.y) / dur;
    },
  },
  'turret>gun': {
    land({ f, B }, x, y) {
      f.radial(B, x, y - 30, 12, 0.9);
    },
  },
  'turret>summon': {
    // 강하 포드: 폭발 대신 소환수 셋
    land({ f, A, B }, x, y, a) {
      for (let i = 0; i < 3; i++) f.unit(B, x + (i - 1) * 18, y, 8);
      f.c.boom(x, y, 30, a.dmg * 0.4, {});
      f.ring(x, y, 30, '#7dff9a', 0.4);
      void A;
      return true;
    },
  },
  'turret>magic': {
    land({ f, A, B }, x, y, a) {
      f.spellAt(A, B, x, y, (a.p?.boom ?? 40) * 1.5);
      f.did({ f, A, B });
    },
  },
  'turret>trap': {
    land({ f, B }, x, y) {
      for (let i = 0; i < 5; i++) {
        const g = (i / 5) * Math.PI * 2;
        f.trap(B, x + Math.cos(g) * 46, y + Math.sin(g) * 46, 10, 0.8, x, y);
      }
    },
  },
  'turret>air': {
    land({ f, B }, x, y) {
      f.mark(x, y, 24, f.col(B), 1);
      f.drop(B, x, y, 0.7);
    },
  },
  'turret>charge': {
    // 굴림탄: 방어선 쪽으로 굴러 한 줄을
    land({ f, A, B }, x, y, a) {
      const ttl = Math.max(0.4, (f.c.LINE - y) / 200);
      const s = f.c.add('stamp', x, y, { vx: 0, vy: 200, dir: 1, ttl, p: { ...(a.p ?? {}), size: 22 }, emoji: a.emoji ?? A.emoji, dmg: f.dmg(B, 0.8), hits: true });
      void s;
    },
  },
  'turret>sound': {
    land({ f, B }, x, y, a) {
      const p = f.p(B);
      f.shock(x, y, (a.p?.boom ?? 40) * 2, (p.knock ?? 40) * 1.5, 0.6, 0, f.col(B));
    },
  },
  'turret>spinner': {
    land({ f, B }, x, y) {
      for (let i = 0; i < 4; i++) f.blade(B, x, y, (i / 4) * Math.PI * 2 + 0.4, 4, 0.8);
    },
  },
  'turret>field': {
    land({ f, B }, x, y, a) {
      f.zoneAt(B, x, y, (a.p?.boom ?? 40) * 1.2, f.p(B).ttl ?? 3);
    },
  },
  'turret>ray': {
    // 착탄 사슬: 최근 세 자리를 줄로
    land({ f, A, B }, x, y) {
      const key = `tr:${A.id}`;
      const pts = ((f.st.get(key) as (Pt & { t: number })[] | undefined) ?? []).filter((p) => f.now() - p.t < 3);
      for (const p of pts) f.tether(p.x, p.y, x, y, 3, B.p.color ?? '#9fe8ff', f.dmg(B, 0.8), null, null, 3);
      pts.push({ x, y, t: f.now() });
      f.st.set(key, pts.slice(-2));
    },
  },
  'turret>throw': {
    // 도약탄: 터진 뒤 두 번 더
    shot(x, a) {
      x.f.did(x);
      a.tag |= TAG_HOP;
      a.trail = 2;
    },
  },
  'turret>swarm': {
    land({ f, B }, x, y) {
      f.cloud(B, x, y, 50, 3);
    },
  },
  'turret>spirit': {
    kill({ f, A }) {
      f.setCount(`ts:${A.id}`, Math.min(10, f.count(`ts:${A.id}`, 0) + 1));
    },
    shot({ f, A }, a) {
      const n = f.count(`ts:${A.id}`, 0);
      if (n <= 0) return;
      f.setCount(`ts:${A.id}`, 0);
      a.p = { ...(a.p ?? {}), boom: (a.p?.boom ?? 40) * (1 + 0.1 * n), size: 20 + n };
      f.did();
      a.dmg *= 1 + 0.1 * n;
    },
  },

  // ── 소환수 + B: 소환수가 B 처럼 ────────────────────────────────
  'summon>hand': {
    // 지휘: 탭한 곳으로 몰려가 3초 피해 ×2
    press({ f, A }, x, y) {
      f.mark(x, y, 30, '#7dff9a', 1);
      for (const a of f.of(A.id, 'walker')) {
        const e = f.nearest(x, y, 140);
        if (!e) break;
        a.target = e;
        if (!(f.st.get(`rally:${a.id}`) as number | undefined)) {
          const base = a.dmg;
          a.dmg *= 2;
          f.st.set(`rally:${a.id}`, 1);
          f.later(3, () => {
            a.dmg = base;
            f.st.delete(`rally:${a.id}`);
          });
        }
      }
    },
  },
  'summon>gun': {
    tick({ f, A, B }) {
      const cd = f.c.cooldownOf(B.id);
      for (const a of f.of(A.id, 'walker')) {
        if (!f.every(`sg:${a.id}`, cd)) continue;
        const e = a.target && !a.target.dead ? a.target : f.nearest(a.x, a.y, 170);
        if (e) f.shootAt(B, a.x, a.y - 6, e);
      }
    },
  },
  'summon>turret': {
    tick({ f, A, B }) {
      const cd = f.c.cooldownOf(B.id);
      for (const a of f.of(A.id, 'walker')) {
        if (!f.every(`st:${a.id}`, cd)) continue;
        const e = a.target && !a.target.dead ? a.target : f.nearest(a.x, a.y, 220);
        if (e) f.shell(B, a.x, a.y - 6, e.x, e.y);
      }
    },
  },
  'summon>magic': {
    unitSpawn({ f, A, B }, a) {
      const k = f.spellKind(B);
      if (k === 'clone' && a.depth === 0) f.unit(A, a.x + 14, a.y, a.ttl);
      if (k === 'haste') a.p = { ...(a.p ?? {}), speed: (a.p?.speed ?? 100) * 2 };
    },
    tick({ f, A, B }) {
      const k = f.spellKind(B);
      if (k === 'clone' || k === 'haste') return;
      const cd = f.c.cooldownOf(B.id) * 0.5;
      for (const a of f.of(A.id, 'walker')) {
        if (!a.target || a.target.dead || !f.every(`sm:${a.id}`, cd)) continue;
        f.spellAt(A, B, a.target.x, a.target.y, 70);
        f.did({ f, A, B });
      }
    },
  },
  'summon>trap': {
    tick({ f, A, B }) {
      const cd = f.c.cooldownOf(B.id);
      for (const a of f.of(A.id, 'walker')) {
        if (!a.target || a.target.dead || !f.every(`str:${a.id}`, cd)) continue;
        const t = a.target;
        f.trap(B, (a.x + t.x) / 2, (a.y + t.y) / 2 + 10, 8, 1, a.x, a.y);
      }
    },
  },
  'summon>air': {
    // 강하병: 하늘에서 맡은 적 바로 위로
    unitSpawn({ f, B }, a) {
      const e = f.c.pickTarget('random', undefined, f.c.LINE - 40);
      if (!e) return;
      a.x = e.x;
      a.y = e.y + 4;
      a.target = e;
      a.t = -0.75;
      f.drop(B, e.x, e.y, 0, 0.8, 0.7);
    },
  },
  'summon>charge': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'walker')) {
        const t = a.target;
        if (!t || t.dead) continue;
        const key = `sc:${a.id}`;
        if (f.st.get(key) === t.id) continue;
        f.st.set(key, t.id);
        f.dash(B, a.x, a.y, angTo(a.x, a.y, t), 0.9, 0.8);
      }
    },
  },
  'summon>sound': {
    unitReach({ f, B }, a) {
      const p = f.p(B);
      f.shock(a.x, a.y, 70, p.knock ?? 40, 0.4, f.dmg(B, 0.4), f.col(B));
    },
  },
  'summon>spinner': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'walker')) {
        if (f.st.get(`ss:${a.id}`)) continue;
        f.st.set(`ss:${a.id}`, 1);
        f.orbit(B, a.x, a.y, 24, a.ttl - a.t, a, 0, 0.6);
        f.orbit(B, a.x, a.y, 24, a.ttl - a.t, a, Math.PI, 0.6);
      }
    },
  },
  'summon>field': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'walker')) if (f.every(`sf:${a.id}`, 0.5)) f.zoneAt(B, a.x, a.y + 4, 22, 1.5, 0.7);
    },
  },
  'summon>ray': {
    // 사슬 진형: 소환수끼리 줄
    tick({ f, A, B }) {
      if (!f.every(`sr:${A.id}`, 0.25)) return;
      const ws: Pt[] = [f.mount(A.id), ...f.of(A.id, 'walker')];
      for (let i = 1; i < ws.length; i++) {
        const a = ws[i - 1];
        const b = ws[i];
        if (dist2(a.x, a.y, b.x, b.y) > 260 * 260) continue;
        f.tether(a.x, a.y, b.x, b.y, 0.28, B.p.color ?? '#9fe8ff', f.dmg(B, 1.2), null, null, 2);
      }
    },
  },
  'summon>throw': {
    // 도약: 쓰러뜨리면 다음 적으로 뛰어 덮침
    kill({ f, A, B }, e, by0) {
      // 자폭 소환수는 터지고 없어서 가장 가까운 다른 소환수가 뛴다
      const by = by0 && by0.kind === 'walker' ? by0 : f.nearestOf(A.id, 'walker', e.x, e.y, 200);
      if (!by) return;
      const t = f.nearest(e.x, e.y, 200, e);
      if (!t) return;
      f.ring(by.x, by.y, 12, f.col(B));
      by.x = t.x;
      by.y = t.y + 6;
      by.target = t;
      by.ttl += 2;
      f.blast(t.x, t.y, 26, f.dmg(B, 0.5), f.col(B));
    },
  },
  'summon>swarm': {
    unitReach({ f }, _a, e) {
      f.infest(e, 2);
    },
    removed({ f, B }, a) {
      if (a.kind === 'walker') f.cloud(B, a.x, a.y, 40, 3);
    },
  },
  'summon>spirit': {
    // 혼 먹는 짐승: 처치마다 커짐
    kill({ f, A }, e, by0) {
      const by = by0 && by0.kind === 'walker' ? by0 : f.nearestOf(A.id, 'walker', e.x, e.y, 200);
      if (!by) return;
      by.dmg *= 1.2;
      by.p = { ...(by.p ?? {}), size: Math.min(48, (by.p?.size ?? 20) * 1.2) };
      by.trail++;
      if (by.trail === 5) {
        by.t = 0;
        f.ring(by.x, by.y, 30, '#b4a0ff', 0.5);
      }
    },
  },

  // ── 주문 + B: 주문이 B 처럼 ────────────────────────────────────
  'magic>hand': {
    // 손 시전: 다 차면 손에 쥐고, 탭한 곳에 크게
    tick({ f, A }) {
      const ready = (f.c.cooldowns.get(A.id) ?? 0) <= 0;
      if (ready && f.every(`mh:${A.id}`, 0.4)) {
        const m = f.mount(A.id);
        f.mark(m.x, m.y - 14, 12, '#c77dff', 0.4);
      }
    },
    press({ f, A }, x, y) {
      if ((f.c.cooldowns.get(A.id) ?? 0) > 0) return;
      f.c.cooldowns.set(A.id, f.c.cooldownOf(A.id));
      f.spellAt(A, A, x, y, 140, 3);
    },
  },
  'magic>gun': {
    // 주문 탄막: 마법진이 6초 사방으로
    cast({ f, A, B }, x, y, targets) {
      const until = f.now() + 6;
      const step = Math.max(0.12, f.c.cooldownOf(B.id) * 0.6);
      const fire = () => {
        if (f.now() > until) return;
        const t = targets.find((e) => !e.dead) ?? f.nearest(x, y, 220);
        if (t) f.shootAt(B, x, y, t);
        f.radial(B, x, y, 4, 0.6, 200);
        f.later(step, fire);
      };
      fire();
      f.mark(x, y, 26, f.col(B), 6);
      void A;
    },
  },
  'magic>turret': {
    cast({ f, B }, x, y, targets) {
      const ts = targets.length ? targets.slice(0, 8) : f.near(x, y, 140, 4);
      const m = f.mount(B.id);
      ts.forEach((e, i) => f.later(i * 0.12, () => !e.dead && f.shell(B, m.x, m.y, e.x, e.y)));
    },
  },
  'magic>summon': {
    cast({ f, B }, x, y, targets) {
      const ts = targets.length ? targets.slice(0, 6) : f.near(x, y, 160, 3);
      for (const e of ts) f.unit(B, x, y, 8, 1, e);
    },
  },
  'magic>trap': {
    cast({ f, B }, x, y, targets) {
      const ts = targets.length ? targets.slice(0, 8) : f.near(x, y, 140, 4);
      for (const e of ts) f.trap(B, e.x, e.y + 6, 8, 1, x, y);
    },
  },
  'magic>air': {
    cast({ f, B }, x, y, targets) {
      for (let i = 0; i < 12; i++) {
        const e = targets[i % Math.max(1, targets.length)];
        const tx = e && !e.dead ? e.x : x + f.c.w.rng.range(-80, 80);
        const ty = e && !e.dead ? e.y : y + f.c.w.rng.range(-60, 60);
        f.drop(B, tx, ty, i * 0.3, 0.8);
      }
      f.mark(x, y, 40, f.col(B), 4);
    },
  },
  'magic>charge': {
    cast({ f, B }, x, y, targets) {
      for (let i = 0; i < 4; i++) {
        const e = targets[i];
        const g = e ? angTo(x, y, e) : (i / 4) * Math.PI * 2;
        f.dash(B, x, y, g, 2);
      }
    },
  },
  'magic>sound': {
    cast({ f, A, B }, x, y) {
      f.shock(x, y, 220, 20, 0, 0, f.col(B));
      f.spellAt(A, A, x, y, 220, 0.6);
      void B;
    },
  },
  'magic>spinner': {
    cast({ f, A, B }, x, y) {
      for (let i = 0; i < 2; i++) {
        const s = f.blade(B, x, y, f.c.w.rng.range(0, Math.PI * 2), 4, 0.6);
        if (s) f.st.set(`spellsaw:${s.id}`, A.id);
      }
    },
  },
  'magic>field': {
    // 저주 자국: 걸린 적 발밑에 장판이 따라다님
    cast({ f, A, B }, _x, _y, targets) {
      const ts = targets.slice(0, 6);
      const until = f.now() + f.spellDur(A, A) + 2;
      const step = () => {
        if (f.now() > until) return;
        for (const e of ts) if (!e.dead) f.zoneAt(B, e.x, e.y, 22, 1.2, 0.7);
        f.later(0.5, step);
      };
      step();
    },
  },
  'magic>ray': {
    cast({ f, A, B }, _x, _y, targets) {
      const ts = targets.slice(0, 6);
      const dur = f.spellDur(A, A) + 1;
      for (let i = 1; i < ts.length; i++) f.tether(ts[i - 1].x, ts[i - 1].y, ts[i].x, ts[i].y, dur, B.p.color ?? '#9fe8ff', f.dmg(B, 0.3), ts[i - 1], ts[i], 2);
      f.share(ts, dur);
    },
  },
  'magic>throw': {
    // 옮는 주문: 걸린 적이 쓰러지면 다음 적에게
    cast({ f, A }, _x, _y, targets) {
      for (const e of targets) f.st.set(`curse:${e.id}`, { hops: 3, A: A.id });
    },
    anyKill({ f, A, B }, e) {
      const c = f.st.get(`curse:${e.id}`) as { hops: number; A: string } | undefined;
      if (!c || c.A !== A.id || c.hops <= 0) return;
      f.st.delete(`curse:${e.id}`);
      const t = f.nearest(e.x, e.y, 160, e);
      if (!t) return;
      f.tether(e.x, e.y, t.x, t.y, 0.3, '#c77dff', 0);
      f.hop(B, e.x, e.y, 1, 1.2, e);
      f.spellOn(A, [t], f.spellDur(A, A), f.root(A.id));
      f.st.set(`curse:${t.id}`, { hops: c.hops - 1, A: A.id });
    },
  },
  'magic>swarm': {
    cast({ f, A, B }, _x, _y, targets) {
      for (const e of targets.slice(0, 4)) f.cloud(B, e.x, e.y, 34, f.spellDur(A, A) + 1, 0.8, e);
    },
  },
  'magic>spirit': {
    anyKill({ f, A, B }, e) {
      if (!(e.poly > 0 || e.held > 0 || e.frozen > 0)) return;
      const left = f.c.cooldowns.get(A.id) ?? 0;
      f.c.cooldowns.set(A.id, left - 3);
      f.did();
      const m = f.mount(A.id);
      f.tether(e.x, e.y, m.x, m.y, 0.25, '#b4a0ff', 0);
      f.orb(B, e.x, e.y + 30, 3, 0.6);
    },
  },

  // ── 함정 + B: 함정이 B 처럼 ────────────────────────────────────
  'trap>hand': {
    // 원격 기폭
    press({ f, A }, x, y) {
      let n = 0;
      for (const a of f.of(A.id, 'trap')) {
        if (a.t < 0.45 || a.cd > 0 || dist2(a.x, a.y, x, y) > 120 * 120) continue;
        f.detonate(a);
        a.cd = 2;
        n++;
      }
      if (n) f.mark(x, y, 120, '#ffffff', 0.3);
    },
  },
  'trap>gun': {
    trigger({ f, B }, a) {
      f.radial(B, a.x, a.y, 12);
    },
  },
  'trap>turret': {
    trigger({ f, B }, a) {
      const ts = f.c.w.enemies.filter((e) => !e.dead && f.c.visible(e) && e.y < a.y - 30).sort((p, q) => dist2(p.x, p.y, a.x, a.y) - dist2(q.x, q.y, a.x, a.y)).slice(0, 3);
      for (const e of ts) f.shell(B, a.x, a.y, e.x, e.y);
    },
  },
  'trap>summon': {
    // 포획: 걸린 적이 아군으로
    trigger({ f, A, B }, a) {
      for (const e of f.near(a.x, a.y, Math.max(24, a.r * 0.6))) {
        if (e.def.boss || f.allies() >= V2.allyCap) continue;
        // 포획: 걸린 적을 거두고 그 자리에 아군으로 세운다
        f.c.hit(e, e.hp + 1, {}, f.c.w.newChain(1));
        f.ring(e.x, e.y, 18, '#ff6fb5', 0.5);
        f.ally(B, e.x, e.y, 8);
        f.did({ f, A, B });
      }
    },
  },
  'trap>magic': {
    trigger({ f, A, B }, a) {
      f.spellAt(A, B, a.x, a.y, 90);
      f.did({ f, A, B });
    },
  },
  'trap>air': {
    trigger({ f, B }, a) {
      for (let i = 0; i < 3; i++) f.drop(B, a.x + f.c.w.rng.range(-26, 26), a.y + f.c.w.rng.range(-26, 26), 0.25 + i * 0.2, 0.8);
    },
  },
  'trap>charge': {
    trigger({ f, B }, a) {
      f.dash(B, a.x, a.y, 0, 1.6);
      f.dash(B, a.x, a.y, Math.PI, 1.6);
    },
  },
  'trap>sound': {
    // 경보: 다른 함정 쪽으로 몰아붙임
    trigger({ f, A, B }, a) {
      const others = f.of(A.id, 'trap').filter((t) => t !== a && t.t > 0.45);
      for (const e of f.near(a.x, a.y, 140)) {
        if (e.def.boss) continue;
        let best: Actor | null = null;
        let bd = Infinity;
        for (const t of others) {
          const d = dist2(t.x, t.y, e.x, e.y);
          if (d < bd) {
            bd = d;
            best = t;
          }
        }
        if (best) f.c.push(e, e.x - (best.x - e.x), e.y - (best.y - e.y), 70);
        e.held = Math.max(e.held, 0.15);
      }
      f.ring(a.x, a.y, 140, f.col(B), 0.45);
    },
  },
  'trap>spinner': {
    trigger({ f, B }, a) {
      f.orbit(B, a.x, a.y, 28, 4, null, 0, 0.8);
    },
  },
  'trap>field': {
    trapPlace({ f, B }, a) {
      const p = f.p(B);
      f.later(0.45, () => f.zoneAt(B, a.tx, a.ty, (p.radius ?? 40) * 0.7, Math.min(8, a.ttl), 0.4));
    },
    trigger({ f, B }, a) {
      f.zoneAt(B, a.x, a.y, (f.p(B).radius ?? 40) * 1.4, 2.5);
    },
  },
  'trap>ray': {
    // 인계철선: 가까운 함정끼리 줄, 건드리면 이어진 함정이 전부
    tick({ f, A, B }) {
      if (!f.every(`tray:${A.id}`, 0.25)) return;
      const ts = f.of(A.id, 'trap').filter((t) => t.t > 0.45 && t.cd <= 0);
      for (let i = 0; i < ts.length; i++) {
        for (let j = i + 1; j < ts.length; j++) {
          const a = ts[i];
          const b = ts[j];
          if (dist2(a.x, a.y, b.x, b.y) > 150 * 150) continue;
          f.tether(a.x, a.y, b.x, b.y, 0.27, B.p.color ?? '#9fe8ff', 0, null, null, 1);
          if (f.onSegment(a.x, a.y, b.x, b.y, 4).length) {
            f.detonate(a);
            f.detonate(b);
            a.ttl = a.t;
            b.ttl = b.t;
          }
        }
      }
    },
  },
  'trap>throw': {
    // 도약 지뢰: 터진 뒤 다음 적 발밑으로 (세 번)
    trigger({ f }, a) {
      if (a.trail >= 3) return;
      const t = f.near(a.x, a.y, 220).find((e) => dist2(e.x, e.y, a.x, a.y) > 45 * 45);
      if (!t) return;
      a.trail++;
      a.left++;
      f.did();
      a.vx = a.x;
      a.vy = a.y;
      a.tx = t.x;
      a.ty = Math.min(f.c.LINE - 16, t.y + 40);
      a.ttl = a.ttl - a.t + 0.5;
      a.t = 0;
    },
  },
  'trap>swarm': {
    trigger({ f, B }, a) {
      f.cloud(B, a.x, a.y, 50, 3);
    },
  },
  'trap>spirit': {
    // 영혼 덫: 함정에서 죽은 적의 혼이 그 함정에
    kill({ f, A }, e) {
      let best: Actor | null = null;
      let bd = 110 * 110;
      for (const t of f.of(A.id, 'trap')) {
        const d = dist2(t.x, t.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
      if (!best) return;
      best.r = Math.min(best.r * 1.15, 90);
      best.left++;
      best.dmg *= 1.1;
      f.tether(e.x, e.y, best.x, best.y, 0.3, '#b4a0ff', 0);
    },
  },

  // ── 공중 + B: 낙하물이 B 처럼 ──────────────────────────────────
  'air>hand': {
    // 그림자 끌기
    press({ f, A }, x, y) {
      let best: Actor | null = null;
      let bd = 170 * 170;
      for (const a of f.of(A.id, 'faller')) {
        if (a.ty - a.y < 40) continue;
        const d = dist2(a.tx, a.ty, x, y);
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      if (!best) {
        // 떨어지는 것이 없는 공중 무기: 탭한 곳에 하나를 바로 부른다
        const p = f.p(A);
        const d = f.c.add('faller', x + 20, y - 220, { tx: x, ty: y, ttl: 3, p, emoji: A.emoji, dmg: (p.dmg ?? 3) * f.c.D * f.c.dmgMul(A), r: Math.max(30, (p.radius ?? 40) * 0.8) });
        if (d) d.src = A.id;
        f.mark(x, y, 22, '#ffffff', 0.6);
        return;
      }
      best.tx = x;
      best.ty = y;
      best.dmg *= 1.5;
      f.tether(best.tx, best.ty, x, y, 0.3, '#ffffff', 0);
      f.mark(x, y, 22, '#ffffff', 0.6);
    },
  },
  'air>gun': {
    // 떨어지는 것이 없는 공중 무기: 닿은 자리 위에서 아래로 한 번 쏟는다
    land({ f, B }, x, y, a) {
      if (a.kind === 'faller' || a.kind === 'thrown') return;
      for (const e of f.near(x, y, 120, 5)) f.shootAt(B, x + f.c.w.rng.range(-30, 30), y - 90, e, 0.8);
    },
    // 기총 소사: 떨어지는 동안 아래로
    tick({ f, A, B }) {
      const cd = Math.max(0.06, f.c.cooldownOf(B.id) * 0.5);
      for (const a of f.of(A.id, 'faller')) {
        if (a.ty - a.y < 30 || a.y < 0 || !f.every(`ag:${a.id}`, cd)) continue;
        const e = f.nearest(a.tx, a.ty, 120);
        if (e) f.shootAt(B, a.x, a.y, e, 0.8);
      }
    },
  },
  'air>turret': {
    land({ f, B }, x, y) {
      const ts = f.near(x, y, 200, 3);
      for (const e of ts) f.shell(B, x, y, e.x, e.y, 0.8);
    },
  },
  'air>summon': {
    land({ f, B }, x, y) {
      f.unit(B, x, y, 7);
    },
  },
  'air>magic': {
    land({ f, A, B }, x, y, a) {
      if (a.kind === 'faller' || a.kind === 'thrown') return;
      f.spellAt(A, B, x, y, Math.max(40, a.r));
      f.did();
    },
    // 하늘 낙인: 그림자 안 적은 떨어지기 전부터
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'faller')) {
        if (a.ty - a.y < 20) continue;
        const key = `am:${a.id}`;
        if (f.st.get(key)) continue;
        const es = f.near(a.tx, a.ty, Math.max(20, a.r * 0.6));
        if (!es.length) continue;
        f.st.set(key, 1);
        f.spellOn(B, es, f.spellDur(A, B), f.root(A.id));
        f.did({ f, A, B });
      }
    },
  },
  'air>trap': {
    land({ f, B }, x, y) {
      for (let i = 0; i < 3; i++) {
        const g = (i / 3) * Math.PI * 2;
        f.trap(B, x + Math.cos(g) * 30, y + Math.sin(g) * 30, 10, 0.8, x, y);
      }
    },
  },
  'air>charge': {
    land({ f, B }, x, y, a) {
      f.dash(B, x, y, a.vx >= 0 ? 0 : Math.PI, 1.4, 0.8, a.emoji ?? undefined);
    },
  },
  'air>sound': {
    land({ f, B }, x, y, a) {
      const p = f.p(B);
      f.shock(x, y, Math.max(50, a.r * 2), (p.knock ?? 40) * 1.5, 0.6, 0, f.col(B));
    },
  },
  'air>spinner': {
    // 통통: 바닥에 튕겨 세 번 더
    land({ f }, x, y, a) {
      const t = f.nearest(x, y, 120);
      if (!t) return;
      const b = f.c.lob('thrown', x, y, t.x, t.y, 300);
      if (b) {
        b.p = { ...(a.p ?? {}), boom: Math.max(24, a.r * 0.5) };
        b.emoji = a.emoji;
        b.dmg = a.dmg * 0.5;
        b.tag |= TAG_HOP;
        b.trail = 2;
      }
    },
  },
  'air>field': {
    // 그림자 장판
    tick({ f, A, B }) {
      if (!f.every(`af:${A.id}`, 0.25)) return;
      for (const a of f.of(A.id, 'faller')) {
        if (a.ty - a.y < 20) continue;
        for (const e of f.near(a.tx, a.ty, Math.max(20, a.r * 0.6))) f.c.hit(e, f.dmg(B, 0.25), {}, f.c.w.newChain(1));
      }
    },
    land({ f, B }, x, y, a) {
      f.zoneAt(B, x, y, Math.max(24, a.r * 0.8), f.p(B).ttl ?? 3, 0.7);
    },
  },
  'air>ray': {
    land({ f, A, B }, x, y) {
      f.mark(x, y, 10, B.p.color ?? '#ff3cc8', 3);
      const key = `ar:${A.id}`;
      const pts = ((f.st.get(key) as (Pt & { t: number })[] | undefined) ?? []).filter((p) => f.now() - p.t < 3);
      for (const p of pts.slice(-2)) f.tether(p.x, p.y, x, y, 3 - (f.now() - p.t), B.p.color ?? '#ff3cc8', f.dmg(B, 0.8), null, null, 3);
      pts.push({ x, y, t: f.now() });
      f.st.set(key, pts.slice(-3));
    },
  },
  'air>throw': {
    // 되튀는 폭격: 떨어진 것이 터진 뒤 다음 적 위로 (세 번까지)
    land({ f, A }, x, y, a) {
      if (a.tag & TAG_HOP) return;
      const t = f.nearest(x, y, 200);
      if (!t) return;
      const d = f.c.add('faller', t.x + 16, t.y - 160, { tx: t.x, ty: t.y, ttl: 3, p: a.p ?? f.p(A), emoji: a.emoji ?? A.emoji, dmg: (a.dmg || f.dmg(A)) * 0.8, r: Math.max(24, a.r * 0.8) });
      if (d) {
        d.tag |= TAG_HOP;
        d.trail = 1;
        d.src = A.id + '#';
      }
      f.did();
    },
  },
  'air>swarm': {
    land({ f, B }, x, y) {
      f.cloud(B, x, y, 50, 3);
    },
  },
  'air>spirit': {
    // 혼 운석: 혼 열 개마다 거대 운석
    kill({ f, A }) {
      const n = f.count(`as:${A.id}`);
      if (n % 10 !== 0) return;
      const t = f.dense();
      if (!t) return;
      const p = f.p(A);
      const a = f.c.add('faller', t.x + 30, -80, { tx: t.x, ty: t.y, ttl: 5, p: { ...p, size: 64 }, emoji: A.emoji, dmg: (p.dmg ?? 3) * f.c.D * f.c.dmgMul(A) * 4, r: 110 });
      if (a) a.src = A.id + '#';
    },
  },

  // ── 돌격 + B: 달리는 몸이 B 처럼 ───────────────────────────────
  'charge>hand': {
    // 핸들: 달리는 돌격을 탭한 쪽으로
    press({ f, A }, x, y) {
      for (const a of f.c.actors) {
        if (a.src !== A.id || !RUN.has(a.kind) || a.trail >= 2) continue;
        if (a.x < 0 || a.x > W) continue;
        const sp = Math.hypot(a.vx, a.vy) || 200;
        const g = Math.atan2(y - a.y, x - a.x);
        a.vx = Math.cos(g) * sp;
        a.vy = Math.sin(g) * sp;
        a.dir = a.vx >= 0 ? 1 : -1;
        a.dmg *= 1.2;
        a.trail++;
        a.hits?.clear();
        a.ttl = a.t + 2;
      }
      f.mark(x, y, 18, '#ffffff', 0.4);
    },
  },
  'charge>gun': {
    tick({ f, A, B }) {
      const cd = Math.max(0.08, f.c.cooldownOf(B.id) * 0.6);
      for (const a of f.of(A.id)) {
        if (!RUN.has(a.kind) || a.x < 0 || a.x > W || !f.every(`cg:${a.id}`, cd)) continue;
        for (const s of [-1, 1]) {
          const g = Math.atan2(a.vy, a.vx) + (s * Math.PI) / 2;
          const e = f.nearest(a.x + Math.cos(g) * 60, a.y + Math.sin(g) * 60, 90);
          f.bulletAt(B, a.x, a.y, e ? angTo(a.x, a.y, e) : g, 0.8, 200);
        }
      }
    },
  },
  'charge>turret': {
    move({ f, B }, a) {
      const e = f.nearest(a.x, a.y, 220);
      if (e) f.shell(B, a.x, a.y, e.x, e.y, 0.8);
    },
  },
  'charge>summon': {
    move({ f, B }, a) {
      f.unit(B, a.x, a.y, 6, 0.9);
    },
  },
  'charge>magic': {
    shot({ f, A, B }, a) {
      if (f.spellKind(B) !== 'clone' || a.depth > 0) return;
      const b = f.c.add(a.kind, a.x - Math.sign(a.vx || 1) * 40, a.y + 18, { vx: a.vx, vy: a.vy, dir: a.dir, ttl: a.ttl, p: a.p ?? undefined, emoji: a.emoji ?? undefined, dmg: a.dmg, hits: true, r: a.r });
      if (b) b.src = A.id;
    },
    move({ f, A, B }, a) {
      const es = f.near(a.x, a.y, 50);
      f.spellOn(B, es, f.spellDur(A, B, 0.6), f.root(A.id));
      if (es.length) f.did({ f, A, B });
    },
  },
  'charge>trap': {
    move({ f, B }, a) {
      f.trap(B, a.x, a.y, 10, 0.8, a.x, a.y - 10);
    },
  },
  'charge>air': {
    move({ f, B }, a) {
      f.drop(B, a.x, a.y, 0.3, 0.7);
    },
  },
  'charge>sound': {
    move({ f, B }, a) {
      const p = f.p(B);
      f.shock(a.x, a.y, 60, p.knock ?? 40, 0.4, f.dmg(B, 0.3), f.col(B));
    },
  },
  'charge>spinner': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id)) {
        if (!RUN.has(a.kind) || f.st.get(`cs:${a.id}`)) continue;
        f.st.set(`cs:${a.id}`, 1);
        f.orbit(B, a.x, a.y, 30, a.ttl + 3, a, 0, 0.8);
        f.orbit(B, a.x, a.y, 30, a.ttl + 3, a, Math.PI, 0.8);
      }
    },
  },
  'charge>field': {
    move({ f, B }, a) {
      f.zoneAt(B, a.x, a.y, 28, f.p(B).ttl ?? 3, 0.8);
    },
  },
  'charge>ray': {
    // 견인: 옆 적에 줄을 걸어 끌고 간다
    tick({ f, A, B }, dt) {
      for (const a of f.of(A.id)) {
        if (!RUN.has(a.kind) || a.x < 0 || a.x > W) continue;
        for (const e of f.near(a.x, a.y, 90, 3)) {
          if (e.def.boss) continue;
          if (f.every(`crc:${a.id}`, 1)) f.did();
          e.x += a.vx * 0.5 * dt;
          e.y += a.vy * 0.5 * dt;
          e.pack = null;
          if (f.every(`cr:${a.id}:${e.id}`, 0.25)) {
            f.c.hit(e, f.dmg(B, 0.3), {}, f.c.w.newChain(1));
            f.tether(a.x, a.y, e.x, e.y, 0.26, B.p.color ?? '#ff3cc8', 0, null, e, 2);
          }
        }
      }
    },
  },
  'charge>throw': {
    // 핀볼: 화면 끝에서 튕겨 두 번 더
    edge({ f }, a) {
      if (a.trail >= 2) return false;
      a.trail++;
      f.did();
      const W2 = f.c.w.field.width;
      const g = Math.atan2(a.vy, -a.vx) + f.c.w.rng.range(-0.5, 0.5);
      const sp = Math.hypot(a.vx, a.vy);
      a.x = clamp(a.x, 4, W2 - 4);
      a.y = clamp(a.y, 40, f.c.LINE - 10);
      a.vx = Math.cos(g) * sp;
      a.vy = Math.sin(g) * sp * 0.6;
      a.dir = a.vx >= 0 ? 1 : -1;
      a.hits?.clear();
      a.ttl = a.t + 3;
      f.ring(a.x, a.y, 20, '#ffd36b');
      return true;
    },
  },
  'charge>swarm': {
    move({ f, B }, a) {
      for (const e of f.near(a.x, a.y, 50)) f.infest(e, 2);
      f.cloud(B, a.x, a.y, 24, 2, 0.6);
    },
  },
  'charge>spirit': {
    kill({ f }, _e, by) {
      if (!by || !RUN.has(by.kind)) return;
      by.vx *= 1.1;
      by.vy *= 1.1;
      by.dmg *= 1.1;
      by.p = { ...(by.p ?? {}), size: Math.min(50, (by.p?.size ?? 22) + 2) };
      by.left++;
      f.did();
    },
    edge({ f }, a) {
      if (a.left < 5 || a.trail) return false;
      a.trail = 1;
      a.vx = -a.vx;
      a.dir = -a.dir;
      a.hits?.clear();
      a.ttl = a.t + 3;
      f.ring(a.x, a.y, 24, '#b4a0ff');
      return true;
    },
  },

  // ── 음파 + B: 고리가 B 처럼 ────────────────────────────────────
  'sound>hand': {
    // 붙잡은 고리: 누르는 동안 막고, 떼면 키워서
    tick({ f, A }) {
      const h = f.holding;
      if (!h) return;
      const m = f.mount(A.id);
      if (f.every(`shh:${A.id}`, 0.15)) f.mark(m.x, m.y, 30 + Math.min(1.5, f.now() - h.t) * 60, '#ffd36b', 0.16);
    },
    release({ f, A }, _x, _y, held) {
      const mul = Math.min(3, 1 + held * 1.4);
      const m = f.mount(A.id);
      const p = f.p(A);
      f.shock(m.x, m.y, f.c.rangeOf(A) * mul, (p.knock ?? 40) * mul, 0.3 * mul, f.dmg(A, mul), '#ffd36b');
      f.c.cooldowns.set(A.id, f.c.cooldownOf(A.id));
    },
  },
  'sound>gun': {
    pulse({ f, B }, x, y) {
      f.radial(B, x, y, 24, 0.8, 260);
    },
  },
  'sound>turret': {
    pulse({ f, B }, x, y) {
      const ts: Enemy[] = [];
      for (let i = 0; i < 3; i++) {
        const t = f.c.pickTarget(i === 0 ? 'dense' : 'random', undefined, f.c.LINE - 30);
        if (t) ts.push(t);
      }
      for (const e of ts) f.shell(B, x, y, e.x, e.y);
    },
  },
  'sound>summon': {
    // 징집 나팔: 맞은 적 수만큼 고리 끝에서
    pulse({ f, B }, x, y, r, hits) {
      for (const e of hits.filter((h) => !h.dead).slice(0, 4)) {
        const g = angTo(x, y, e);
        f.unit(B, x + Math.cos(g) * r * 0.8, y + Math.sin(g) * r * 0.8, 6, 1, e);
      }
    },
  },
  'sound>magic': {
    pulse({ f, A, B }, _x, _y, _r, hits) {
      f.spellOn(B, hits, f.spellDur(A, B, 0.7), f.root(A.id));
      if (hits.length) f.did({ f, A, B });
    },
  },
  'sound>trap': {
    pulse({ f, B }, x, y, _r, hits) {
      const ts = [...hits].sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y)).slice(0, 2);
      for (const e of ts) f.trap(B, e.x, e.y + 20, 10, 1, x, y);
    },
  },
  'sound>air': {
    pulse({ f, B }, _x, _y, _r, hits) {
      const ts = hits.length ? hits.slice(0, 3) : [f.dense(), f.c.pickTarget('random', undefined, f.c.LINE - 30)].filter((e): e is Enemy => !!e);
      for (const e of ts) f.drop(B, e.x, e.y, 0.1, 0.8);
    },
  },
  'sound>charge': {
    pulse({ f, B }, x, y, _r, hits) {
      for (const e of hits) f.fling(e, x, y, 140, f.dmg(B, 0.5));
      if (hits.length) f.did();
    },
  },
  'sound>spinner': {
    pulse({ f, B }, x, y, r) {
      for (let i = 0; i < 6; i++) f.orbit(B, x, y, r * 0.7, 2, null, (i / 6) * Math.PI * 2, 0.7);
    },
  },
  'sound>field': {
    pulse({ f, B }, x, y, r) {
      for (let i = 0; i < 6; i++) {
        const g = (i / 6) * Math.PI * 2;
        const py = y + Math.sin(g) * r * 0.85;
        if (py < f.c.LINE) f.zoneAt(B, x + Math.cos(g) * r * 0.85, py, 22, 2, 0.6);
      }
    },
  },
  'sound>ray': {
    pulse({ f, B }, x, y, _r, hits) {
      const hs = hits.filter((e) => !e.dead).slice(0, 8);
      if (hs.length) f.tether(x, y, hs[0].x, hs[0].y, 2, B.p.color ?? '#9fe8ff', f.dmg(B, 0.6), null, hs[0], 2);
      for (let i = 1; i < hs.length; i++) f.tether(hs[i - 1].x, hs[i - 1].y, hs[i].x, hs[i].y, 2, B.p.color ?? '#9fe8ff', f.dmg(B, 0.6), hs[i - 1], hs[i], 2);
    },
  },
  'sound>throw': {
    // 메아리: 맞은 적에서 작은 고리가 한 번 더
    pulse({ f, A, B }, _x, _y, _r, hits) {
      const p = f.p(A);
      hits.slice(0, 6).forEach((e, i) => f.later(0.12 + i * 0.03, () => !e.dead && f.shock(e.x, e.y, 46, (p.knock ?? 30) * 0.5, 0.15, f.dmg(B, 0.6), p.color ?? '#ffd36b')));
    },
  },
  'sound>swarm': {
    // 떼 고리: 고리 끝에 구름 고리
    pulse({ f, B }, x, y, r, hits) {
      for (const e of hits) f.infest(e, 1.5);
      for (let i = 0; i < 6; i++) {
        const g = (i / 6) * Math.PI * 2;
        const py = y + Math.sin(g) * r;
        if (py > f.c.LINE - 6) continue;
        const c = f.cloud(B, x + Math.cos(g) * r, py, 18, 2, 0.5);
        if (c) c.target = null;
      }
    },
  },
  'sound>spirit': {
    kill({ f, A }) {
      const n = Math.min(12, f.count(`ssp:${A.id}`));
      f.st.set(`range:${A.id}`, 1 + 0.08 * n);
      f.did();
    },
  },

  // ── 회전체 + B: 날이 B 처럼 ────────────────────────────────────
  'spinner>hand': {
    // 불러 모으기
    press({ f, A }, x, y) {
      for (const a of f.of(A.id, 'saw')) {
        if (a.tag & TAG_ORBIT) continue;
        f.st.set(`recall:${a.id}`, { x, y, until: f.now() + 1.6 });
        a.hits?.clear();
      }
      f.mark(x, y, 26, '#ffffff', 1.4);
    },
    tick({ f, A }, dt) {
      for (const a of f.of(A.id, 'saw')) {
        const r = f.st.get(`recall:${a.id}`) as { x: number; y: number; until: number } | undefined;
        if (!r) continue;
        if (r.until < f.now()) {
          f.st.delete(`recall:${a.id}`);
          const g = f.c.w.rng.range(0, Math.PI * 2);
          a.vx = Math.cos(g) * 260;
          a.vy = Math.sin(g) * 260;
          continue;
        }
        const d = Math.hypot(r.x - a.x, r.y - a.y);
        if (d > 24) {
          a.vx = ((r.x - a.x) / d) * 520;
          a.vy = ((r.y - a.y) / d) * 520;
        } else {
          const g = Math.atan2(a.y - r.y, a.x - r.x) + 6 * dt;
          a.x = r.x + Math.cos(g) * 24;
          a.y = r.y + Math.sin(g) * 24;
          a.vx = a.vy = 0;
        }
      }
    },
  },
  'spinner>gun': {
    tick({ f, A, B }) {
      const cd = f.c.cooldownOf(B.id) * 2;
      for (const a of f.of(A.id, 'saw')) {
        if (!f.every(`spg:${a.id}`, cd)) continue;
        const e = f.nearest(a.x, a.y, 180);
        if (e) f.shootAt(B, a.x, a.y, e, 0.8);
      }
    },
  },
  'spinner>turret': {
    bounce({ f, B }, a) {
      f.blast(a.x, a.y, 35, f.dmg(B, 0.4), f.col(B));
    },
    removed({ f, B }, a) {
      if (a.kind === 'saw') f.blast(a.x, a.y, 70, f.dmg(B, 0.9), f.col(B));
    },
  },
  'spinner>summon': {
    // 사냥매: 아무도 안 맡은 적을 쫓고, 쓰러뜨린 적은 아군
    tick({ f, A }, dt) {
      for (const a of f.of(A.id, 'saw')) {
        if (a.tag & TAG_ORBIT) continue;
        const claimed = new Set<number>();
        for (const o of f.c.actors) if (o.kind === 'walker' && o.target) claimed.add(o.target.id);
        const e = f.near(a.x, a.y, 260, 6).find((x) => !claimed.has(x.id));
        if (!e) continue;
        const sp = Math.hypot(a.vx, a.vy) || 260;
        const cur = Math.atan2(a.vy, a.vx);
        let d = angTo(a.x, a.y, e) - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const g = cur + clamp(d, -4 * dt, 4 * dt);
        a.vx = Math.cos(g) * sp;
        a.vy = Math.sin(g) * sp;
      }
    },
    removed({ f, B }, a) {
      if (a.kind === 'saw' && a.y < f.c.LINE - 10) f.unit(B, a.x, a.y, 6);
    },
  },
  'spinner>magic': {
    // 주문 궤적: 날이 지나간 자리가 1초 동안 주문 선
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'saw')) {
        if (!f.every(`spm:${a.id}`, 0.2)) continue;
        const prev = f.st.get(`spmp:${a.id}`) as Pt | undefined;
        f.st.set(`spmp:${a.id}`, { x: a.x, y: a.y });
        if (!prev) continue;
        f.tether(prev.x, prev.y, a.x, a.y, 1, '#c77dff', 0, null, null, 1.5);
        const es = f.onSegment(prev.x, prev.y, a.x, a.y, 8).filter((e) => f.every(`spme:${e.id}`, 1));
        if (es.length) f.spellOn(B, es, f.spellDur(A, B, 0.6), f.root(A.id));
      }
    },
  },
  'spinner>trap': {
    // 꽂히는 날: 수명이 끝나면 함정, 밟히면 날이 다시
    removed({ f, A, B }, a) {
      if (a.kind !== 'saw' || a.y > f.c.LINE - 12) return;
      const t = f.trap(B, a.x, a.y, 10, 1, a.x, a.y - 10);
      if (t) f.st.set(`tblade:${t.id}`, A);
    },
  },
  'spinner>air': {
    // 급강하 날: 벽에 튕길 때마다 몰린 곳에 내리꽂힘
    bounce({ f, B }, a) {
      if (!f.every(`spa:${a.id}`, 0.6)) return;
      const t = f.dense();
      if (!t) return;
      f.drop(B, t.x, t.y, 0, 0.8, 0.7, a.p?.emoji ?? undefined);
      f.ring(a.x, a.y, 14, f.col(B));
      a.x = t.x;
      a.y = t.y;
      a.t -= 0.3;
    },
  },
  'spinner>charge': {
    // 왕복 날: 화면을 일직선으로 꿰뚫고 돌아온다
    shot({ f }, a) {
      const sp = Math.hypot(a.vx, a.vy) * 1.5;
      const t = f.dense();
      a.vx = (a.vx >= 0 ? 1 : -1) * sp;
      a.vy = 0;
      if (t) {
        a.y = t.y;
        a.x = a.vx > 0 ? 12 : f.c.w.field.width - 12;
      }
      f.did();
    },
  },
  'spinner>sound': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'saw')) {
        if (!f.every(`sps:${a.id}`, 0.3)) continue;
        f.shock(a.x, a.y, 40, (f.p(B).knock ?? 30) * 0.5, 0.2, 0, f.col(B));
      }
    },
  },
  'spinner>field': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'saw')) if (a.y < f.c.LINE - 10 && f.every(`spf:${a.id}`, 0.25)) f.zoneAt(B, a.x, a.y, 16, 1.5, 0.6);
    },
  },
  'spinner>ray': {
    // 볼라: 날 둘씩 줄로
    tick({ f, A, B }) {
      if (!f.every(`spr:${A.id}`, 0.2)) return;
      const ss = f.of(A.id, 'saw');
      for (let i = 1; i < ss.length; i += 2) f.tether(ss[i - 1].x, ss[i - 1].y, ss[i].x, ss[i].y, 0.22, B.p.color ?? '#ff3cc8', f.dmg(B, 1), null, null, 2);
      if (ss.length === 1 && f.every(`spr1:${A.id}`, 0.6)) {
        const s = ss[0];
        f.blade(A, s.x, s.y, Math.atan2(-s.vy, -s.vx), s.ttl - s.t, 0.6);
      }
    },
  },
  'spinner>throw': {
    // 분열 날
    hit({ f, A }, _e, x, y, a) {
      if (!a || a.kind !== 'saw' || a.depth > 0) return;
      const n = f.count(`spt:${a.id}`);
      if (n > 4) return;
      f.blade(A, x, y, f.c.w.rng.range(0, Math.PI * 2), 2, 0.5, 220, { ...(a.p ?? {}) });
    },
  },
  'spinner>swarm': {
    hit({ f }, e) {
      f.infest(e, 1.5);
    },
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'saw')) if (f.every(`spw:${a.id}`, 0.6)) f.cloud(B, a.x, a.y, 18, 1, 0.4);
    },
  },
  'spinner>spirit': {
    // 영혼 날: 쓰러뜨릴 때마다 날이 하나 는다
    kill({ f, A }, e, by) {
      if (!by || by.kind !== 'saw' || f.of(A.id, 'saw').length >= 6) return;
      f.blade(A, e.x, e.y, f.c.w.rng.range(0, Math.PI * 2), Math.max(1, by.ttl - by.t), 1, undefined, { ...(by.p ?? {}) });
      f.ring(e.x, e.y, 16, '#b4a0ff');
    },
  },

  // ── 장판 + B: 장판이 B 처럼 ────────────────────────────────────
  'field>hand': {
    // 장판 옮기기
    press({ f, A }, x, y) {
      let best: Actor | null = null;
      let bd = Infinity;
      for (const z of f.of(A.id, 'fzone')) {
        const d = dist2(z.x, z.y, x, y);
        if (d < bd) {
          bd = d;
          best = z;
        }
      }
      if (!best) return;
      f.st.set(`slide:${best.id}`, { x, y });
      f.mark(x, y, best.r, '#ffffff', 0.6);
    },
    tick({ f, A, B }, dt) {
      for (const z of f.of(A.id, 'fzone')) {
        const to = f.st.get(`slide:${z.id}`) as Pt | undefined;
        if (!to) continue;
        const d = Math.hypot(to.x - z.x, to.y - z.y);
        const wz = f.c.w.zones.find((q) => Math.abs(q.x - z.x) < 1 && Math.abs(q.y - z.y) < 1);
        const step = Math.min(d, 260 * dt);
        const nx = z.x + ((to.x - z.x) / (d || 1)) * step;
        const ny = z.y + ((to.y - z.y) / (d || 1)) * step;
        if (wz) {
          wz.x = nx;
          wz.y = ny;
        }
        if (f.every(`slidez:${z.id}`, 0.12)) f.zoneAt(A, z.x, z.y, z.r * 0.5, 1, 0.5);
        z.x = nx;
        z.y = ny;
        if (d < 4) f.st.delete(`slide:${z.id}`);
        void B;
      }
    },
  },
  'field>gun': {
    zoneTick({ f, B }, _z, on) {
      for (const e of on.slice(0, 5)) {
        for (let i = 0; i < 3; i++) {
          const t = i === 0 ? e : f.nearest(e.x, e.y, 80, e) ?? e;
          f.shootAt(B, e.x + (i - 1) * 10, e.y + 26, t, 0.6);
        }
      }
    },
  },
  'field>turret': {
    // 폭발 바닥: 1초 버틴 적 자리가 터진다
    zoneTick({ f, B }, z, on) {
      const prev = (f.st.get(`ft:${z.id}`) as Set<number> | undefined) ?? new Set<number>();
      for (const e of on) if (prev.has(e.id)) f.blast(e.x, e.y, 40, f.dmg(B, 0.6), f.col(B));
      f.st.set(`ft:${z.id}`, new Set(on.map((e) => e.id)));
    },
  },
  'field>summon': {
    // 둥지 바닥: 깔린 동안 1.5초마다 한가운데서
    zoneTick({ f, B }, z, on) {
      if (!f.every(`fsu:${z.id}`, 1.4)) return;
      f.unit(B, z.x, z.y, 6, 1, on[0] ?? null);
    },
  },
  'field>magic': {
    zoneTick({ f, A, B }, _z, on) {
      f.spellOn(B, on, f.spellDur(A, B, 0.6), f.root(A.id));
      if (on.length) f.did({ f, A, B });
    },
  },
  'field>trap': {
    // 가시 테두리: 장판 가장자리에 함정
    zone({ f, B }, x, y, r, ttl) {
      for (let i = 0; i < 6; i++) {
        const g = (i / 6) * Math.PI * 2;
        f.trap(B, x + Math.cos(g) * r, y + Math.sin(g) * r, ttl, 0.6, x, y);
      }
    },
  },
  'field>air': {
    zoneTick({ f, B }, z, on) {
      const e = on[f.c.w.rng.int(Math.max(1, on.length))];
      f.drop(B, e ? e.x : z.x, e ? e.y : z.y, 0, 0.7, 0.6);
    },
  },
  'field>charge': {
    // 밀어내는 바닥: 장판 밖으로 튕겨 나가 부딪친다
    zoneTick({ f, B }, z, on) {
      for (const e of on) f.fling(e, z.x, z.y, 130, f.dmg(B, 0.4));
      if (on.length) f.did();
    },
  },
  'field>sound': {
    // 맥동: 가장자리 적을 안쪽으로
    zoneTick({ f, B }, z) {
      for (const e of f.near(z.x, z.y, z.r * 1.4)) {
        if (e.def.boss || dist2(e.x, e.y, z.x, z.y) < (z.r * 0.6) ** 2) continue;
        f.c.push(e, e.x + (e.x - z.x), e.y + (e.y - z.y), 70);
        e.held = Math.max(e.held, 0.2);
      }
      f.ring(z.x, z.y, z.r * 1.3, f.col(B), 0.4);
    },
  },
  'field>spinner': {
    // 구르는 장판
    zone({ f, A }, x, y, _r, ttl) {
      const z = f.of(A.id, 'fzone').find((q) => q.x === x && q.y === y);
      if (!z) return;
      z.ttl *= 1.5;
      const wz = f.c.w.zones.find((q) => Math.abs(q.x - x) < 1 && Math.abs(q.y - y) < 1);
      if (wz) wz.ttl = ttl * 1.5;
      const g = f.c.w.rng.range(0, Math.PI * 2);
      f.st.set(`roll:${z.id}`, { vx: Math.cos(g) * 70, vy: Math.sin(g) * 70 });
      f.did();
    },
    tick({ f, A }, dt) {
      for (const z of f.of(A.id, 'fzone')) {
        const v = f.st.get(`roll:${z.id}`) as { vx: number; vy: number } | undefined;
        if (!v) continue;
        const wz = f.c.w.zones.find((q) => Math.abs(q.x - z.x) < 1 && Math.abs(q.y - z.y) < 1);
        let nx = z.x + v.vx * dt;
        let ny = z.y + v.vy * dt;
        if (nx < 20 || nx > W - 20) v.vx = -v.vx;
        if (ny < 60 || ny > f.c.LINE - 30) v.vy = -v.vy;
        nx = clamp(nx, 20, W - 20);
        ny = clamp(ny, 60, f.c.LINE - 30);
        if (wz) {
          wz.x = nx;
          wz.y = ny;
        }
        z.x = nx;
        z.y = ny;
      }
    },
  },
  'field>ray': {
    tick({ f, A, B }) {
      if (!f.every(`fr:${A.id}`, 0.25)) return;
      const zs: Pt[] = [f.mount(A.id), ...f.of(A.id, 'fzone')];
      for (let i = 1; i < zs.length; i++) {
        if (dist2(zs[i - 1].x, zs[i - 1].y, zs[i].x, zs[i].y) > 320 * 320) continue;
        f.tether(zs[i - 1].x, zs[i - 1].y, zs[i].x, zs[i].y, 0.27, B.p.color ?? '#9fe8ff', f.dmg(B, 0.8), null, null, 3);
      }
    },
  },
  'field>throw': {
    kill({ f, A }, e) {
      for (const z of f.of(A.id, 'fzone')) {
        if (dist2(z.x, z.y, e.x, e.y) > z.r * z.r) continue;
        const g = (f.st.get(`gen:${z.id}`) as number | undefined) ?? 0;
        if (g >= 3) return;
        f.zoneAt(A, e.x, e.y, z.r * 0.6, 2, 0.8);
        f.tether(z.x, z.y, e.x, e.y, 0.3, f.col(A), 0);
        f.st.set(`gen:${z.id}`, g + 1);
        return;
      }
    },
  },
  'field>swarm': {
    zoneTick({ f, B }, z, on) {
      for (const e of on) f.infest(e, 1.2);
      if (on.length && f.every(`fsw:${z.id}`, 2)) f.cloud(B, z.x, z.y, z.r * 0.7, 1.5, 0.3);
    },
  },
  'field>spirit': {
    kill({ f, A }, e) {
      for (const z of f.of(A.id, 'fzone')) {
        if (dist2(z.x, z.y, e.x, e.y) > z.r * z.r) continue;
        const wz = f.c.w.zones.find((q) => Math.abs(q.x - z.x) < 1 && Math.abs(q.y - z.y) < 1);
        if (wz && wz.radius < 110) {
          wz.radius *= 1.15;
          wz.ttl *= 1.15;
        }
        z.r = Math.min(110, z.r * 1.15);
        z.ttl += 0.4;
        f.ring(z.x, z.y, z.r, '#b4a0ff', 0.4);
        return;
      }
    },
  },

  // ── 광선 + B: 줄기가 B 처럼 ────────────────────────────────────
  'ray>hand': {
    // 표적 고정
    press({ f, A }, x, y) {
      const e = f.nearest(x, y, 120);
      if (!e) return;
      f.st.set(`lock:${A.id}`, e);
      f.mark(e.x, e.y, 18, '#ffffff', 1);
      for (const a of f.of(A.id, 'ray')) a.target = e;
    },
    anyKill({ f, A }, e) {
      if (f.st.get(`lock:${A.id}`) !== e) return;
      const t = f.nearest(e.x, e.y, 200, e);
      if (!t) return;
      f.st.set(`lock:${A.id}`, t);
      for (const a of f.of(A.id, 'ray')) a.target = t;
    },
  },
  'ray>gun': {
    ray({ f, A, B }, a, t, ramp) {
      if (!f.every(`rg:${a.id}`, 0.5)) return;
      f.fan(B, t.x, t.y, 3, ramp * 0.6, t);
      void A;
    },
  },
  'ray>turret': {
    // 과부하: ×4 에 닿거나, ×2 넘게 붙어 있던 적이 쓰러지면 크게 터진다
    rayUp({ f, B }, a, t, lvl) {
      if (lvl < 8) return;
      f.blast(t.x, t.y, 70, f.dmg(B, 4), f.col(B), f.p(B));
      a.target = null;
      a.n = 0;
      a.left = 0;
    },
    kill({ f, B }, e, by) {
      if (!by || by.kind !== 'ray' || by.m < 1.5) return;
      f.blast(e.x, e.y, 70, f.dmg(B, by.m), f.col(B), f.p(B));
    },
  },
  'ray>summon': {
    // 조종 광선: ×1.5 부터 붙은 적을 2초 조종 (매혹)
    ray({ f, A, B }, a, t, ramp) {
      if (ramp < 1.5 || t.def.boss || t.charm > 0 || !f.every(`rsu:${a.id}`, 2.5)) return;
      if (f.allies() + f.charmed() >= V2.allyCap) return;
      t.charm = 2;
      t.pack = null;
      f.ring(t.x, t.y, 18, '#ff6fb5', 0.5);
      f.did({ f, A, B });
    },
  },
  'ray>magic': {
    ray({ f, A, B }, a, t, ramp) {
      if (ramp < 1.5 || !f.every(`rm:${a.id}`, 0.4)) return;
      f.spellOn(B, [t], 0.6, f.root(A.id));
      f.did({ f, A, B });
    },
  },
  'ray>trap': {
    kill({ f, B }, e, by) {
      const ramp = by && by.kind === 'ray' ? Math.max(1, by.m) : 1;
      f.trap(B, e.x, e.y, 12, ramp, e.x, e.y - 10);
    },
  },
  'ray>air': {
    rayUp({ f, B }, _a, t) {
      f.drop(B, t.x, t.y, 0, 0.8, 0.7);
    },
  },
  'ray>charge': {
    // 관통 광선: 붙은 적 뒤로 화면 끝까지
    ray({ f, B }, a, t, ramp) {
      if (!f.every(`rc:${a.id}`, 0.25)) return;
      const g = Math.atan2(t.y - a.y, t.x - a.x);
      const ex = t.x + Math.cos(g) * 600;
      const ey = t.y + Math.sin(g) * 600;
      f.tether(t.x, t.y, ex, ey, 0.26, B.p.color ?? a.emoji ?? '#ff3cc8', f.dmg(B, 0.25 * ramp * 4), null, null, 2);
    },
  },
  'ray>sound': {
    ray({ f, B }, a, t, ramp) {
      if (!f.every(`rs:${a.id}`, 0.5)) return;
      for (const e of f.near(t.x, t.y, 50 * Math.max(1, ramp / 2), 99, t)) {
        if (e.def.boss) continue;
        f.c.push(e, t.x, t.y, 30);
        e.held = Math.max(e.held, 0.2);
      }
      f.ring(t.x, t.y, 50 * Math.max(1, ramp / 2), f.col(B), 0.3);
    },
  },
  'ray>spinner': {
    ray({ f, B }, a, t, ramp) {
      if (!f.every(`rsp:${a.id}`, 0.25)) return;
      for (const e of f.near(t.x, t.y, 40, 99, t)) f.c.hit(e, f.dmg(B, 0.15 * ramp), {}, f.c.w.newChain(1));
      f.mark(t.x, t.y, 34, f.col(B), 0.26);
    },
  },
  'ray>field': {
    ray({ f, B }, a, t, ramp) {
      if (!f.every(`rf:${a.id}`, 0.5)) return;
      f.zoneAt(B, t.x, t.y, 14 * ramp, 1, 0.6);
    },
  },
  'ray>throw': {
    // 도약 광선: 쓰러지면 배율째 다음 적으로
    kill({ f }, e, by) {
      if (!by || by.kind !== 'ray' || by.trail >= 3) return;
      const t = f.nearest(e.x, e.y, 170, e);
      if (!t) return;
      const keep = by.n;
      by.target = t;
      by.trail++;
      f.later(0, () => {
        by.n = keep;
      });
      f.tether(e.x, e.y, t.x, t.y, 0.3, by.emoji ?? '#ff3cc8', 0);
    },
    rayRetarget(_x, a) {
      a.trail = 0;
    },
  },
  'ray>swarm': {
    rayUp({ f, B }, _a, t) {
      f.cloud(B, t.x, t.y, 36, 2, 0.6, t);
    },
  },
  'ray>spirit': {
    // 혼 증폭: 쓰러뜨린 혼이 다음 적의 시작 배율
    kill({ f }, _e, by) {
      if (!by || by.kind !== 'ray') return;
      f.st.set(`souls:${by.id}`, Math.min(4, ((f.st.get(`souls:${by.id}`) as number | undefined) ?? 0) + 1));
    },
    rayRetarget({ f }, a) {
      const s = (f.st.get(`souls:${a.id}`) as number | undefined) ?? 0;
      if (s > 0) {
        a.n = (0.5 * s) / 0.6;
        f.did();
      }
    },
  },

  // ── 투척 + B: 던진 것이 B 처럼 ─────────────────────────────────
  'throw>hand': {
    // 꺾기
    press({ f, A }, x, y) {
      for (const a of f.of(A.id, 'tossed')) {
        const left = Math.max(0.15, a.ttl - a.t);
        a.tx = x;
        a.ty = y;
        a.vx = (x - a.x) / left;
        a.vy = (y - a.y) / left;
        a.left += 1;
      }
      f.mark(x, y, 20, '#ffffff', 0.5);
    },
  },
  'throw>gun': {
    hit({ f, B }, _e, x, y) {
      f.radial(B, x, y, 6, 0.8, 160);
    },
  },
  'throw>turret': {
    hit({ f, B }, _e, x, y) {
      f.blast(x, y, 25, f.dmg(B, 0.3), f.col(B));
    },
    tossEnd({ f, B }, a) {
      f.blast(a.tx, a.ty, (f.p(B).boom ?? 40) * 2, f.dmg(B), f.col(B), f.p(B));
    },
  },
  'throw>summon': {
    tossEnd({ f, B }, a) {
      const n = Math.min(3, (a.hits?.size ?? 1));
      for (let i = 0; i < n; i++) f.unit(B, a.tx + (i - 1) * 14, a.ty, 7);
    },
  },
  'throw>magic': {
    // 주문 폭발: 마지막 튕김 자리에서 반경 90 에
    tossEnd({ f, A, B }, a) {
      const n = Math.max(1, a.hits?.size ?? 1);
      f.spellAt(A, B, a.tx, a.ty, 90, 0.5 + 0.3 * n);
      f.ring(a.tx, a.ty, 90, '#c77dff', 0.5);
      f.did({ f, A, B });
    },
  },
  'throw>trap': {
    hit({ f, B }, _e, x, y) {
      f.trap(B, x, y + 10, 10, 0.8, x, y);
    },
  },
  'throw>air': {
    // 높이 던지기: 첫 투척을 하늘에서
    shot({ f, A, B }, a) {
      if (a.depth > 0) return;
      a.ttl = 0;
      const p = f.p(B);
      const d = f.c.add('faller', a.tx + 20, a.ty - 220, { tx: a.tx, ty: a.ty, ttl: 3, p: { ...(a.p ?? {}), size: 22 }, emoji: a.emoji ?? A.emoji, dmg: f.dmg(B), r: Math.max(30, ((p.radius ?? 40) + (p.boom ?? 0)) * 0.6) });
      if (d) {
        d.src = A.id + '#';
        d.tag |= TAG_HOPTOSS;
        d.trail = a.left;
        f.st.set(`tosslook:${d.id}`, a.emoji ?? A.emoji);
      }
    },
  },
  'throw>charge': {
    // 굴리기: 튕기지 않고 굴러 한 줄을
    shot({ f, A }, a) {
      if (a.depth > 0) return;
      a.ttl = 0;
      const g = Math.atan2(a.ty - a.y, a.tx - a.x);
      const s = f.c.add('stamp', a.x, a.y, { vx: Math.cos(g) * 260, vy: Math.sin(g) * 260, dir: Math.cos(g) >= 0 ? 1 : -1, ttl: 2.2, p: { ...(a.p ?? {}), size: 14 }, emoji: a.emoji ?? A.emoji, dmg: a.dmg, hits: true });
      if (s) s.src = A.id + '#roll';
    },
    tick({ f, A }) {
      for (const s of f.c.actors) {
        if (s.src !== A.id + '#roll') continue;
        const n = s.hits?.size ?? 0;
        s.p = { ...(s.p ?? {}), size: Math.min(44, 14 + n * 5) };
        s.dmg = Math.max(s.dmg, s.dmg * (1 + n * 0.02));
      }
    },
  },
  'throw>sound': {
    hit({ f, B }, _e, x, y) {
      f.shock(x, y, 50, f.p(B).knock ?? 40, 0.3, 0, f.col(B));
    },
  },
  'throw>spinner': {
    // 부메랑: 끝나면 돌아오며 베고, 돌아오면 한 번 더 던짐
    tossEnd({ f, A, B }, a) {
      const m = f.mount(A.id);
      const g = Math.atan2(m.y - a.ty, m.x - a.tx);
      const d = Math.hypot(m.x - a.tx, m.y - a.ty);
      const s = f.blade(B, a.tx, a.ty, g, d / 320, 0.8, 320, { ...(a.p ?? {}), emoji: a.emoji ?? undefined });
      if (s) f.later(d / 320, () => f.c.fireAt(A, { x: m.x, y: m.y + 8, wall: 0 }, f.c.rangeOf(A)));
    },
  },
  'throw>field': {
    hit({ f, B }, _e, x, y) {
      f.zoneAt(B, x, y, 24, 2, 0.7);
    },
  },
  'throw>ray': {
    // 사슬 투척: 튕긴 자리끼리 빛 사슬
    hit({ f, B }, _e, x, y, a) {
      if (!a) return;
      const key = a.hits;
      const last = f.st.get(`tray:${a.src}:last`) as { k: unknown; x: number; y: number } | undefined;
      if (last && last.k === key) f.tether(last.x, last.y, x, y, 2, B.p.color ?? '#ff3cc8', f.dmg(B, 0.8), null, null, 2);
      f.st.set(`tray:${a.src}:last`, { k: key, x, y });
    },
  },
  'throw>swarm': {
    hit({ f, B }, e) {
      f.infest(e, 1.5);
      if (f.of(B.id, 'swarm').length < 5) f.cloud(B, e.x, e.y, 16, 2.5, 0.5, e);
    },
  },
  'throw>spirit': {
    kill({ f }, _e, by) {
      if (!by || by.kind !== 'tossed') return;
      by.left = Math.min(10, by.left + 1);
      f.did();
    },
  },

  // ── 떼 + B: 구름이 B 처럼 ──────────────────────────────────────
  'swarm>hand': {
    // 떼 부르기: 누르면 손가락으로, 떼면 크게 퍼짐
    tick({ f, A }, dt) {
      const h = f.holding;
      if (!h) return;
      for (const a of f.of(A.id, 'swarm')) {
        a.target = null;
        const d = Math.hypot(h.x - a.x, h.y - a.y);
        if (d > 4) {
          a.x += ((h.x - a.x) / d) * Math.min(d, 320 * dt);
          a.y += ((h.y - a.y) / d) * Math.min(d, 320 * dt);
        }
      }
    },
    release({ f, A }, x, y) {
      for (const a of f.of(A.id, 'swarm')) {
        if (dist2(a.x, a.y, x, y) > 60 * 60) continue;
        a.r = Math.min(a.r * 2, 120);
        a.n = Math.min(60, a.n * 2);
        a.ttl = a.t + 2;
      }
      f.ring(x, y, 60, f.col(A), 0.4);
    },
  },
  'swarm>gun': {
    cloud({ f, A, B }, a, under) {
      if (!f.every(`swg:${a.id}`, 1)) return;
      for (const e of under.slice(0, 3)) {
        for (let i = 0; i < 3; i++) {
          const g = f.c.w.rng.range(0, Math.PI * 2);
          const sx = a.x + Math.cos(g) * a.r;
          const sy = a.y + Math.sin(g) * a.r;
          f.shootAt(B, sx, sy, e, 0.6);
        }
      }
      void A;
    },
  },
  'swarm>turret': {
    cloud({ f, A }, a, under) {
      f.st.set(`swt:${a.id}`, under.length);
      void A;
    },
    removed({ f, B }, a) {
      if (a.kind !== 'swarm') return;
      const n = (f.st.get(`swt:${a.id}`) as number | undefined) ?? 0;
      f.blast(a.x, a.y, Math.max(30, a.r), f.dmg(B, 1 + n / 3), f.col(B), f.p(B));
    },
  },
  'swarm>summon': {
    // 떼 군단: 구름에서 하나씩 떨어져 나와 덮인 적을
    cloud({ f, B }, a, under) {
      if (!under.length || !f.every(`ssu:${a.id}`, 1.6 / (1 + a.r / 60))) return;
      f.unit(B, a.x, a.y, 5, 0.8, under[0]);
    },
  },
  'swarm>magic': {
    cloud({ f, A, B }, a, under) {
      if (!f.every(`swm:${a.id}`, 1)) return;
      f.spellOn(B, under, f.spellDur(A, B, 0.5), f.root(A.id));
      a.r = Math.min(a.r + 2 * under.length, 90);
      if (under.length) f.did({ f, A, B });
    },
  },
  'swarm>trap': {
    // 알 낳기
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'swarm')) {
        if (!f.every(`swtr:${a.id}`, 1)) continue;
        const t = f.trap(B, a.x, a.y + 8, 10, 0.6, a.x, a.y);
        if (t) f.st.set(`egg:${t.id}`, A);
      }
    },
  },
  'swarm>air': {
    // 떼 강하: 4초마다 몰린 무리에 내리꽂힘
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'swarm')) {
        if (a.t < 0.5 || !f.every(`swa:${a.id}`, 4)) continue;
        const t = f.dense();
        if (!t) continue;
        f.drop(B, t.x, t.y, 0, 0.8, 0.7, a.emoji ?? undefined);
        f.ring(a.x, a.y, a.r, f.col(B));
        a.x = t.x;
        a.y = t.y;
        a.target = t;
      }
    },
  },
  'swarm>charge': {
    // 행군: 한 줄로 가로지르며 덮는다
    tick({ f, A }, dt) {
      for (const a of f.of(A.id, 'swarm')) {
        let st = f.st.get(`march:${a.id}`) as { vx: number; y: number } | undefined;
        if (!st) {
          const t = f.dense();
          st = { vx: a.x < W / 2 ? 170 : -170, y: t ? t.y : a.y };
          f.st.set(`march:${a.id}`, st);
          a.x = st.vx > 0 ? 10 : W - 10;
        }
        a.target = null;
        if (f.every(`marchc:${a.id}`, 1)) f.did();
        a.x += st.vx * dt;
        a.y += (st.y - a.y) * Math.min(1, 4 * dt);
        if (a.x < 0 || a.x > W) st.vx = -st.vx;
        a.r = Math.max(a.r, 36);
      }
    },
  },
  'swarm>sound': {
    cloud({ f, B }, a, under) {
      if (!f.every(`sws:${a.id}`, 1)) return;
      for (const e of under) {
        if (e.def.boss) continue;
        e.x += (a.x - e.x) * 0.5;
        e.y += (a.y - e.y) * 0.5;
        e.pack = null;
      }
      f.ring(a.x, a.y, a.r, f.col(B), 0.3);
    },
  },
  'swarm>spinner': {
    tick({ f, A, B }, dt) {
      for (const a of f.of(A.id, 'swarm')) {
        for (const e of f.near(a.x, a.y, a.r)) {
          if (e.def.boss) continue;
          const g = Math.atan2(e.y - a.y, e.x - a.x) + 2.4 * dt;
          const d = Math.hypot(e.x - a.x, e.y - a.y);
          e.x = a.x + Math.cos(g) * d;
          e.y = a.y + Math.sin(g) * d;
          e.pack = null;
          if (f.every(`swsp:${a.id}:${e.id}`, 0.4)) {
            f.c.hit(e, f.dmg(B, 0.3), {}, f.c.w.newChain(1));
            f.did();
          }
        }
      }
    },
  },
  'swarm>field': {
    tick({ f, A, B }) {
      for (const a of f.of(A.id, 'swarm')) if (f.every(`swf:${a.id}`, 0.5)) f.zoneAt(B, a.x, a.y, a.r * 0.6, 2, 0.6);
    },
  },
  'swarm>ray': {
    cloud({ f, B }, a, under) {
      if (!f.every(`swr:${a.id}`, 1)) return;
      const es = under.filter((e) => !e.dead).slice(0, 8);
      for (let i = 1; i < es.length; i++) f.tether(es[i - 1].x, es[i - 1].y, es[i].x, es[i].y, 1, B.p.color ?? '#9fe8ff', f.dmg(B, 0.8), es[i - 1], es[i], 2);
    },
  },
  'swarm>throw': {
    // 번식: 쓰러지면 다음 무리로 옮겨 붙으며 갈라진다
    kill({ f, A }, e, by) {
      if (!by || by.kind !== 'swarm' || f.of(A.id, 'swarm').length >= 4) return;
      const t = f.nearest(e.x, e.y, 220, e);
      const p = f.p(A);
      const a = f.c.add('swarm', e.x, e.y, { ttl: 3, p, emoji: by.emoji ?? undefined, dmg: by.dmg, r: by.r * 0.8, n: Math.max(6, Math.round(by.n * 0.7)) });
      if (a) {
        a.src = A.id;
        a.target = t;
      }
    },
  },
  'swarm>spirit': {
    kill({ f }, _e, by) {
      if (!by || by.kind !== 'swarm') return;
      const base = (f.st.get(`base:${by.id}`) as number | undefined) ?? by.r;
      f.st.set(`base:${by.id}`, base);
      by.r = Math.min(base * 2, by.r * 1.1);
      f.did();
      by.n = Math.min(50, by.n + 2);
      by.ttl += 1;
    },
  },

  // ── 정령 + B: 정령이 B 처럼 ────────────────────────────────────
  'spirit>hand': {
    // 수동 기폭
    press({ f, A }, x, y) {
      let best: Actor | null = null;
      for (const d of f.of(A.id, 'drone')) if (d.left >= 5 && (!best || d.left > best.left)) best = d;
      if (!best) return;
      const n = best.left * 2;
      best.left = 0;
      const p = f.p(A);
      for (let i = 0; i < n; i++) f.c.bullet(A.id, x, y, (i / n) * Math.PI * 2, { ...p, pierce: (p.pierce ?? 0) + 1 }, best.dmg * 2.5, 240, 0);
      f.tether(best.x, best.y, x, y, 0.3, p.color ?? '#b4a0ff', 0);
      f.ring(x, y, 50, p.color ?? '#b4a0ff', 0.5);
    },
  },
  'spirit>gun': {
    burst({ f, B }, d) {
      f.radial(B, d.x, d.y, 32, 1.2, 320);
      return true;
    },
  },
  'spirit>turret': {
    burst({ f, B }, d) {
      const ts: Enemy[] = [];
      for (let i = 0; i < 3; i++) {
        const t = f.c.pickTarget(i === 0 ? 'dense' : 'random', undefined, f.c.LINE - 30);
        if (t) ts.push(t);
      }
      for (const t of ts) f.shell(B, d.x, d.y, t.x, t.y, 1.5);
      return ts.length > 0;
    },
  },
  'spirit>summon': {
    hit({ f, B }, _e, x, y, a) {
      if (!a || !(a.tag & TAG_BURSTB) || f.count(`ssum:${a.src}:${Math.floor(f.now())}`) > 6) return;
      f.unit(B, x, y, 6);
    },
  },
  'spirit>magic': {
    burst({ f, A, B }) {
      const es = f.c.w.enemies.filter((e) => !e.dead && f.c.visible(e));
      f.spellOn(B, es, f.spellDur(A, B, 0.5), f.root(A.id));
      f.did({ f, A, B });
    },
  },
  'spirit>trap': {
    // 혼 지뢰: 처치한 자리에 혼 함정, 정령이 터질 때 함께
    anyKill({ f, A, B }, e) {
      if (!f.of(A.id, 'drone').length || f.of(B.id, 'trap').length >= 12) return;
      const t = f.trap(B, e.x, e.y, 15, 0.7, e.x, e.y - 10);
      if (t) t.emoji = '👻';
    },
    burst({ f, B }) {
      for (const t of f.of(B.id, 'trap')) if (t.t > 0.45) f.detonate(t);
    },
  },
  'spirit>air': {
    burst({ f, B }) {
      for (let i = 0; i < 16; i++) {
        const t = f.c.pickTarget(i % 3 === 0 ? 'dense' : 'random', undefined, f.c.LINE - 30);
        if (t) f.drop(B, t.x, t.y, i * 0.08, 0.8, 0.6);
      }
      return true;
    },
  },
  'spirit>charge': {
    burst({ f, B }, d) {
      f.dash(B, d.x, d.y, 0, 2, 1.5);
      f.dash(B, d.x, d.y, Math.PI, 2, 1.5);
    },
  },
  'spirit>sound': {
    soul({ f, B }, d) {
      f.shock(d.x, d.y, 40, (f.p(B).knock ?? 30) * 0.5, 0.1, 0, f.col(B));
    },
    burst({ f, B }, d) {
      f.shock(d.x, d.y, 140, (f.p(B).knock ?? 40) * 1.5, 0.5, f.dmg(B), f.col(B));
    },
  },
  'spirit>spinner': {
    soul({ f, B }, d) {
      if (d.left % 5 !== 0 || f.of(B.id, 'saw').filter((s) => s.tag & TAG_ORBIT).length >= 4) return;
      const a = f.orbit(B, d.x, d.y, 26, 30, d, f.c.w.rng.range(0, 6), 0.7);
      void a;
    },
    burst({ f, B }) {
      for (const s of f.of(B.id, 'saw')) {
        if (!(s.tag & TAG_ORBIT)) continue;
        f.release2(s);
        const g = f.c.w.rng.range(0, Math.PI * 2);
        s.vx = Math.cos(g) * 280;
        s.vy = Math.sin(g) * 280;
        s.ttl = s.t + 4;
      }
    },
  },
  'spirit>field': {
    burst({ f, B }, d) {
      f.zoneAt(B, d.x, d.y, 100, 4);
    },
  },
  'spirit>ray': {
    // 혼 줄기: 정령과 가장 단단한 적, 혼이 쌓일수록
    tick({ f, A, B }) {
      for (const d of f.of(A.id, 'drone')) {
        if (!f.every(`spr:${d.id}`, 0.2)) continue;
        const t = f.strong();
        if (!t) continue;
        const m = 1 + 3 * Math.min(1, d.left / 10);
        f.c.hit(t, f.dmg(B, 0.12 * m), {}, f.c.w.newChain(1));
        f.tether(d.x, d.y, t.x, t.y, 0.22, B.p.color ?? '#ff3cc8', 0, t, null, 1 + m * 0.6);
      }
    },
  },
  'spirit>throw': {
    hit({ f, B }, e, x, y, a) {
      if (!a || !(a.tag & TAG_BURSTB)) return;
      f.ricochet(x, y, e, a.dmg * 0.8, a.p ?? {}, 2, B.id);
    },
  },
  'spirit>swarm': {
    tick({ f, A, B }) {
      if (!f.every(`spsw:${A.id}`, 0.15)) return;
      for (const s of f.c.actors) {
        if (s.kind !== 'soul') continue;
        for (const e of f.near(s.x, s.y, 16)) f.infest(e, 1.2);
        if (f.every(`spsws:${s.id}`, 10)) f.cloud(B, s.x, s.y, 14, 0.8, 0.3);
      }
      void A;
    },
  },
};

/** 규칙이 몇 개 구현돼 있나 (검증) */
export const FUSION_RULES = Object.keys(RULES);
