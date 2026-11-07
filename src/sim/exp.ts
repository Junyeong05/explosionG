import { BALANCE } from '../data/balance';
import { clamp, dist2 } from '../core/math';
import type { Enemy, Explosion, ExplosionTag, Pack, RunRules } from './types';
import type { World } from './World';

/**
 * 11-07 실험 묶음: 가볍게 켜 보고 고르기 위한 규칙들 (data/experiments.ts 에 번호·설명).
 * World 는 정해진 자리에서 이 훅들만 부르고, 규칙별 코드는 여기 모은다. 수치는 BALANCE.experiment.
 */

/** 탭 한 발. onFire 가 고칠 수 있다 */
export interface Shot {
  x: number;
  y: number;
  power: number;
  radius: number;
  damage: number;
  /** 연쇄 단계 (0 = 연쇄 없음) */
  depth: number;
  delay: number;
  tag: ExplosionTag;
  /** true 면 폭발을 만들지 않는다 (지뢰·씨앗이 대신 생김) */
  cancel: boolean;
  /** 쏜 뒤 남길 게이지 (없으면 보통대로 전부 씀) */
  gaugeAfter?: number;
}

export interface Seed {
  x: number;
  y: number;
  ttl: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
}

const BURN_TICK = 0.25;
const BALL_HIT_R = 6;

export class Experiments {
  readonly seeds: Seed[] = [];
  readonly balls: Ball[] = [];
  /** 색 맞추기: 다음 탭 색 */
  tapColor = 0;
  /** 바람: 지금 좌우 속도 (px/s) */
  wind = 0;
  private burnTimer = 0;
  private spreadTimer = 0;
  private lastBeat = -1;

  constructor(
    private readonly w: World,
    private readonly r: RunRules,
  ) {}

  // ─── 시간 ──────────────────────────────────────────────

  /** 적 이동·웨이브·지속 피해가 흐르는 배율 (누를 때만 시간: 손 떼면 거의 멈춤) */
  timeScale(): number {
    if (this.r.stopTime && !this.w.charging) return BALANCE.experiment.stopTime.idleScale;
    return 1;
  }

  /** 누를 때만 시간: 게이지는 누르고 있을 때만 찬다 */
  gaugeFills(): boolean {
    return !this.r.stopTime || !!this.w.charging;
  }

  /** 누를 때만 시간: 게이지가 덜 찼어도 누르면 모으기 시작 */
  pressStartsCharge(): boolean {
    return !!this.r.stopTime;
  }

  // ─── 등장 ──────────────────────────────────────────────

  onSpawn(e: Enemy): void {
    const w = this.w;
    e.bornAt = w.time;
    if (this.r.colors && !e.def.boss) e.color = w.rng.int(BALANCE.experiment.colors.count);
    if (this.r.golden && !e.def.boss && w.rng.chance(BALANCE.experiment.golden.chance)) e.golden = true;
    if (this.r.core) this.aimAtCore(e);
  }

  /**
   * 가운데 지키기: 무리를 코어에서 아무 방향으로, 화면 가장자리 바로 바깥에 놓고 코어 쪽으로 보낸다
   * (멀리서 출발하면 옆에서 오는 무리는 화면 밖에서 시간을 다 써서 보이자마자 닿았다)
   */
  placePack(pack: Pack, members: readonly Enemy[]): void {
    if (!this.r.core) return;
    const C = BALANCE.experiment.core;
    const W = this.w.field.width;
    const H = this.w.field.defenseLineY;
    // 바로 아래에서 올라오는 방향은 뺀다 (게이지 HUD 위로 지나가서 화면이 지저분했다)
    let a = this.w.rng.range(0, Math.PI * 2);
    for (let i = 0; i < 8 && Math.sin(a) > C.maxBelow; i++) a = this.w.rng.range(0, Math.PI * 2);
    if (Math.sin(a) > C.maxBelow) a = -Math.PI / 2;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    // 코어에서 이 방향으로 화면 가장자리까지 거리 + 여유
    const tx = ux > 0 ? (W - C.x) / ux : ux < 0 ? -C.x / ux : Infinity;
    const ty = uy > 0 ? (H - C.y) / uy : uy < 0 ? -C.y / uy : Infinity;
    const dist = Math.min(tx, ty) + C.spawnMargin;
    const nx = C.x + ux * dist;
    const ny = C.y + uy * dist;
    const ddx = nx - pack.x;
    const ddy = ny - pack.y;
    pack.x = nx;
    pack.y = ny;
    pack.dx = -Math.cos(a);
    pack.dy = -Math.sin(a);
    for (const e of members) {
      e.x += ddx;
      e.y += ddy;
      const d = Math.hypot(C.x - e.x, C.y - e.y) || 1;
      e.dx = (C.x - e.x) / d;
      e.dy = (C.y - e.y) / d;
    }
  }

