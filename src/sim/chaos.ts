import { BALANCE } from '../data/balance';
import { AUGMENTS, FALLBACK_AUGMENTS } from '../data/augments';
import { ARMS, ARSENAL, MAX_LEVEL, PASSIVE_SLOTS, WEAPON_SLOTS, type ArmCategory, type ChaosEventId } from '../data/chaos';
import { clamp, dist2 } from '../core/math';
import type { Shot } from './exp';
import type { Enemy, OfferKind } from './types';
import type { World } from './World';

/**
 * 도파민 모드 v2: 카테고리 무기고 (data/chaos.ts).
 * 시작 무기 하나로 시작해서 레벨 업마다 무기를 늘리거나 올린다.
 * 효과는 전부 "물체(Actor)"로 움직이고, 피해는 연쇄 단계 1짜리 폭발로 준다 → 폭발형·폭약 붙은 적은 터지고,
 * 더 깊은 연쇄는 폭탄 탭 몫이다.
 */

export type ActorKind =
  | 'meteor' | 'dino' | 'cow' | 'ufo' | 'plane' | 'bomb' | 'cannon' | 'shell' | 'sheep' | 'banana' | 'bananaBit'
  | 'donkey' | 'train' | 'dragon' | 'tornado' | 'slot' | 'cookie' | 'soldier' | 'fireball' | 'laser' | 'frost';

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
  /** 목표 지점 */
  tx: number;
  ty: number;
  /** 남은 발사 수, 튕긴 횟수 등 */
  n: number;
  /** 보는 방향 (-1 왼쪽, 1 오른쪽) */
  dir: number;
  /** 피해 배율 (무기 레벨) */
  m: number;
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

/** 무기별 기본 쿨다운 (초). 레벨마다 10% 짧아지고, 속사 강화가 더 줄인다 */
const COOLDOWN: Record<string, number> = {
  arm_zap: 0.6, arm_mine: 1, arm_slash: 1.2, arm_flame: 0.8, arm_snipe: 1.5,
  arm_cannon: 3, arm_gun: 0.4, arm_tesla: 2.2, arm_laser: 7, arm_frost: 5,
  arm_soldier: 3, arm_sheep: 4, arm_cat: 1.6, arm_dino: 12, arm_cows: 10,
  arm_meteor: 12, arm_airstrike: 14, arm_banana: 10, arm_tornado: 16, arm_ufo: 18, arm_train: 15,
  arm_donkey: 14, arm_dragon: 16, arm_jackpot: 25,
};

export class Chaos {
  readonly actors: Actor[] = [];
  /** 지금 화면에 있는 곱하기 게이트 (없으면 null) */
  gate: { x: number; y: number; w: number; mult: number } | null = null;
  fever = 0;
  private feverCooldown = 0;
  heat = 0;
  frenzy = 0;
  clickFrenzy = 0;
  /** 다음 황금 쿠키까지 */
  cookieTimer: number;
  /** 마법이 터진 횟수 */
  events = 0;
  /** 무기별 남은 쿨다운 (손공격은 탭할 때, 나머지는 저절로) */
  readonly cooldowns = new Map<string, number>();
  private nextId = 1;
  /** 지금 만드는 물체의 피해 배율 */
  private curMul = 1;

  constructor(private readonly w: World) {
    this.cookieTimer = BALANCE.chaos.cookieEverySec;
  }

  private get D(): number {
    return this.w.stats.tapDamage;
  }

  lv(id: string): number {
    return this.w.augments.stacks(id);
  }

  get hasBomb(): boolean {
    return this.lv('arm_bomb') > 0;
  }

  /** 무기 레벨 피해 배율 */
  private dmgMul(id: string): number {
    return 1 + 0.25 * (this.lv(id) - 1);
  }

  /** 다중 강화: 발사 수 + (1·3·5레벨) */
  private get extra(): number {
    return Math.floor((this.lv('arm_multi') + 1) / 2);
  }

