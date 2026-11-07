import { BALANCE } from '../data/balance';
import { CHAOS_EVENTS, type ChaosEventId, type InstallId } from '../data/chaos';
import { clamp, dist2 } from '../core/math';
import type { Shot } from './exp';
import type { Enemy } from './types';
import type { World } from './World';

/**
 * 도파민 모드 (data/chaos.ts): 난입 이벤트 + 설치물 + 피버 + 황금 쿠키.
 * 전부 "물체(Actor)"로 움직이고, 피해는 연쇄 단계 1짜리 폭발로 준다 → 폭발형·폭약 붙은 적은 터지고,
 * 더 깊은 연쇄는 여전히 탭 몫이다.
 */

export type ActorKind =
  | 'meteor' | 'dino' | 'cow' | 'ufo' | 'plane' | 'bomb' | 'cannon' | 'shell' | 'sheep' | 'banana' | 'bananaBit'
  | 'donkey' | 'train' | 'dragon' | 'tornado' | 'slot' | 'cookie' | 'soldier' | 'fireball' | 'laser';

export interface Actor {
  id: number;
  kind: ActorKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 나온 뒤 지난 시간, 수명 */
  t: number;
  ttl: number;
  /** 목표 지점 (포탄·운석·바나나) / 출발 지점 (포물선 그리기용) */
  tx: number;
  ty: number;
  sx: number;
  sy: number;
  /** 남은 발사 수, 튕긴 횟수 등 */
  n: number;
  /** 보는 방향 (-1 왼쪽, 1 오른쪽) */
  dir: number;
  /** 곱하기 게이트를 이미 지났나 */
  gated: boolean;
  /** 이미 짓밟은 적 (공룡·소·기차) */
  hits: Set<number> | null;
  /** UFO·토네이도가 붙잡은 적 */
  grabbed: Enemy[] | null;
  /** 잭팟 결과 그림 */
  reels: string[] | null;
}

type Buff = 'frenzy' | 'clickFrenzy' | 'lucky' | 'meteor';

const TRAMPLE_R = 18;
const PROJECTILE_KINDS: ReadonlySet<ActorKind> = new Set(['shell', 'fireball', 'soldier', 'sheep', 'bananaBit']);
const SLOT_EMOJI = ['🦖', '🐄', '☄️', '🛸', '🐑', '🍌', '7️⃣'];

export class Chaos {
  readonly actors: Actor[] = [];
  /** 지금 화면에 있는 곱하기 게이트 (없으면 null) */
  gate: { x: number; y: number; w: number; mult: number } | null = null;
  fever = 0;
  private feverCooldown = 0;
  heat = 0;
  frenzy = 0;
  clickFrenzy = 0;
  /** 다음 난입까지 */
  eventTimer: number;
  events = 0;
  private nextId = 1;
  private readonly timers = new Map<InstallId, number>();
  private cannonSide = 1;

  constructor(private readonly w: World) {
    this.eventTimer = BALANCE.chaos.firstEventSec;
  }

  private get D(): number {
    return this.w.stats.tapDamage;
  }

  // ─── 탭 ────────────────────────────────────────────────