  private aimAtCore(e: Enemy): void {
    const C = BALANCE.experiment.core;
    const d = Math.hypot(C.x - e.x, C.y - e.y) || 1;
    e.dx = (C.x - e.x) / d;
    e.dy = (C.y - e.y) / d;
    e.speed *= C.speedMul;
  }

  /** 적이 넘어왔나 (가운데 지키기: 코어에 닿음, 아니면 방어선) */
  leaked(e: Enemy): boolean {
    if (this.r.core) {
      const C = BALANCE.experiment.core;
      const rr = C.radius + e.radius * 0.5;
      return dist2(e.x, e.y, C.x, C.y) <= rr * rr;
    }
    return e.y >= this.w.field.defenseLineY;
  }

  /** 넘어오기까지 남은 거리 (봇 위험 판정) */
  leakGap(e: Enemy): number {
    if (this.r.core) {
      const C = BALANCE.experiment.core;
      return Math.sqrt(dist2(e.x, e.y, C.x, C.y)) - C.radius;
    }
    return this.w.landingY(e.x) - e.y;
  }

  // ─── 탭 ────────────────────────────────────────────────

  onFire(s: Shot): void {
    const w = this.w;
    const E = BALANCE.experiment;
    const full = s.power >= 1 - 1e-9;

    if (this.r.seeds && !full) {
      // 씨앗 심기: 100% 전 탭은 게이지 cost 만 쓰고 씨앗을 심는다
      s.cancel = true;
      if (s.power + 1e-9 < E.seeds.cost) {
        w.emit({ type: 'dryTap', x: s.x, y: s.y });
        s.gaugeAfter = s.power;
        return;
      }
      s.gaugeAfter = s.power - E.seeds.cost;
      if (this.seeds.length >= E.seeds.max) this.seeds.shift();
      this.seeds.push({ x: s.x, y: s.y, ttl: E.seeds.ttl });
      w.emit({ type: 'seed', x: s.x, y: s.y });
      return;
    }
    if (this.r.freeze && !full) {
      s.tag.freeze = true;
      s.radius *= E.freeze.radiusMul;
      s.damage = 0;
      s.depth = 0;
    }
    if (this.r.beat) {
      const B = E.beat;
      const ph = w.time % B.period;
      const on = Math.min(ph, B.period - ph) <= B.window;
      if (on) {
        s.damage *= B.onDamage;
        s.radius *= B.onRadius;
        if (s.depth > 0) s.depth++;
      } else s.damage *= B.offDamage;
      w.emit({ type: 'beatShot', x: s.x, y: s.y, on });
    }
    if (this.r.sweet) {
      const top = this.sweetTop();
      if (s.y >= top && s.y <= top + E.sweet.height) {
        s.damage *= E.sweet.damageMul;
        if (s.depth > 0) s.depth++;
        w.emit({ type: 'sweetShot', x: s.x, y: s.y });
      }
    }
    if (this.r.colors) {
      s.tag.color = this.tapColor;
      this.tapColor = (this.tapColor + 1) % E.colors.count;
    }
    if (this.r.row) {
      s.tag.row = true;
      s.radius = E.row.base + E.row.perPower * s.power;
      s.damage *= E.row.damageMul;
    }
    if (this.r.knockback) s.tag.knock = E.knockback.tap * s.power;
    if (this.r.burn && !s.tag.freeze) s.tag.ignite = true;
    if (this.r.launcher) {
      const L = E.launcher;
      const d = Math.hypot(s.x - L.x, s.y - L.y);
      s.delay += d / L.speed;
      w.emit({ type: 'launch', x1: L.x, y1: L.y, x2: s.x, y2: s.y, dur: d / L.speed });
    }
    if (this.r.mines) {
      s.cancel = true;
      const M = E.mines;
      // 가장 오래된 지뢰부터 비운다 (증강 지뢰는 depth 가 없음)
      const own = w.mines.filter((m) => m.depth !== undefined);
      if (own.length >= M.max) w.mines.splice(w.mines.indexOf(own[0]), 1);
      w.addMine({ x: s.x, y: s.y, radius: s.radius * M.radiusMul, damage: s.damage * M.damageMul, ttl: M.ttl, depth: s.depth });
      return;
    }
  }