  cooldownOf(id: string): number {
    const L = this.lv(id);
    return COOLDOWN[id] * (1 - 0.1 * (L - 1)) * Math.max(0.5, 1 - 0.08 * this.lv('arm_haste'));
  }

  /** 가진 무기 (카테고리별) */
  owned(cat?: ArmCategory): string[] {
    const out: string[] = [];
    for (const o of this.w.augments.active()) {
      const info = ARMS[o.def.id];
      if (info && (!cat || info.cat === cat)) out.push(o.def.id);
    }
    return out;
  }

  // ─── 선택지 ────────────────────────────────────────────

  /**
   * 레벨 업 선택지 3장: 가진 무기 레벨 업 / 새 무기 (칸이 남았으면) / 강화 / 폭탄 탭이 있으면 기존 탭 증강 약간.
   * 시작 선택지는 손공격·포탑·소환수·마법에서 한 장씩.
   */
  roll(kind: OfferKind): string[] {
    const rng = this.w.rng;
    if (kind === 'starter') {
      const out: string[] = [];
      for (const cat of ['hand', 'turret', 'summon', 'magic'] as const) {
        const pool = Object.keys(ARMS).filter((id) => ARMS[id].cat === cat && ARMS[id].starter);
        out.push(rng.pick(pool));
      }
      return out;
    }
    const weapons = this.owned().filter((id) => ARMS[id].cat !== 'passive');
    const passives = this.owned('passive');
    const cand: { id: string; wt: number }[] = [];
    for (const d of ARSENAL) {
      const L = this.lv(d.id);
      const info = ARMS[d.id];
      if (L >= MAX_LEVEL) continue;
      if (L > 0) cand.push({ id: d.id, wt: 1 });
      else if (info.cat === 'passive') {
        if (passives.length < PASSIVE_SLOTS) cand.push({ id: d.id, wt: 0.5 });
      } else if (weapons.length < WEAPON_SLOTS) cand.push({ id: d.id, wt: kind === 'boss' && info.cat === 'magic' ? 3 : 0.6 });
    }
    if (this.hasBomb) {
      for (const d of AUGMENTS) if (d.rarity !== 'prism' && !d.evolution && this.w.augments.isAvailable(d)) cand.push({ id: d.id, wt: 0.15 });
    }
    const out: string[] = [];
    while (out.length < 3 && cand.length > 0) {
      const c = rng.weighted(cand, (x) => x.wt);
      if (!c) break;
      out.push(c.id);
      cand.splice(cand.indexOf(c), 1);
    }
    for (const fb of FALLBACK_AUGMENTS) {
      if (out.length >= 3) break;
      out.push(fb.id);
    }
    return out;
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
      else this.startEvent('meteor', 3, true);
      this.w.emit({ type: 'cookie', x: a.x, y: a.y, buff });
      return true;
    }
    return false;
  }

  /** 손공격: 탭한 자리에서 쿨다운이 끝난 손 무기를 전부 쓴다. 하나라도 나갔으면 true */
  onTap(x: number, y: number): boolean {
    const w = this.w;
    let any = false;
    for (const id of this.owned('hand')) {
      if (id === 'arm_bomb' || (this.cooldowns.get(id) ?? 0) > 0) continue;
      this.cooldowns.set(id, this.cooldownOf(id));
      any = true;
      const L = this.lv(id);
      const D = this.D * this.dmgMul(id) * (this.frenzy > 0 ? BALANCE.chaos.frenzyDamage : 1) * (this.fever > 0 ? BALANCE.chaos.feverDamage : 1);
      switch (id) {
        case 'arm_zap': {
          const near = w.enemiesNear(x, y, 110).sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y));
          const chainId = w.newChain(1);
          for (const e of near.slice(0, 3 + Math.floor(L / 2) + this.extra)) {
            e.spark = true;
            w.emit({ type: 'bolt', kind: 'lightning', x1: x, y1: y, x2: e.x, y2: e.y });
            w.spawnExplosion({ x: e.x, y: e.y, radius: 18, damage: 2 * D, chainId, source: 'lightning' });
          }
          break;
        }
        case 'arm_mine': {
          const max = 3 + L;
          const own = w.mines.filter((m) => m.depth !== undefined);
          if (own.length >= max) w.mines.splice(w.mines.indexOf(own[0]), 1);
          w.addMine({ x, y, radius: 48 + 3 * L, damage: 3 * D, ttl: 15, depth: 1 });
          break;
        }
        case 'arm_slash':
          w.spawnExplosion({ x, y, radius: 12 + 3 * L, damage: 2.5 * D, chainId: w.newChain(1), source: 'tap', tag: { row: true } });
          break;
        case 'arm_flame':
          w.addZone({ x, y, radius: 36 + 5 * L, dps: 1.2 * D, ttl: 2 + 0.4 * L, chainId: w.newChain(1), source: 'exp' });
          break;
        case 'arm_snipe': {
          let best: Enemy | null = null;
          for (const e of w.enemiesNear(x, y, 90)) if (!best || e.hp > best.hp) best = e;
          if (best) {
            w.emit({ type: 'bolt', kind: 'shard', x1: x, y1: w.field.height, x2: best.x, y2: best.y });
            w.hitFromExp(best, 8 * D, w.newChain(1), 0);
          }
          break;
        }
      }
    }
    if (any) w.taps++;
    return any;
  }

  /** 피버·프렌지는 폭탄 탭을 키우고, 클릭 프렌지는 쏘자마자 게이지를 채운다 */
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

  xpMul(): number {
    return BALANCE.chaos.xpMul * (1 + 0.2 * this.lv('arm_xp'));
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
    const luck = this.lv('arm_luck');
    if (this.fever > 0) {
      this.fever -= dt;
      if (this.fever <= 0) {
        this.fever = 0;
        w.emit({ type: 'fever', on: false });
      }
    } else {
      this.feverCooldown = Math.max(0, this.feverCooldown - dt);
      if (this.heat >= C.feverThreshold * (1 - 0.1 * luck) && this.feverCooldown <= 0) {
        this.fever = C.feverSec;
        this.feverCooldown = C.feverCooldownSec + C.feverSec;
        w.emit({ type: 'fever', on: true });
      }
    }
    if (!w.config.sandbox && w.wave >= C.cookieFromWave) {
      this.cookieTimer -= dt * (1 + 0.4 * luck);
      if (this.cookieTimer <= 0) {
        this.cookieTimer = C.cookieEverySec;
        this.add('cookie', w.rng.range(50, w.field.width - 50), w.rng.range(140, w.field.defenseLineY - 140), { ttl: C.cookieSec });
      }
    }
    for (const [id, t] of this.cooldowns) this.cooldowns.set(id, t - dt);
    this.updateWeapons();
    this.updateGate();
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      a.t += dt;
      if (!this.step(a, dt) || a.t >= a.ttl) this.actors.splice(i, 1);
    }
  }

  /** 쿨다운이 끝난 자동 무기(포탑·소환수·마법)를 쓴다 */
  private updateWeapons(): void {
    const w = this.w;
    for (const id of this.owned()) {
      const info = ARMS[id];
      if (info.cat === 'hand' || info.cat === 'passive') continue;
      const left = this.cooldowns.get(id);
      if (left === undefined) {
        // 얻자마자 처음 한 번은 금방
        this.cooldowns.set(id, Math.min(1, this.cooldownOf(id)));
        continue;
      }
      if (left > 0) continue;
      this.cooldowns.set(id, this.cooldownOf(id));
      this.curMul = this.dmgMul(id);
      const L = this.lv(id);
      if (info.event) {
        this.startEvent(info.event, L);
        continue;
      }
      const from = this.slotOf(id);
      switch (id) {
        case 'arm_cannon':
          for (let i = 0; i < 1 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0) + this.extra; i++) {
            const t = i === 0 ? this.densest(50) : this.randomTarget();
            this.lob('shell', from.x, from.y - 8, t.x, t.y, 520);
          }
          break;
        case 'arm_gun': {
          const e = this.nearest(from.x, from.y);
          if (e) {
            w.emit({ type: 'bolt', kind: 'shard', x1: from.x, y1: from.y - 6, x2: e.x, y2: e.y });
            w.hitFromExp(e, 0.7 * this.D * this.curMul, w.newChain(1), 0);
          }
          break;
        }
        case 'arm_tesla': {
          const chainId = w.newChain(1);
          for (let i = 0; i < 3 + Math.floor(L / 2) + this.extra; i++) {
            const e = this.randomEnemy();
            if (!e) break;
            e.spark = true;
            w.emit({ type: 'bolt', kind: 'lightning', x1: from.x, y1: from.y - 10, x2: e.x, y2: e.y });
            w.spawnExplosion({ x: e.x, y: e.y, radius: 20, damage: this.D * this.curMul, chainId, source: 'lightning' });
          }
          break;
        }
        case 'arm_laser': {
          const t = this.densest(24);
          this.add('laser', t.x, 0, { ttl: 0.5 });
          break;
        }
        case 'arm_frost': {
          const t = this.densest(60);
          const r = 55 + 8 * L;
          const chainId = w.newChain(1);
          for (const e of w.enemiesNear(t.x, t.y, r)) {
            if (!e.def.boss) {
              e.frozen = Math.max(e.frozen, 2);
              e.pack = null;
            }
            // 얼리면서 살짝 (언 적은 2.5배라 실제로는 꽤 아프다)
            w.hitFromExp(e, 0.5 * this.D * this.curMul, chainId, 0);
          }
          this.add('frost', t.x, t.y, { ttl: 0.5, n: r });
          break;
        }
        case 'arm_soldier':
          for (let i = 0; i < 1 + this.extra; i++) this.add('soldier', from.x + i * 8, from.y, { ttl: 10 });
          break;
        case 'arm_sheep':
          for (let i = 0; i < 1 + (L >= 3 ? 1 : 0) + (L >= 5 ? 1 : 0) + this.extra; i++) this.add('sheep', from.x + i * 10, from.y, { ttl: 8 });
          break;
        case 'arm_cat': {
          for (let i = 0; i < 1 + this.extra; i++) {
            const e = this.randomEnemy();
            if (e) this.lob('fireball', from.x, from.y - 6, e.x, e.y, 380);
          }
          break;
        }
        case 'arm_dino':
          this.startEvent('dino', L, true);
          break;
        case 'arm_cows':
          this.startEvent('cows', L, true);
          break;
      }
    }
    this.curMul = 1;
  }

  // ─── 큰 효과 (마법·소환) ───────────────────────────────

  /** L = 무기 레벨 (수가 늘어남). quiet 면 배너 없이 */
  startEvent(id: ChaosEventId, L = 1, quiet = false): void {
    const w = this.w;
    const rng = w.rng;
    const W = w.field.width;
    const LINE = w.field.defenseLineY;
    const spot = this.densest(60);
    const more = L - 1 + this.extra;
    this.events++;
    if (!quiet) w.emit({ type: 'chaos', id, x: spot.x, y: spot.y });
    switch (id) {
      case 'meteor':
        for (let i = 0; i < 5 + 2 * more; i++) {
          const t = this.randomTarget();
          this.add('meteor', t.x + 90, -40 - i * 60, { tx: t.x, ty: t.y, ttl: 5 });
        }
        break;
      case 'sheep':
        for (let i = 0; i < 4 + more; i++) this.add('sheep', 40 + (i * (W - 80)) / Math.max(1, 3 + more), LINE - 6, { ttl: 8 });
        break;
      case 'banana':
        this.add('banana', W / 2, LINE, { tx: spot.x, ty: spot.y, ttl: 0.6, n: 5 + more });
        break;
      case 'airstrike': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('plane', dir > 0 ? -40 : W + 40, 40, { vx: 260 * dir, dir, ty: spot.y, ttl: 2.2, n: Math.max(14, 26 - 3 * more) });
        break;
      }
      case 'cookie':
        this.add('cookie', rng.range(50, W - 50), rng.range(140, LINE - 140), { ttl: BALANCE.chaos.cookieSec });
        break;
      case 'dino': {
        const dir = rng.chance(0.5) ? 1 : -1;
        for (let i = 0; i < 2 + more; i++) {
          this.add('dino', dir > 0 ? -30 - i * 45 : W + 30 + i * 45, clamp(spot.y + rng.range(-50, 50), 60, LINE - 30), { vx: 230 * dir, dir, ttl: 4, hits: true });
        }
        break;
      }
      case 'cows':
        for (let i = 0; i < 3 + more; i++) this.add('cow', 30 + (i * (W - 60)) / Math.max(1, 2 + more), LINE + 10 + i * 18, { vy: -240, ttl: 4, hits: true });
        break;
      case 'cannons':
        this.add('cannon', 14, 430, { n: 4, dir: 1, ttl: 2.2 });
        this.add('cannon', W - 14, 430, { n: 4, dir: -1, ttl: 2.2 });
        break;
      case 'donkey':
        this.add('donkey', spot.x, -30, { vy: 0, ttl: 6, n: -(4 + more) });
        break;
      case 'ufo':
        this.add('ufo', -40, 70, { tx: spot.x, ttl: 4, grabbed: true, n: 30 + 4 * more });
        break;
      case 'jackpot':
        this.add('slot', W / 2, 120, { ttl: 2.4, n: L });
        break;
      case 'tornado': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('tornado', dir > 0 ? 30 : W - 30, clamp(spot.y, 120, LINE - 120), { vx: 55 * dir, dir, ttl: 4, grabbed: true, n: 110 + 10 * more });
        break;
      }
      case 'train': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('train', dir > 0 ? -120 : W + 120, clamp(spot.y, 80, LINE - 40), { vx: 650 * dir, dir, ttl: 1.6, hits: true });
        break;
      }
      case 'dragon': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('dragon', dir > 0 ? -40 : W + 40, 110, { vx: 130 * dir, dir, ttl: 3.6, n: more });
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
      tx: o.tx ?? x, ty: o.ty ?? y, n: o.n ?? 0, dir: o.dir ?? 1, m: this.curMul, gated: false,
      hits: o.hits ? new Set() : null, grabbed: o.grabbed ? [] : null, reels: null,
    };
    this.actors.push(a);
    return a;
  }

  /** 포물선 비행 (포탄·불덩이·바나나): 출발 → 목표까지 */
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
    const D = this.D * a.m;
    const W = w.field.width;
    const LINE = w.field.defenseLineY;
    switch (a.kind) {
      case 'meteor': {
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
            const bits = Math.max(5, a.n);
            this.curMul = a.m;
            for (let i = 0; i < bits; i++) {
              const ang = (i / bits) * Math.PI * 2 + w.rng.range(-0.3, 0.3);
              this.lob('bananaBit', a.tx, a.ty, a.tx + Math.cos(ang) * 80, a.ty + Math.sin(ang) * 80, 230);
            }
            this.curMul = 1;
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
        const gap = a.n || 26;
        const before = Math.floor((a.x - a.vx * dt) / gap);
        if (Math.floor(a.x / gap) !== before && a.x > 10 && a.x < W - 10) {
          this.curMul = a.m;
          this.add('bomb', a.x, a.y + 8, { tx: a.x, ty: a.ty + w.rng.range(-20, 20), vy: 520, ttl: 2 });
          this.curMul = 1;
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
        const shots = Math.floor((a.t - 0.3) / 0.35) + 1;
        const fired = 4 - a.n;
        if (a.t >= 0.3 && shots > fired && a.n > 0) {
          a.n--;
          const t = w.rng.chance(0.6) ? this.densest(50) : this.randomTarget();
          this.curMul = a.m;
          this.lob('shell', a.x, a.y, t.x, t.y, 520);
          this.curMul = 1;
        }
        return true;
      }
      case 'donkey': {
        a.vy += 900 * dt;
        a.y += a.vy * dt;
        if (a.vy > 0 && w.enemiesNear(a.x, a.y, 14)[0]) {
          this.boom(a.x, a.y, 55, 3.5 * D);
          a.vy = -330;
          a.n++;
        }
        if (a.n >= 0 || a.y >= LINE - 10) {
          this.boom(a.x, Math.min(a.y, LINE - 10), 80, 4 * D);
          return false;
        }
        return true;
      }
      case 'ufo': {
        if (a.t < 1) {
          a.x += (a.tx - a.x) * Math.min(1, dt * 4);
          return true;
        }
        const beam = a.n || 30;
        if (a.t < 2.6) {
          for (const e of w.enemies) {
            if (e.dead || e.def.boss || e.pileCol >= 0 || Math.abs(e.x - a.x) > beam || e.y < a.y) continue;
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
        const pull = a.n || 110;
        for (const e of w.enemiesNear(a.x, a.y, pull)) {
          if (e.def.boss || e.pileCol >= 0) continue;
          if (!a.grabbed!.includes(e)) a.grabbed!.push(e);
          e.pack = null;
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
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
        if (Math.floor(a.t / 0.12) !== Math.floor((a.t - dt) / 0.12)) {
          for (const e of w.enemies) {
            if (e.dead || e.y < a.y || e.y > a.y + 220 + 20 * a.n) continue;
            const spread = 18 + 4 * a.n + (e.y - a.y) * 0.25;
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
      case 'frost':
        return true;
    }
    return true;
  }

  /** 잭팟: 777 이면 화면 전체 핵, 같은 그림 셋이면 그 효과 두 번, 아니면 하나 */
  private spinResult(a: Actor): void {
    const C = BALANCE.chaos;
    const rng = this.w.rng;
    const r = rng.next();
    const pick = () => SLOT_EMOJI[rng.int(SLOT_EMOJI.length - 1)];
    const byEmoji: Record<string, ChaosEventId> = { '🦖': 'dino', '🐄': 'cows', '☄️': 'meteor', '🛸': 'ufo', '🐑': 'sheep', '🍌': 'banana' };
    const L = Math.max(1, a.n);
    this.curMul = a.m;
    if (r < C.jackpot777 + 0.03 * (L - 1)) {
      a.reels = ['7️⃣', '7️⃣', '7️⃣'];
      this.nuke();
    } else if (r < C.jackpot777 + C.jackpotTriple) {
      const e = pick();
      a.reels = [e, e, e];
      this.startEvent(byEmoji[e], L, true);
      this.startEvent(byEmoji[e], L, true);
    } else {
      const e = pick();
      let f = pick();
      if (f === e) f = SLOT_EMOJI[(SLOT_EMOJI.indexOf(e) + 1) % (SLOT_EMOJI.length - 1)];
      a.reels = [e, f, e];
      this.startEvent(byEmoji[e], L, true);
    }
    this.curMul = 1;
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

  // ─── 설치 자리 ─────────────────────────────────────────

  /** 포탑·소환수 자리 (방어선 위, 얻은 순서대로) */
  installSlots(): { id: string; x: number; y: number; stacks: number }[] {
    const out: { id: string; x: number; y: number; stacks: number }[] = [];
    const W = this.w.field.width;
    const y = this.w.field.defenseLineY - 12;
    let i = 0;
    for (const o of this.w.augments.active()) {
      const info = ARMS[o.def.id];
      if (!info || (info.cat !== 'turret' && info.cat !== 'summon')) continue;
      out.push({ id: o.def.id, x: 34 + ((i * 58) % (W - 50)), y, stacks: o.stacks });
      i++;
    }
    return out;
  }

  private slotOf(id: string): { x: number; y: number } {
    return this.installSlots().find((s) => s.id === id) ?? { x: this.w.field.width / 2, y: this.w.field.defenseLineY - 12 };
  }

  /** 곱하기 게이트: 좌우로 오가며, 지나간 발사체를 mult 배로 늘린다 */
  private updateGate(): void {
    const n = this.lv('arm_gate');
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
