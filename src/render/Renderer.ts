import { BALANCE } from '../data/balance';
import { getEnemyDef } from '../data/lookup';
import type { EnemyShape } from '../data/enemies';
import { TAU, clamp } from '../core/math';
import type { SimEvent } from '../sim/events';
import type { Enemy } from '../sim/types';
import type { World } from '../sim/World';
import { Bolts, DamageNumbers, GlowCache, Particles, Rings, Shake } from './fx/effects';
import { CHAIN_COLORS, COLORS, chainColor, rgba } from './palette';

const FW = BALANCE.field.width;
const FH = BALANCE.field.height;
const LINE_Y = BALANCE.field.defenseLineY;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';
/** 한 프레임에 새로 만들 수 있는 파티클 상한 (기획서: 파티클 상한) */
const PARTICLE_BUDGET_PER_FRAME = 220;

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Canvas2D 렌더러. sim 상태를 읽어서 그리기만 한다 (sim 을 바꾸지 않음).
 * 일회성 연출(폭발 링, 파티클, 숫자, 흔들림)은 consume(events) 로 받은 이벤트에서 만든다.
 *
 * 성능 메모: 지금은 Canvas2D + 글로우 스프라이트 + 가산 합성. 실기기에서 후반 프레임이 부족하면
 * 이 클래스만 WebGL(PixiJS 등)로 교체하면 된다. sim·UI 는 렌더러를 모른다.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private bg: HTMLCanvasElement | null = null;

  private readonly glow = new GlowCache();
  private readonly rings = new Rings(280);
  private readonly particles = new Particles(1400);
  private readonly numbers = new DamageNumbers(48);
  private readonly bolts = new Bolts(64);
  private readonly shake = new Shake();
  private particleBudget = PARTICLE_BUDGET_PER_FRAME;

  private edge = 0;
  private edgeColor: string = CHAIN_COLORS[CHAIN_COLORS.length - 1];
  private leakFlash = 0;
  private whiteFlash = 0;
  private levelFlash = 0;
  private banner: { text: string; sub: string; color: string; t: number; life: number } | null = null;
  private chainShown = 0;
  private chainPop = 0;
  private chainResult = { kills: 0, t: 0 };
  private ambientTimer = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2D 를 쓸 수 없습니다');
    this.ctx = ctx;
    this.resize();
  }

  // ─── 화면 맞춤 ─────────────────────────────────────────────

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.scale = Math.min(w / FW, h / FH);
    this.ox = (w - FW * this.scale) / 2;
    this.oy = (h - FH * this.scale) / 2;
    this.bg = null;
  }

  viewport(): Viewport {
    return { left: this.ox, top: this.oy, width: FW * this.scale, height: FH * this.scale, scale: this.scale };
  }

  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (clientX - rect.left - this.ox) / this.scale, y: (clientY - rect.top - this.oy) / this.scale };
  }

  reset(): void {
    this.rings.clear();
    this.particles.clear();
    this.numbers.clear();
    this.bolts.clear();
    this.shake.trauma = 0;
    this.edge = this.leakFlash = this.whiteFlash = this.levelFlash = 0;
    this.banner = null;
    this.chainShown = this.chainPop = 0;
    this.chainResult = { kills: 0, t: 0 };
  }

  /** 슬로모션과 함께 화면 가장자리 발광 */
  edgeFlash(chainKills: number): void {
    this.edge = 1;
    this.edgeColor = chainColor(chainKills);
  }

  // ─── 이벤트 → 연출 ─────────────────────────────────────────

  consume(events: readonly SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'explosion':
          this.onExplosion(e);
          break;
        case 'hit':
          this.numbers.add(e.x, e.y - 8, e.amount, e.crit);
          break;
        case 'kill': {
          const def = getEnemyDef(e.kind);
          this.burst(e.x, e.y, e.boss ? 40 : 6, def.color, 40, e.boss ? 260 : 150, 0.45);
          break;
        }
        case 'shieldBreak':
          this.rings.add(e.x, e.y, 8, 24, '#3cf0e0', 0.25, 2);
          this.burst(e.x, e.y, 6, '#3cf0e0', 60, 160, 0.3);
          break;
        case 'dryTap':
          this.rings.add(e.x, e.y, 4, 16, '#555a70', 0.2, 1.5);
          break;
        case 'leak':
          this.leakFlash = 1;
          this.shake.add(0.35);
          break;
        case 'bolt':
          this.bolts.add(e.x1, e.y1, e.x2, e.y2, e.kind === 'lightning' ? '#9fe8ff' : '#ffd36b', e.kind === 'lightning' ? 0.22 : 0.12);
          break;
        case 'chainEnd':
          if (e.kills >= 5) this.chainResult = { kills: e.kills, t: 1 };
          break;
        case 'wave':
          this.showBanner(`WAVE ${e.wave}`, '', COLORS.text);
          break;
        case 'bossSpawn':
          this.showBanner(e.final ? 'FINAL BOSS' : 'BOSS', getEnemyDef(e.id).boss?.title ?? '', COLORS.boss);
          this.shake.add(0.3);
          break;
        case 'bossSummon':
          this.rings.add(e.x, e.y, 10, 60, '#ffe14d', 0.4, 2);
          break;
        case 'bossKill':
          this.shake.add(0.9);
          this.whiteFlash = 1;
          this.showBanner(e.final ? 'CLEAR' : 'BOSS DOWN', '', COLORS.gold);
          break;
        case 'levelUp':
          this.levelFlash = 1;
          break;
        default:
          break;
      }
    }
  }

  private onExplosion(e: Extract<SimEvent, { type: 'explosion' }>): void {
    const s = e.source;
    const big = s === 'supernova';
    const minor = s === 'fission' || s === 'shard' || s === 'lightning';
    const color =
      s === 'tap' ? '#e8fbff'
      : big ? '#ffffff'
      : s === 'mine' ? '#ff9a3c'
      : s === 'lightning' ? '#9fe8ff'
      : s === 'shard' ? COLORS.gold
      : chainColor(e.chainKills);
    this.rings.add(e.x, e.y, e.radius * 0.25, e.radius, color, big ? 0.6 : minor ? 0.22 : 0.32, big ? 4 : s === 'tap' ? 2.5 : 2);
    this.burst(e.x, e.y, big ? 36 : s === 'tap' ? 10 : minor ? 2 : 5, color, 40, big ? 380 : 90 + e.radius * 2.4, big ? 0.7 : 0.4);
    if (e.crit) this.rings.add(e.x, e.y, e.radius, e.radius * 1.25, COLORS.gold, 0.3, 1.5);
    // 흔들림은 폭발 크기에 비례 (연쇄는 작게, 많이 쌓이면 커짐)
    this.shake.add(big ? 0.7 : s === 'tap' ? 0.12 : s === 'mine' ? 0.15 : 0.025 * (e.radius / BALANCE.chain.radius));
  }

  private burst(x: number, y: number, count: number, color: string, vmin: number, vmax: number, life: number): void {
    const n = Math.min(count, this.particleBudget);
    if (n <= 0) return;
    this.particleBudget -= n;
    this.particles.burst(x, y, n, color, vmin, vmax, life);
  }

  private showBanner(text: string, sub: string, color: string): void {
    this.banner = { text, sub, color, t: 0, life: 1.4 };
  }

  // ─── 그리기 ────────────────────────────────────────────────

  draw(world: World | null, realDt: number): void {
    const dt = realDt;
    this.particleBudget = PARTICLE_BUDGET_PER_FRAME;
    this.rings.update(dt);
    this.particles.update(dt);
    this.numbers.update(dt);
    this.bolts.update(dt);
    this.shake.update(dt);
    this.edge = Math.max(0, this.edge - dt * 1.6);
    this.leakFlash = Math.max(0, this.leakFlash - dt * 2.5);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 3);
    this.levelFlash = Math.max(0, this.levelFlash - dt * 2);
    this.chainPop = Math.max(0, this.chainPop - dt * 6);
    this.chainResult.t = Math.max(0, this.chainResult.t - dt);
    if (!world) this.ambient(dt);

    const ctx = this.ctx;
    const k = this.dpr * this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLORS.letterbox;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 월드 레이어 (흔들림 적용)
    const [sx, sy] = this.shake.offset(7);
    ctx.setTransform(k, 0, 0, k, this.dpr * this.ox + sx * k, this.dpr * this.oy + sy * k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FW, FH);
    ctx.clip();
    if (!this.bg) this.bg = this.buildBackground();
    ctx.drawImage(this.bg, 0, 0, FW, FH);
    this.drawDefenseLine();

    if (world) {
      this.drawZones(world);
      this.drawMines(world);
      for (const e of world.enemies) if (!e.dead) this.drawEnemy(e, world.time);
      this.drawHold(world);
    }

    ctx.globalCompositeOperation = 'lighter';
    this.rings.draw(ctx, this.glow);
    this.particles.draw(ctx);
    this.bolts.draw(ctx);
    ctx.globalCompositeOperation = 'source-over';
    this.numbers.draw(ctx, FONT);
    ctx.restore();

    // HUD 레이어 (흔들림 없음)
    ctx.setTransform(k, 0, 0, k, this.dpr * this.ox, this.dpr * this.oy);
    this.drawScreenFx();
    if (world) this.drawHud(world, dt);
  }

  private buildBackground(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const k = this.scale * this.dpr;
    c.width = Math.max(1, Math.ceil(FW * k));
    c.height = Math.max(1, Math.ceil(FH * k));
    const g = c.getContext('2d')!;
    g.scale(k, k);
    g.fillStyle = COLORS.bg;
    g.fillRect(0, 0, FW, FH);
    const rad = g.createRadialGradient(FW / 2, FH * 0.38, 30, FW / 2, FH * 0.45, FH * 0.75);
    rad.addColorStop(0, 'rgba(60, 40, 120, 0.28)');
    rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = rad;
    g.fillRect(0, 0, FW, FH);
    g.strokeStyle = COLORS.grid;
    g.lineWidth = 0.6;
    g.beginPath();
    for (let x = 0; x <= FW; x += 30) {
      g.moveTo(x, 0);
      g.lineTo(x, LINE_Y);
    }
    for (let y = 0; y <= LINE_Y; y += 30) {
      g.moveTo(0, y);
      g.lineTo(FW, y);
    }
    g.stroke();
    // 각진 장식
    g.strokeStyle = 'rgba(110, 130, 255, 0.16)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 70); g.lineTo(18, 52); g.lineTo(80, 52);
    g.moveTo(FW, 70); g.lineTo(FW - 18, 52); g.lineTo(FW - 80, 52);
    g.stroke();
    g.fillStyle = 'rgba(0, 0, 0, 0.4)';
    g.fillRect(0, LINE_Y, FW, FH - LINE_Y);
    return c;
  }

  private drawDefenseLine(): void {
    const ctx = this.ctx;
    const a = 0.55 + this.leakFlash * 0.45;
    const grad = ctx.createLinearGradient(0, LINE_Y - 60, 0, LINE_Y);
    grad.addColorStop(0, rgba(COLORS.line, 0));
    grad.addColorStop(1, rgba(COLORS.line, 0.1 + this.leakFlash * 0.35));
    ctx.fillStyle = grad;
    ctx.fillRect(0, LINE_Y - 60, FW, 60);
    ctx.strokeStyle = rgba(COLORS.line, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, LINE_Y);
    ctx.lineTo(FW, LINE_Y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(COLORS.line, 0.25);
    ctx.beginPath();
    for (let x = 6; x < FW; x += 24) {
      ctx.moveTo(x, LINE_Y + 4);
      ctx.lineTo(x + 10, LINE_Y + 4);
    }
    ctx.stroke();
  }

  private drawZones(w: World): void {
    if (w.zones.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const sprite = this.glow.get('#ff7a3c');
    for (const z of w.zones) {
      const k = clamp(z.ttl / z.maxTtl, 0, 1);
      ctx.globalAlpha = 0.25 + 0.35 * k;
      const s = z.radius * 2.4;
      ctx.drawImage(sprite, z.x - s / 2, z.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawMines(w: World): void {
    const ctx = this.ctx;
    for (const m of w.mines) {
      const armed = m.armIn <= 0;
      const blink = armed && Math.floor(w.time * 4) % 2 === 0;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(w.time * 2);
      polygon(ctx, 4, 6, 0);
      ctx.fillStyle = rgba('#ff9a3c', blink ? 0.9 : 0.3);
      ctx.fill();
      ctx.strokeStyle = '#ff9a3c';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEnemy(e: Enemy, t: number): void {
    const ctx = this.ctx;
    const d = e.def;
    const r = e.radius;
    const flash = t - e.lastHitAt < 0.06;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (d.boss) ctx.rotate(t * 0.4);
    shapePath(ctx, d.shape, r);
    ctx.fillStyle = rgba(d.color, flash ? 0.65 : 0.16);
    ctx.fill();
    ctx.lineWidth = d.mark === 'thick' ? 3.2 : 1.6;
    ctx.strokeStyle = flash ? '#ffffff' : d.color;
    ctx.stroke();
    if (d.mark === 'dot') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, TAU);
      ctx.fillStyle = d.color;
      ctx.fill();
    }
    if (d.boss) {
      ctx.rotate(-t * 1.2);
      shapePath(ctx, 'diamond', r * 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    if (e.shield > 0) {
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 5, 0, TAU);
      ctx.strokeStyle = rgba('#3cf0e0', 0.85);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawHold(w: World): void {
    if (!w.hold) return;
    const ctx = this.ctx;
    const S = BALANCE.prism.supernova;
    const c = w.holdCharge();
    const n = Math.max(1, Math.floor(w.charges));
    const radius = w.stats.tapRadius * (1 + S.radiusPerCharge * c) * (1 + S.radiusPerExtraCharge * (n - 1));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + 0.5 * c;
    const s = radius * 2;
    ctx.drawImage(this.glow.get('#e8fbff'), w.hold.x - s / 2, w.hold.y - s / 2, s, s);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#e8fbff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(w.hold.x, w.hold.y, radius, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w.hold.x, w.hold.y, 18, -Math.PI / 2, -Math.PI / 2 + TAU * c);
    ctx.stroke();
    ctx.restore();
  }

  private drawScreenFx(): void {
    const ctx = this.ctx;
    if (this.edge > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = 28;
      const c = this.edgeColor;
      const a = this.edge * 0.75;
      const edges: [number, number, number, number, number, number, number, number][] = [
        [0, 0, g, 0, 0, 0, g, FH],
        [FW, 0, FW - g, 0, FW - g, 0, g, FH],
        [0, 0, 0, g, 0, 0, FW, g],
        [0, FH, 0, FH - g, 0, FH - g, FW, g],
      ];
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, rgba(c, a));
        grad.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(rx, ry, rw, rh);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.whiteFlash * 0.35})`;
      ctx.fillRect(0, 0, FW, FH);
    }
  }

  private drawHud(w: World, dt: number): void {
    const ctx = this.ctx;
    ctx.textBaseline = 'alphabetic';

    // LIFE
    for (let i = 0; i < w.stats.maxLife; i++) {
      ctx.save();
      ctx.translate(16 + i * 15, 20);
      polygon(ctx, 4, 5.5, 0);
      if (i < w.life) {
        ctx.fillStyle = COLORS.life;
        ctx.fill();
      } else {
        ctx.strokeStyle = rgba(COLORS.life, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 레벨 / 웨이브
    ctx.font = `800 12px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText(`LV ${w.level}`, FW / 2, 24);
    ctx.textAlign = 'right';
    const waveText = w.finalBossSpawned
      ? 'FINAL'
      : w.config.mode === 'endless'
        ? `WAVE ${w.wave}`
        : `WAVE ${w.wave}/${w.chapter.waves}`;
    ctx.fillText(waveText, FW - 48, 24);
    if (!w.finalBossSpawned) {
      const p = clamp(w.waveTimer / BALANCE.wave.durationSec, 0, 1);
      ctx.fillStyle = rgba(COLORS.text, 0.15);
      ctx.fillRect(FW - 48 - 64, 28, 64, 2);
      ctx.fillStyle = rgba(COLORS.text, 0.6);
      ctx.fillRect(FW - 48 - 64, 28, 64 * p, 2);
    }

    // 경험치
    const xpP = clamp(w.xp / w.xpNeeded, 0, 1);
    ctx.fillStyle = rgba(COLORS.xp, 0.18);
    ctx.fillRect(12, 36, FW - 24, 3);
    ctx.fillStyle = this.levelFlash > 0 ? '#e6c8ff' : COLORS.xp;
    ctx.fillRect(12, 36, (FW - 24) * xpP, 3);

    // 보스 HP
    const boss = w.activeBoss();
    if (boss) {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.boss;
      ctx.fillText(`${boss.isFinalBoss ? 'FINAL · ' : ''}${boss.def.boss?.title ?? boss.def.name}`, 12, 54);
      ctx.fillStyle = rgba(COLORS.boss, 0.2);
      ctx.fillRect(12, 58, FW - 24, 5);
      ctx.fillStyle = COLORS.boss;
      ctx.fillRect(12, 58, (FW - 24) * clamp(boss.hp / boss.maxHp, 0, 1), 5);
    }

    // 연쇄 카운터
    const cur = w.currentChain();
    if (cur > this.chainShown) this.chainPop = 1;
    this.chainShown = cur;
    if (cur >= 3) this.drawChainCounter(cur, 1, 1 + w.stats.chainMultiplierPerKill * cur);
    else if (this.chainResult.t > 0) this.drawChainCounter(this.chainResult.kills, this.chainResult.t, 1 + w.stats.chainMultiplierPerKill * this.chainResult.kills);

    // 배너
    if (this.banner) {
      const b = this.banner;
      b.t += dt;
      const p = b.t / b.life;
      if (p >= 1) this.banner = null;
      else {
        ctx.globalAlpha = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
        ctx.textAlign = 'center';
        ctx.font = `900 30px ${FONT}`;
        ctx.fillStyle = b.color;
        ctx.fillText(b.text, FW / 2, 250);
        if (b.sub) {
          ctx.font = `700 13px ${FONT}`;
          ctx.fillStyle = COLORS.text;
          ctx.fillText(b.sub, FW / 2, 272);
        }
        ctx.globalAlpha = 1;
      }
    }

    this.drawCharges(w);
  }

  private drawChainCounter(kills: number, alpha: number, mult: number): void {
    const ctx = this.ctx;
    const color = chainColor(kills);
    ctx.save();
    ctx.translate(FW / 2, 122);
    const s = 1 + this.chainPop * 0.22;
    ctx.scale(s, s);
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = `900 46px ${FONT}`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(String(kills), 0, 0);
    ctx.shadowBlur = 0;
    ctx.font = `800 11px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText(`CHAIN  ×${mult.toFixed(2)}`, 0, 16);
    ctx.restore();
  }

  private drawCharges(w: World): void {
    const ctx = this.ctx;
    const n = w.stats.maxCharges;
    const gap = 28;
    const x0 = FW / 2 - ((n - 1) * gap) / 2;
    const y = 600;
    const full = Math.floor(w.charges);
    const partial = w.charges < n ? w.rechargeTimer / w.stats.rechargeSec : 0;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap;
      ctx.save();
      ctx.translate(x, y);
      polygon(ctx, 6, 10, Math.PI / 6);
      ctx.strokeStyle = rgba(COLORS.charge, i < full ? 1 : 0.35);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (i < full) {
        ctx.fillStyle = rgba(COLORS.charge, 0.85);
        ctx.fill();
      } else if (i === full && partial > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 6, -Math.PI / 2, -Math.PI / 2 + TAU * partial);
        ctx.strokeStyle = COLORS.charge;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dim;
    const label =
      w.stats.inputMode === 'supernova' ? 'HOLD & RELEASE'
      : w.stats.freeTapDuringChain && w.explosions.length > 0 ? 'FREE TAP'
      : 'CHARGE';
    ctx.fillText(label, FW / 2, y + 24);
  }

  /** 타이틀 화면 배경: 가끔 연쇄처럼 번지는 폭발 */
  private ambient(dt: number): void {
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 0.25 + Math.random() * 0.5;
    const x = 30 + Math.random() * (FW - 60);
    const y = 80 + Math.random() * (LINE_Y - 160);
    const step = Math.floor(Math.random() * 28);
    this.rings.add(x, y, 10, 30 + Math.random() * 40, chainColor(step), 0.6, 1.5);
    this.burst(x, y, 4, chainColor(step), 20, 90, 0.6);
  }
}

// ─── 도형 ────────────────────────────────────────────────────

function polygon(ctx: CanvasRenderingContext2D, sides: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (TAU * i) / sides;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** 색맹 대응: 적 종류마다 모양이 다르다 */
function shapePath(ctx: CanvasRenderingContext2D, shape: EnemyShape, r: number): void {
  switch (shape) {
    case 'square':
      ctx.beginPath();
      ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'octagon':
      polygon(ctx, 8, r, Math.PI / 8);
      break;
    case 'triangle':
      // 아래(방어선)를 향한 삼각형 = 돌진
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.lineTo(-r * 0.92, -r * 0.7);
      ctx.lineTo(r * 0.92, -r * 0.7);
      ctx.closePath();
      break;
    case 'diamond':
      polygon(ctx, 4, r, -Math.PI / 2);
      break;
    case 'hexagon':
      polygon(ctx, 6, r, 0);
      break;
  }
}