  /** 폭발이 실제로 생긴 뒤 (불바다·메아리) */
  afterFire(s: Shot, chainId: number): void {
    const w = this.w;
    const E = BALANCE.experiment;
    if (this.r.scorch && !s.tag.freeze) {
      w.addZone({
        x: s.x, y: s.y, radius: s.radius * E.scorch.radiusMul, dps: E.scorch.dps * w.stats.tapDamage,
        ttl: E.scorch.base + E.scorch.perPower * s.power, chainId: w.newChain(1), source: 'exp',
      });
    }
    if (this.r.echo && !s.tag.echo) {
      w.spawnExplosion({
        x: s.x, y: s.y, radius: s.radius, damage: s.damage * E.echo.damageMul, chainId, source: 'tap',
        delay: s.delay + E.echo.delay, edgeMul: w.stats.tapEdgeMul, tag: { ...s.tag, echo: true },
      });
    }
  }

  // ─── 폭발·피해 ─────────────────────────────────────────

  /** 가로 베기: 띠 안의 적 */
  collectRow(ex: Explosion, out: Enemy[]): Enemy[] {
    out.length = 0;
    for (const e of this.w.enemies) if (!e.dead && Math.abs(e.y - ex.y) <= ex.radius + e.radius) out.push(e);
    return out;
  }