  /** 황금 쿠키를 눌렀으면 그 탭은 쿠키 몫 */
  tryPickup(x: number, y: number): boolean {
    const C = BALANCE.chaos;
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      if (a.kind !== 'cookie') continue;
      if (dist2(a.x, a.y, x, y) > C.cookieRadius * C.cookieRadius) continue;
      this.actors.splice(i, 1);
      const buffs: Buff[] = ['frenzy', 'clickFrenzy', 'lucky', 'meteor'];
      const buff = buffs[this.w.rng.int(buffs.length)];
      if (buff === 'frenzy') this.frenzy = C.frenzySec;
      else if (buff === 'clickFrenzy') this.clickFrenzy = C.clickFrenzySec;
      else if (buff === 'lucky') this.w.goldenReward();
      else this.startEvent('meteor', true);
      this.w.emit({ type: 'cookie', x: a.x, y: a.y, buff });
      return true;
    }
    return false;
  }

  /** 피버·프렌지는 탭을 키우고, 클릭 프렌지는 쏘자마자 게이지를 채운다 */
  onFire(s: Shot): void {
    const C = BALANCE.chaos;
    if (this.fever > 0) {
      s.damage *= C.feverDamage;
      s.radius *= C.feverRadius;
      if (s.depth > 0) s.depth++;
    }
    if (this.frenzy > 0) s.damage *= C.frenzyDamage;
    if (this.clickFrenzy > 0) s.gaugeAfter = 1;
  }

  gaugeRateMul(): number {
    return this.fever > 0 ? BALANCE.chaos.feverGauge : 1;
  }

  onKill(_e: Enemy): void {
    this.heat++;
  }

  // ─── 매 스텝 ───────────────────────────────────────────

  update(dt: number): void {
    const C = BALANCE.chaos;
    const w = this.w;
    this.heat *= Math.pow(0.5, dt / C.heatHalfSec);
    this.frenzy = Math.max(0, this.frenzy - dt);
    this.clickFrenzy = Math.max(0, this.clickFrenzy - dt);
    if (this.fever > 0) {
      this.fever -= dt;
      if (this.fever <= 0) {
        this.fever = 0;
        w.emit({ type: 'fever', on: false });
      }
    } else {
      this.feverCooldown = Math.max(0, this.feverCooldown - dt);
      if (this.heat >= C.feverThreshold && this.feverCooldown <= 0) {
        this.fever = C.feverSec;
        this.feverCooldown = C.feverCooldownSec + C.feverSec;
        w.emit({ type: 'fever', on: true });
      }
    }

    if (!w.config.sandbox) {
      this.eventTimer -= dt;
      if (this.eventTimer <= 0) {
        this.eventTimer = this.interval();
        this.randomEvent();
        if (w.wave >= C.doubleFromWave && w.rng.chance(C.doubleChance)) this.randomEvent();
      }
    }
    this.updateInstalls(dt);
    this.updateGate(dt);
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      a.t += dt;
      if (!this.step(a, dt) || a.t >= a.ttl) this.actors.splice(i, 1);
    }
  }

  private interval(): number {
    const C = BALANCE.chaos;
    const base = Math.max(C.intervalMin, C.intervalBase - C.intervalPerWave * (this.w.wave - 1));
    return base / (1 + 0.3 * this.w.augments.stacks('chaos_luck'));
  }

  private randomEvent(): void {
    const pool = CHAOS_EVENTS.filter((e) => e.fromWave <= this.w.wave);
    const ev = this.w.rng.weighted(pool, (e) => e.weight);
    if (ev) this.startEvent(ev.id);
  }

  // ─── 난입 시작 ─────────────────────────────────────────

  startEvent(id: ChaosEventId, quiet = false): void {
    const w = this.w;
    const rng = w.rng;
    const W = w.field.width;
    const LINE = w.field.defenseLineY;
    const spot = this.densest(60);
    this.events++;
    if (!quiet) w.emit({ type: 'chaos', id, x: spot.x, y: spot.y });
    switch (id) {
      case 'meteor':
        for (let i = 0; i < 7; i++) {
          const t = this.randomTarget();
          this.add('meteor', t.x + 90, -40 - i * 70, { tx: t.x, ty: t.y, vx: -90 * 2.2, vy: 0, ttl: 4 });
        }
        break;
      case 'sheep':
        for (let i = 0; i < 5; i++) this.add('sheep', 40 + (i * (W - 80)) / 4, LINE - 6, { ttl: 8 });
        break;
      case 'banana':
        this.add('banana', W / 2, LINE, { tx: spot.x, ty: spot.y, ttl: 0.6 });
        break;
      case 'airstrike': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('plane', dir > 0 ? -40 : W + 40, 40, { vx: 260 * dir, dir, ty: spot.y, ttl: 2.2 });
        break;
      }
      case 'cookie':
        this.add('cookie', rng.range(50, W - 50), rng.range(140, LINE - 140), { ttl: BALANCE.chaos.cookieSec });
        break;
      case 'dino': {
        const dir = rng.chance(0.5) ? 1 : -1;
        for (let i = 0; i < 5; i++) {
          this.add('dino', dir > 0 ? -30 - i * 45 : W + 30 + i * 45, clamp(spot.y + rng.range(-50, 50), 60, LINE - 30), { vx: 230 * dir, dir, ttl: 4, hits: true });
        }
        break;
      }
      case 'cows':
        for (let i = 0; i < 6; i++) this.add('cow', 30 + (i * (W - 60)) / 5, LINE + 10 + i * 18, { vy: -240, ttl: 4, hits: true });
        break;
      case 'cannons':
        this.add('cannon', 14, 430, { n: 4, dir: 1, ttl: 2.2 });
        this.add('cannon', W - 14, 430, { n: 4, dir: -1, ttl: 2.2 });
        break;
      case 'donkey':
        this.add('donkey', spot.x, -30, { vy: 0, ttl: 6 });
        break;
      case 'ufo':
        this.add('ufo', -40, 70, { tx: spot.x, ttl: 4, grabbed: true });
        break;
      case 'jackpot':
        this.add('slot', W / 2, 120, { ttl: 2.4 });
        break;
      case 'tornado': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('tornado', dir > 0 ? 30 : W - 30, clamp(spot.y, 120, LINE - 120), { vx: 55 * dir, dir, ttl: 4, grabbed: true });
        break;
      }
      case 'train': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('train', dir > 0 ? -120 : W + 120, clamp(spot.y, 80, LINE - 40), { vx: 650 * dir, dir, ttl: 1.6, hits: true });
        break;
      }
      case 'dragon': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('dragon', dir > 0 ? -40 : W + 40, 110, { vx: 130 * dir, dir, ttl: 3.6 });
        break;
      }
    }
  }

  private add(
    kind: ActorKind, x: number, y: number,
    o: { vx?: number; vy?: number; ttl: number; tx?: number; ty?: number; n?: number; dir?: number; hits?: boolean; grabbed?: boolean },
  ): Actor | null {
    if (this.actors.length >= BALANCE.chaos.maxActors) return null;
    const a: Actor = {
      id: this.nextId++, kind, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, t: 0, ttl: o.ttl,
      tx: o.tx ?? x, ty: o.ty ?? y, sx: x, sy: y, n: o.n ?? 0, dir: o.dir ?? 1, gated: false,
      hits: o.hits ? new Set() : null, grabbed: o.grabbed ? [] : null, reels: null,
    };
    this.actors.push(a);
    return a;
  }

  /** 포물선 비행 (포탄·불덩이·바나나): 출발 → 목표까지 dur 초 */
  private lob(kind: ActorKind, x: number, y: number, tx: number, ty: number, speed: number): Actor | null {
    const dur = Math.max(0.2, Math.hypot(tx - x, ty - y) / speed);
    const a = this.add(kind, x, y, { tx, ty, ttl: dur + 0.02 });
    if (a) {
      a.vx = (tx - x) / dur;
      a.vy = (ty - y) / dur;
    }
    return a;
  }

  // ─── 물체 하나 움직이기 (false = 사라짐) ─────────────────

  private step(a: Actor, dt: number): boolean {
    const w = this.w;
    const D = this.D;
    const W = w.field.width;
    const LINE = w.field.defenseLineY;
    switch (a.kind) {
      case 'meteor': {
        // 대각선으로 떨어져 목표 높이에 닿으면 쾅
        if (a.y < -20) {
          a.y += 400 * dt;
          return true;
        }
        const k = 520 * dt;
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= k) {
          this.boom(a.tx, a.ty, 48, 2.5 * D);
          return false;
        }
        a.x += (dx / d) * k;
        a.y += (dy / d) * k;
        return true;
      }
      case 'sheep':
      case 'soldier': {
        const speed = a.kind === 'sheep' ? 150 : 90;
        const t = this.nearest(a.x, a.y);
        if (t) {
          const dx = t.x - a.x;
          const dy = t.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          a.vx = (dx / d) * speed;
          a.vy = (dy / d) * speed;
          a.dir = dx >= 0 ? 1 : -1;
          if (d < t.radius + 10) {
            this.boom(a.x, a.y, a.kind === 'sheep' ? 58 : 46, (a.kind === 'sheep' ? 3 : 2.5) * D);
            return false;
          }
        } else {
          a.vx = 0;
          a.vy = -speed;
        }
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        return a.y > -30;
      }
      case 'banana':
      case 'shell':
      case 'fireball': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.t + dt >= a.ttl - 0.02) {
          if (a.kind === 'banana') {
            this.boom(a.tx, a.ty, 56, 3 * D);
            for (let i = 0; i < 5; i++) {
              const ang = (i / 5) * Math.PI * 2 + w.rng.range(-0.3, 0.3);
              this.lob('bananaBit', a.tx, a.ty, a.tx + Math.cos(ang) * 80, a.ty + Math.sin(ang) * 80, 230);
            }
          } else if (a.kind === 'shell') this.boom(a.tx, a.ty, 46, 2.5 * D);
          else this.boom(a.tx, a.ty, 34, 1.5 * D, true);
          return false;
        }
        return true;
      }
      case 'bananaBit': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.t + dt >= a.ttl - 0.02) {
          this.boom(a.x, a.y, 34, 2 * D);
          return false;
        }
        return true;
      }
      case 'plane': {
        a.x += a.vx * dt;
        // 화면 안에서 26px 마다 폭탄
        const before = Math.floor((a.x - a.vx * dt) / 26);
        if (Math.floor(a.x / 26) !== before && a.x > 10 && a.x < W - 10) {
          this.add('bomb', a.x, a.y + 8, { tx: a.x, ty: a.ty + w.rng.range(-20, 20), vy: 520, ttl: 2 });
        }
        return true;
      }
      case 'bomb': {
        a.y += a.vy * dt;
        if (a.y >= a.ty) {
          this.boom(a.x, a.ty, 40, 2 * D);
          return false;
        }
        return true;
      }
      case 'dino':
      case 'cow':
      case 'train': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        const half = a.kind === 'train' ? 60 : 0;
        const reach = a.kind === 'train' ? 24 : TRAMPLE_R;
        for (const e of w.enemiesNear(a.x, a.y, reach + half)) {
          if (a.hits!.has(e.id) || e.pileCol >= 0) continue;
          if (a.kind === 'train' && Math.abs(e.y - a.y) > 24 + e.radius) continue;
          a.hits!.add(e.id);
          if (a.kind === 'train') w.hitFromExp(e, e.def.boss ? 6 * D : Math.max(e.hp + 1, 6 * D), w.newChain(1), 0);
          else this.boom(e.x, e.y, 26, (a.kind === 'dino' ? 3 : 2.5) * D);
        }
        if (a.kind === 'cow') return a.y > -40;
        return a.dir > 0 ? a.x < W + 140 : a.x > -140;
      }
      case 'cannon': {
        // 0.3초 뒤부터 0.35초 간격으로 n 발
        const shots = Math.floor((a.t - 0.3) / 0.35) + 1;
        const fired = 4 - a.n;
        if (a.t >= 0.3 && shots > fired && a.n > 0) {
          a.n--;
          const t = w.rng.chance(0.6) ? this.densest(50) : this.randomTarget();
          this.lob('shell', a.x, a.y, t.x, t.y, 520);
        }
        return true;
      }
      case 'donkey': {
        a.vy += 900 * dt;
        a.y += a.vy * dt;
        if (a.vy > 0) {
          const hit = w.enemiesNear(a.x, a.y, 14)[0];
          if (hit) {
            this.boom(a.x, a.y, 55, 3.5 * D);
            a.vy = -330;
            a.n++;
          }
        }
        if (a.n >= 5 || a.y >= LINE - 10) {
          this.boom(a.x, Math.min(a.y, LINE - 10), 80, 4 * D);
          return false;
        }
        return true;
      }
      case 'ufo': {
        // 1초 동안 목표 위로 날아와서, 1.6초 동안 빔으로 들어 올리고, 터뜨리고 떠난다
        if (a.t < 1) {
          a.x += (a.tx - a.x) * Math.min(1, dt * 4);
          return true;
        }
        if (a.t < 2.6) {
          for (const e of w.enemies) {
            if (e.dead || e.def.boss || e.pileCol >= 0 || Math.abs(e.x - a.x) > 30 || e.y < a.y) continue;
            if (!a.grabbed!.includes(e)) {
              a.grabbed!.push(e);
              e.pack = null;
              e.spark = true;
            }
          }
          for (const e of a.grabbed!) {
            if (e.dead) continue;
            e.y -= 80 * dt;
            e.x += (a.x - e.x) * Math.min(1, dt * 3);
            e.frozen = Math.max(e.frozen, 0.2);
          }
          return true;
        }
        if (a.grabbed!.length > 0) {
          for (const e of a.grabbed!) if (!e.dead) this.boom(e.x, e.y, 40, 4 * D);
          a.grabbed!.length = 0;
        }
        a.y -= 200 * dt;
        return a.y > -60;
      }
      case 'tornado': {
        a.x += a.vx * dt;
        for (const e of w.enemiesNear(a.x, a.y, 120)) {
          if (e.def.boss || e.pileCol >= 0) continue;
          if (!a.grabbed!.includes(e)) a.grabbed!.push(e);
          e.pack = null;
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          // 빨려 들어가며 돈다
          e.x += ((dx / d) * 90 - (dy / d) * 120) * dt;
          e.y += ((dy / d) * 90 + (dx / d) * 120) * dt;
          e.frozen = Math.max(e.frozen, 0.1);
        }
        if (a.t + dt >= a.ttl) {
          for (const e of a.grabbed!) if (!e.dead) e.spark = true;
          this.boom(a.x, a.y, 85, 4 * D);
        }
        return true;
      }
      case 'dragon': {
        a.x += a.vx * dt;
        // 아래로 불을 뿜어 지나간 자리 적에 불을 붙인다
        if (Math.floor(a.t / 0.12) !== Math.floor((a.t - dt) / 0.12)) {
          for (const e of w.enemies) {
            if (e.dead || e.y < a.y || e.y > a.y + 220) continue;
            const spread = 18 + (e.y - a.y) * 0.25;
            if (Math.abs(e.x - (a.x + a.dir * 10)) > spread) continue;
            e.burn = Math.max(e.burn, 3);
            w.hitFromExp(e, 0.4 * D, w.newChain(1), 0);
          }
        }
        return a.dir > 0 ? a.x < W + 60 : a.x > -60;
      }
      case 'slot': {
        if (a.t + dt >= 1.6 && !a.reels) this.spinResult(a);
        return true;
      }
      case 'cookie': {
        a.y += Math.sin(a.t * 3) * 10 * dt;
        return true;
      }
      case 'laser': {
        if (a.t < 0.15 && a.t + dt >= 0.15) {
          const chainId = w.newChain(1);
          for (const e of [...w.enemies]) {
            if (e.dead || Math.abs(e.x - a.x) > 20 + e.radius || e.y < 0) continue;
            w.hitFromExp(e, 4 * D, chainId, 0);
          }
        }
        return true;
      }
    }
    return true;
  }

  /** 잭팟: 777 이면 화면 전체 핵, 같은 그림 셋이면 그 난입 두 번, 아니면 하나 */
  private spinResult(a: Actor): void {
    const C = BALANCE.chaos;
    const rng = this.w.rng;
    const r = rng.next();
    const pick = () => SLOT_EMOJI[rng.int(SLOT_EMOJI.length - 1)];
    const byEmoji: Record<string, ChaosEventId> = { '🦖': 'dino', '🐄': 'cows', '☄️': 'meteor', '🛸': 'ufo', '🐑': 'sheep', '🍌': 'banana' };
    if (r < C.jackpot777) {
      a.reels = ['7️⃣', '7️⃣', '7️⃣'];
      this.nuke();
    } else if (r < C.jackpot777 + C.jackpotTriple) {
      const e = pick();
      a.reels = [e, e, e];
      this.startEvent(byEmoji[e], true);
      this.startEvent(byEmoji[e], true);
    } else {
      const e = pick();
      let f = pick();
      if (f === e) f = SLOT_EMOJI[(SLOT_EMOJI.indexOf(e) + 1) % (SLOT_EMOJI.length - 1)];
      a.reels = [e, f, e];
      this.startEvent(byEmoji[e], true);
    }
    this.w.emit({ type: 'slot', reels: a.reels });
  }

  /** 화면 안 모든 적에게 폭발 (보스는 덜) */
  private nuke(): void {
    const w = this.w;
    const chainId = w.newChain(1);
    for (const e of [...w.enemies]) {
      if (e.dead || e.y < 0 || e.y > w.field.defenseLineY) continue;
      w.spawnExplosion({ x: e.x, y: e.y, radius: 24, damage: (e.def.boss ? 15 : 8) * this.D, chainId, source: 'exp', delay: w.rng.range(0, 0.4) });
    }
    w.emit({ type: 'nuke' });
  }

  // ─── 설치물 ────────────────────────────────────────────

  private every(id: InstallId, baseSec: number, dt: number): boolean {
    const n = this.w.augments.stacks(id);
    if (n <= 0) return false;
    let t = (this.timers.get(id) ?? baseSec / n) - dt;
    let fire = false;
    if (t <= 0) {
      t += baseSec / n;
      fire = true;
    }
    this.timers.set(id, t);
    return fire;
  }

  /** 설치물 자리 (화면 아래 방어선 위, 얻은 순서대로) */
  installSlots(): { id: InstallId; x: number; y: number; stacks: number }[] {
    const out: { id: InstallId; x: number; y: number; stacks: number }[] = [];
    const W = this.w.field.width;
    const y = this.w.field.defenseLineY - 12;
    let i = 0;
    for (const o of this.w.augments.active()) {
      const id = o.def.id as InstallId;
      if (!id.startsWith('chaos_') || id === 'chaos_cannon' || id === 'chaos_gate' || id === 'chaos_luck') continue;
      out.push({ id, x: 30 + ((i * 60) % (W - 40)), y, stacks: o.stacks });
      i++;
    }
    return out;
  }

  private updateInstalls(dt: number): void {
    const w = this.w;
    const W = w.field.width;
    if (this.every('chaos_cannon', 3.2, dt)) {
      this.cannonSide = -this.cannonSide;
      const t = this.densest(50);
      this.lob('shell', this.cannonSide > 0 ? 14 : W - 14, 430, t.x, t.y, 520);
    }
    const slots = this.installSlots();
    const at = (id: InstallId) => slots.find((s) => s.id === id) ?? { x: W / 2, y: w.field.defenseLineY - 12 };
    if (this.every('chaos_tesla', 2.2, dt)) {
      const from = at('chaos_tesla');
      const chainId = w.newChain(1);
      for (let i = 0; i < 3; i++) {
        const e = this.randomEnemy();
        if (!e) break;
        e.spark = true;
        w.emit({ type: 'bolt', kind: 'lightning', x1: from.x, y1: from.y, x2: e.x, y2: e.y });
        w.spawnExplosion({ x: e.x, y: e.y, radius: 20, damage: this.D, chainId, source: 'lightning' });
      }
    }
    if (this.every('chaos_barracks', 3, dt)) {
      const from = at('chaos_barracks');
      this.add('soldier', from.x, from.y, { ttl: 10 });
    }
    if (this.every('chaos_sheepfarm', 4, dt)) {
      const from = at('chaos_sheepfarm');
      this.add('sheep', from.x, from.y, { ttl: 8 });
    }
    if (this.every('chaos_cat', 1.6, dt)) {
      const from = at('chaos_cat');
      const e = this.randomEnemy();
      if (e) this.lob('fireball', from.x, from.y - 6, e.x, e.y, 380);
    }
    if (this.every('chaos_satellite', 7, dt)) {
      const t = this.densest(24);
      this.add('laser', t.x, 0, { ttl: 0.5 });
    }
    if (this.every('chaos_eggs', 14, dt)) {
      const t = this.densest(60);
      const dir = w.rng.chance(0.5) ? 1 : -1;
      for (let i = 0; i < 2; i++) this.add('dino', dir > 0 ? -30 - i * 45 : W + 30 + i * 45, t.y, { vx: 230 * dir, dir, ttl: 4, hits: true });
    }
  }

  /** 곱하기 게이트: 좌우로 오가며, 지나간 발사체를 mult 배로 늘린다 */
  private updateGate(_dt: number): void {
    const n = this.w.augments.stacks('chaos_gate');
    if (n <= 0) {
      this.gate = null;
      return;
    }
    const W = this.w.field.width;
    const gw = 110;
    const x = gw / 2 + 10 + (W - gw - 20) * (0.5 + 0.5 * Math.sin(this.w.time * 0.6));
    this.gate = { x, y: 330, w: gw, mult: n + 1 };
    const g = this.gate;
    const born: Actor[] = [];
    for (const a of this.actors) {
      if (a.gated || !PROJECTILE_KINDS.has(a.kind)) continue;
      if (Math.abs(a.x - g.x) > g.w / 2) continue;
      const prevY = a.y - a.vy * (1 / 60);
      if ((prevY - g.y) * (a.y - g.y) > 0) continue;
      a.gated = true;
      for (let k = 1; k < g.mult; k++) {
        const c: Actor = { ...a, id: this.nextId++, gated: true, hits: null, grabbed: null, reels: null };
        const off = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 26;
        c.x += off;
        c.tx += off;
        born.push(c);
      }
      this.w.emit({ type: 'gate', x: a.x, y: g.y, mult: g.mult });
    }
    for (const c of born) if (this.actors.length < BALANCE.chaos.maxActors) this.actors.push(c);
  }

  // ─── 도움 ──────────────────────────────────────────────

  private boom(x: number, y: number, radius: number, damage: number, ignite = false): void {
    this.w.spawnExplosion({ x, y, radius, damage, chainId: this.w.newChain(1), source: 'exp', tag: ignite ? { ignite: true } : undefined });
  }

  private visible(e: Enemy): boolean {
    return !e.dead && e.y > 10 && e.y < this.w.field.defenseLineY && e.x > 0 && e.x < this.w.field.width;
  }

  private randomEnemy(): Enemy | null {
    const vis = this.w.enemies.filter((e) => this.visible(e));
    return vis.length ? vis[this.w.rng.int(vis.length)] : null;
  }

  private randomTarget(): { x: number; y: number } {
    const e = this.randomEnemy();
    return e ? { x: e.x, y: e.y } : { x: this.w.rng.range(40, this.w.field.width - 40), y: this.w.rng.range(120, 420) };
  }

  private nearest(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.w.enemies) {
      if (!this.visible(e)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** 반경 r 안에 적이 가장 많은 자리 (후보 40마리만 본다) */
  densest(r: number): { x: number; y: number } {
    const vis = this.w.enemies.filter((e) => this.visible(e));
    if (vis.length === 0) return { x: this.w.field.width / 2, y: 260 };
    const step = Math.max(1, Math.floor(vis.length / 40));
    let best = vis[0];
    let bestN = -1;
    for (let i = 0; i < vis.length; i += step) {
      const c = vis[i];
      const n = this.w.enemiesNear(c.x, c.y, r).length + c.y / 1000;
      if (n > bestN) {
        bestN = n;
        best = c;
      }
    }
    return { x: best.x, y: best.y };
  }
}