  /** 폭발이 터진 뒤: 닿은 씨앗이 같은 단계로 터진다 */
  onDetonate(ex: Explosion): void {
    if (!this.r.seeds || this.seeds.length === 0) return;
    const w = this.w;
    const S = BALANCE.experiment.seeds;
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const sd = this.seeds[i];
      const hit = ex.tag?.row ? Math.abs(sd.y - ex.y) <= ex.radius + 6 : dist2(sd.x, sd.y, ex.x, ex.y) <= (ex.radius + 6) ** 2;
      if (!hit) continue;
      this.seeds.splice(i, 1);
      w.emit({ type: 'seedBlast', x: sd.x, y: sd.y });
      w.spawnExplosion({
        x: sd.x, y: sd.y, radius: S.radius, damage: S.charge * w.stats.tapDamage, chainId: ex.chainId, source: 'exp',
        delay: w.stats.chainDelaySec, depth: ex.depth, tag: ex.tag?.color !== undefined ? { color: ex.tag.color } : undefined,
      });
    }
  }

  /**
   * 피해 배율 (색·얼음). 얼리는 탭이면 피해 없이 얼리고 -1 을 돌려준다.
   * tag 는 맞힌 폭발의 꼬리표, chainTag 는 그 연쇄의 꼬리표 (색은 연쇄 전체에 따라감).
   */
  modifyDamage(e: Enemy, dmg: number, tag: ExplosionTag | undefined, chainTag: ExplosionTag | undefined): number {
    const E = BALANCE.experiment;
    if (tag?.freeze) {
      if (!e.def.boss) {
        e.frozen = E.freeze.sec;
        e.pack = null;
        this.w.emit({ type: 'freeze', x: e.x, y: e.y });
      }
      return -1;
    }
    const color = tag?.color ?? chainTag?.color;
    if (this.r.colors && color !== undefined && e.color >= 0) dmg *= e.color === color ? E.colors.same : E.colors.other;
    if (e.frozen > 0) dmg *= E.freeze.damageTakenMul;
    return dmg;
  }

  /** 맞고 살아남은 적 (밀어내기·풍선·불) */
  afterHit(e: Enemy, ex: { x: number; y: number; tag?: ExplosionTag; depth: number } | undefined, chainTag: ExplosionTag | undefined): void {
    const E = BALANCE.experiment;
    if (!ex) return;
    const knock = ex.tag?.knock ?? (chainTag?.knock !== undefined && ex.depth > 0 ? chainTag.knock * E.knockback.chainMul : 0);
    if (knock > 0 && !e.def.boss && e.pileCol < 0) {
      let dx = e.x - ex.x;
      let dy = e.y - ex.y;
      const d = Math.hypot(dx, dy);
      if (ex.tag?.row) {
        dx = 0;
        dy = e.y < ex.y ? -1 : 1;
      } else if (d < 1e-3) {
        dx = 0;
        dy = -1;
      } else {
        dx /= d;
        dy /= d;
      }
      e.kx += dx * knock;
      e.ky += dy * knock;
      e.pack = null;
    }
    if (this.r.inflate && !e.def.boss && e.inflate < E.inflate.max && e.pileCol < 0) {
      e.inflate++;
      e.radius *= E.inflate.grow;
    }
    if (ex.tag?.ignite && !e.def.boss) e.burn = E.burn.sec;
  }

  /** 죽을 때 터지는 모양을 바꾼다 (얼음 깨짐·풍선·익는 폭발형). 없으면 undefined */
  deathBlast(e: Enemy): { radiusMul: number; charge: number } | undefined {
    const E = BALANCE.experiment;
    if (this.r.ripen && e.def.deathBlast && !e.def.boss) {
      const R = E.ripen;
      const t = clamp((this.w.time - e.bornAt) / R.fullSec, 0, 1);
      return { radiusMul: e.def.deathBlast.radiusMul * (R.from + (R.to - R.from) * t), charge: e.def.deathBlast.charge };
    }
    if (this.r.freeze && e.frozen > 0 && !e.def.deathBlast) return E.freeze.shatter;
    if (this.r.inflate && e.inflate > 0 && !e.def.deathBlast) {
      return { radiusMul: 0.6 + E.inflate.radiusPer * e.inflate, charge: E.inflate.chargePer * e.inflate };
    }
    return undefined;
  }

  /** 처치 뒤 (불덩이·황금) */
  onKill(e: Enemy, depth: number, exploded: boolean): void {
    const w = this.w;
    const E = BALANCE.experiment;
    if (this.r.bouncer && exploded && e.def.deathBlast && !e.def.boss && this.balls.length < E.bouncer.max) {
      const a = -Math.PI / 2 + w.rng.range(-0.9, 0.9);
      this.balls.push({ x: e.x, y: e.y, vx: Math.cos(a) * E.bouncer.speed, vy: Math.sin(a) * E.bouncer.speed, ttl: E.bouncer.ttl });
    }
    if (e.golden) {
      const ok = depth >= 1;
      w.emit({ type: 'golden', x: e.x, y: e.y, ok });
      if (ok) w.goldenReward();
    }
  }

  // ─── 매 스텝 ───────────────────────────────────────────

  /** 무리·혼자 움직이는 적에 더할 좌우 속도 (바람) */
  windAt(): number {
    return this.r.wind ? this.wind : 0;
  }

  /** 명당 띠 윗변 y */
  sweetTop(): number {
    const S = BALANCE.experiment.sweet;
    const t = 0.5 - 0.5 * Math.cos((this.w.time / S.period) * Math.PI * 2);
    return S.top + (S.bottom - S.top - S.height) * t;
  }

  /** dt 는 timeScale 이 곱해진 시간 */
  update(dt: number): void {
    const w = this.w;
    const E = BALANCE.experiment;
    if (this.r.wind) this.wind = E.wind.speed * Math.sin((w.time / E.wind.period) * Math.PI * 2);
    if (this.r.beat) {
      const b = Math.floor(w.time / E.beat.period);
      if (b !== this.lastBeat) {
        this.lastBeat = b;
        w.emit({ type: 'beat' });
      }
    }
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.frozen > 0) e.frozen = Math.max(0, e.frozen - dt);
    }
    if (this.r.burn || this.r.chaos) this.updateBurn(dt);
    if (this.r.magnet) this.updateMagnet(dt);
    if (this.r.seeds) {
      for (const s of this.seeds) s.ttl -= dt;
      for (let i = this.seeds.length - 1; i >= 0; i--) if (this.seeds[i].ttl <= 0) this.seeds.splice(i, 1);
    }
    if (this.balls.length > 0) this.updateBalls(dt);
  }

  private updateBurn(dt: number): void {
    const w = this.w;
    const B = BALANCE.experiment.burn;
    this.burnTimer += dt;
    this.spreadTimer += dt;
    let burning = 0;
    for (const e of w.enemies) {
      if (e.dead || e.burn <= 0) continue;
      burning++;
      e.burn = Math.max(0, e.burn - dt);
    }
    if (burning === 0) {
      this.burnTimer = this.spreadTimer = 0;
      return;
    }
    if (this.spreadTimer >= B.spreadEvery) {
      this.spreadTimer -= B.spreadEvery;
      const lit: Enemy[] = [];
      for (const e of w.enemies) {
        if (e.dead || e.burn <= 0) continue;
        for (const o of w.enemiesNear(e.x, e.y, e.radius + B.spreadGap)) if (o.burn <= 0 && !o.def.boss) lit.push(o);
      }
      for (const o of lit) o.burn = B.sec;
    }
    if (this.burnTimer >= BURN_TICK) {
      this.burnTimer -= BURN_TICK;
      let chainId = -1;
      const dmg = B.dps * w.stats.tapDamage * BURN_TICK;
      for (const e of [...w.enemies]) {
        if (e.dead || e.burn <= 0) continue;
        if (chainId < 0) chainId = w.newChain(1);
        w.hitFromExp(e, dmg, chainId, 0);
      }
    }
  }

  private updateMagnet(dt: number): void {
    const w = this.w;
    const M = BALANCE.experiment.magnet;
    for (const m of w.enemies) {
      if (m.dead || !m.def.deathBlast || m.def.boss || m.y < 0) continue;
      for (const o of w.enemiesNear(m.x, m.y, M.range)) {
        if (o === m || o.def.boss || o.def.deathBlast || o.frozen > 0 || o.pileCol >= 0) continue;
        const dx = m.x - o.x;
        const dy = m.y - o.y;
        const d = Math.hypot(dx, dy);
        const gap = d - (m.radius + o.radius + 2);
        if (gap <= 0) continue;
        const step = Math.min(gap, M.pull * dt);
        const ux = (dx / d) * step;
        const uy = (dy / d) * step;
        if (o.pack) {
          o.packOx += ux;
          o.packOy += uy;
        }
        o.x += ux;
        o.y += uy;
      }
    }
  }

  private updateBalls(dt: number): void {
    const w = this.w;
    const B = BALANCE.experiment.bouncer;
    const W = w.field.width;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.ttl -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 4 && b.vx < 0) b.vx = -b.vx;
      if (b.x > W - 4 && b.vx > 0) b.vx = -b.vx;
      if (b.y < 4 && b.vy < 0) b.vy = -b.vy;
      let boom = b.ttl <= 0 || b.y > w.field.defenseLineY;
      if (!boom && w.enemiesNear(b.x, b.y, BALL_HIT_R).length > 0) boom = true;
      if (!boom) continue;
      this.balls.splice(i, 1);
      if (b.y > w.field.defenseLineY) continue;
      w.spawnExplosion({ x: b.x, y: b.y, radius: B.radius, damage: B.charge * w.stats.tapDamage, chainId: w.newChain(1), source: 'exp' });
    }
  }
}
