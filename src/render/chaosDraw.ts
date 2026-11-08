import { BALANCE } from '../data/balance';
import { ARMS, CATEGORY_COLOR, chaosEvent, hasRange, type ChaosEventId, type GunLook } from '../data/chaos';
import { TAU, clamp } from '../core/math';
import type { Actor } from '../sim/chaos';
import type { SimEvent } from '../sim/events';
import type { World } from '../sim/World';
import type { GlowCache } from './fx/effects';
import { COLORS, rgba } from './palette';

const FW = BALANCE.field.width;
const FH = BALANCE.field.height;
const LINE_Y = BALANCE.field.defenseLineY;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const SLOT_SPIN = ['🦖', '🐄', '☄️', '🛸', '🐑', '🍌', '7️⃣', '🍒', '💎'];
const BUFF_TEXT: Record<string, string> = {
  frenzy: 'FRENZY! 피해 ×3',
  clickFrenzy: 'CLICK FRENZY! 게이지 무한',
  lucky: 'LUCKY! 레벨 업',
  meteor: '운석 소환!',
};

/** 이모지 한 글자를 64px 캔버스에 한 번만 그려 두고 늘려 쓴다 (매 프레임 글꼴 그리기보다 빠름) */
class EmojiCache {
  private readonly map = new Map<string, HTMLCanvasElement>();

  get(e: string): HTMLCanvasElement {
    let c = this.map.get(e);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 72;
      const g = c.getContext('2d')!;
      g.font = `56px ${EMOJI_FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(e, 36, 40);
      this.map.set(e, c);
    }
    return c;
  }
}

interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
}

interface Pop {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

/**
 * 도파민 모드 그리기: 난입 물체(이모지), 설치물, 곱하기 게이트, 피버 테두리, 황금 쿠키, 잭팟, 큰 글씨.
 * sim 상태(w.chaos)를 읽기만 한다.
 */
export class ChaosDraw {
  private readonly emoji = new EmojiCache();
  private banners: Banner[] = [];
  private pops: Pop[] = [];
  private flash = 0;
  private time = 0;
  /** 총구 불꽃·탄피 */
  private flashes: { x: number; y: number; a: number; t: number; big: boolean }[] = [];
  private casings: { x: number; y: number; vx: number; vy: number; r: number; t: number }[] = [];

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly glow: GlowCache,
  ) {}

  reset(): void {
    this.banners = [];
    this.pops = [];
    this.flash = 0;
    this.flashes = [];
    this.casings = [];
  }

  consume(e: SimEvent): void {
    switch (e.type) {
      case 'chaos': {
        const def = chaosEvent(e.id as ChaosEventId);
        this.banner(`${def.emoji} ${def.name}!`, '', COLORS.gold);
        break;
      }
      case 'fever':
        if (e.on) this.banner('🔥 FEVER TIME 🔥', '탭이 두 배로 세지고 게이지가 세 배로 찬다', '#ff3cc8');
        break;
      case 'cookie':
        this.pop(e.x, e.y - 24, BUFF_TEXT[e.buff] ?? e.buff, COLORS.gold);
        this.banner('🍪 황금 쿠키!', BUFF_TEXT[e.buff] ?? '', COLORS.gold);
        break;
      case 'slot':
        if (e.reels[0] === e.reels[1] && e.reels[1] === e.reels[2]) {
          this.banner(e.reels[0] === '7️⃣' ? '7️⃣7️⃣7️⃣ JACKPOT!!!' : `${e.reels.join('')} 트리플!`, e.reels[0] === '7️⃣' ? '화면 전체 폭파' : '두 번 난입', COLORS.gold);
        }
        break;
      case 'nuke':
        this.flash = 1;
        break;
      case 'gate':
        this.pop(e.x, e.y - 14, `×${e.mult}`, '#4dd2ff');
        break;
      case 'magic': {
        const spec = ARMS[e.id];
        if (spec) this.banner(`${spec.emoji} ${spec.name}!`, '', '#c77dff');
        break;
      }
      case 'augment': {
        const spec = ARMS[e.id];
        if (spec?.fusion) {
          const [a, b] = spec.fusion.map((id) => ARMS[id]);
          this.banner(`⚡ 융합! ${spec.emoji} ${spec.name}`, `${a.emoji} ${a.name} + ${b.emoji} ${b.name}`, '#ff3cc8');
          this.flash = 0.5;
        }
        break;
      }
      case 'gunFire':
        if (this.flashes.length < 40) this.flashes.push({ x: e.x, y: e.y, a: e.angle, t: 0, big: e.big });
        if (this.casings.length < 60) {
          const side = Math.cos(e.angle) >= 0 ? -1 : 1;
          this.casings.push({ x: e.x - Math.cos(e.angle) * 10, y: e.y - Math.sin(e.angle) * 10, vx: side * (40 + Math.random() * 40), vy: -60 - Math.random() * 40, r: Math.random() * 6, t: 0 });
        }
        break;
      default:
        break;
    }
  }

  private banner(text: string, sub: string, color: string): void {
    this.banners.push({ text, sub, color, t: 0 });
    if (this.banners.length > 3) this.banners.shift();
  }

  private pop(x: number, y: number, text: string, color: string): void {
    this.pops.push({ x, y, text, color, t: 0 });
    if (this.pops.length > 16) this.pops.shift();
  }

  update(dt: number): void {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 1.5);
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter((b) => b.t < 1.6);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 0.8);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.06);
    for (const c of this.casings) {
      c.t += dt;
      c.vy += 400 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.r += dt * 12;
    }
    this.casings = this.casings.filter((c) => c.t < 0.5);
  }

  private icon(e: string, x: number, y: number, size: number, flip = false, rot = 0, alpha = 1): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.emoji.get(e), -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  /** 적 아래: 설치물·대포·게이트 */
  drawUnder(w: World): void {
    const c = w.chaos;
    if (!c) return;
    const ctx = this.ctx;
    // 무기 받침: 방어선 바로 뒤 한 줄 (넘친 줄은 방어선 위)
    const mounts = c.allMounts();
    if (mounts.length > 0) {
      ctx.fillStyle = 'rgba(20, 24, 40, 0.75)';
      ctx.fillRect(0, LINE_Y + 4, FW, 26);
      ctx.strokeStyle = rgba(COLORS.gold, 0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, LINE_Y + 30);
      ctx.lineTo(FW, LINE_Y + 30);
      ctx.stroke();
    }
    const sel = c.selected && c.selected.until > w.time ? c.selected.id : null;
    for (const { id, m } of mounts) {
      const spec = ARMS[id];
      const L = w.augments.stacks(id);
      const glowCol = spec.fusion ? '#ff3cc8' : CATEGORY_COLOR[spec.cat];
      if (spec.fusion) {
        // 융합 무기: 무지개빛 고리
        ctx.beginPath();
        ctx.arc(m.x, m.y, 13, 0, TAU);
        ctx.strokeStyle = `hsla(${(this.time * 200 + m.x) % 360}, 100%, 65%, 0.9)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (id === sel) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 15, 0, TAU);
        ctx.strokeStyle = rgba(COLORS.charge, 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (m.wall !== 0 && spec.p.look) {
        this.gun(spec.p.look, m.x, m.y, c.aim.get(id) ?? -Math.PI / 2, 0, w.time - (c.firedAt.get(id) ?? -9));
      } else {
        const bob = spec.cat === 'magic' ? Math.sin(this.time * 2 + m.x) * 2 : 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22;
        ctx.drawImage(this.glow.get(glowCol), m.x - 14, m.y - 14 + bob, 28, 28);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.icon(spec.emoji, m.x, m.y + bob, 19);
      }
      this.pips(m.x, m.y + 12, L);
    }
    const g = c.gate;
    if (g) {
      const x0 = g.x - g.w / 2;
      const grad = ctx.createLinearGradient(0, g.y - 10, 0, g.y + 10);
      grad.addColorStop(0, 'rgba(77, 210, 255, 0)');
      grad.addColorStop(0.5, 'rgba(77, 210, 255, 0.35)');
      grad.addColorStop(1, 'rgba(77, 210, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x0, g.y - 10, g.w, 20);
      ctx.strokeStyle = '#4dd2ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0, g.y - 10, g.w, 20);
      ctx.font = `900 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#e8fbff';
      ctx.fillText(`×${g.mult}`, g.x, g.y + 1);
      ctx.textBaseline = 'alphabetic';
    }
  }

  private pips(x: number, y: number, n: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.gold;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(x - (n - 1) * 2.5 + i * 5, y, 1.6, 0, TAU);
      ctx.fill();
    }
  }

  /** 벽에 붙은 총: 받침대 + 겨누는 총 (모양은 GunLook) + 총구 불꽃 */
  private gun(look: GunLook, x: number, y: number, ang: number, wall: number, since: number): void {
    const ctx = this.ctx;
    // 받침대 (아래 반원)
    ctx.beginPath();
    ctx.arc(x, y + 5 + wall * 0, 7, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = '#20232f';
    ctx.fill();
    ctx.strokeStyle = '#4a4f63';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // 위아래가 뒤집히지 않게 (왼쪽을 겨누면 거울)
    if (Math.cos(ang) < 0) ctx.scale(1, -1);
    // 반동: 쏜 직후 살짝 뒤로
    const kick = since < 0.06 ? -2.5 * (1 - since / 0.06) : 0;
    ctx.translate(kick, 0);
    const c = look.color;
    ctx.fillStyle = c;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 0.8;
    // 개머리판
    if (look.stock) {
      ctx.beginPath();
      ctx.moveTo(-look.body / 2, -look.bh / 2);
      ctx.lineTo(-look.body / 2 - 7, -look.bh / 2 + 1);
      ctx.lineTo(-look.body / 2 - 7, look.bh / 2 + 2);
      ctx.lineTo(-look.body / 2, look.bh / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 몸통
    ctx.fillRect(-look.body / 2, -look.bh / 2, look.body, look.bh);
    ctx.strokeRect(-look.body / 2, -look.bh / 2, look.body, look.bh);
    // 손잡이
    ctx.fillRect(-look.body / 2 + 1, look.bh / 2 - 1, 3, 5);
    // 탄창
    if (look.mag) ctx.fillRect(1, look.bh / 2 - 1, 3, 6);
    // 연료통
    if (look.tank) {
      ctx.beginPath();
      ctx.arc(-1, look.bh / 2 + 3, 3.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // 총열
    const x0 = look.body / 2;
    const barrels = look.barrels ?? 1;
    for (let i = 0; i < barrels; i++) {
      const off = barrels > 1 ? (i - (barrels - 1) / 2) * (look.bw / barrels) * 1.2 + Math.sin(this.time * 40 + i) * 0.5 : 0;
      ctx.fillStyle = look.tube ? c : '#2a2e3a';
      ctx.fillRect(x0, off - (barrels > 1 ? 1 : look.bw / 2), look.len, barrels > 1 ? 2 : look.bw);
      ctx.strokeRect(x0, off - (barrels > 1 ? 1 : look.bw / 2), look.len, barrels > 1 ? 2 : look.bw);
    }
    // 조준경
    if (look.scope) {
      ctx.fillStyle = '#15171f';
      ctx.fillRect(-2, -look.bh / 2 - 4, 10, 3.5);
    }
    // 에너지 무기 빛
    if (look.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.time * 6);
      ctx.fillStyle = look.glow;
      ctx.fillRect(-look.body / 2 + 2, -1, look.body - 4, 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  private cannon(x: number, y: number, dir: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#3a3f55';
    ctx.fillRect(-2, -5, 22, 10);
    ctx.strokeStyle = '#8a90a8';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-2, -5, 22, 10);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y + 4, 7, 0, TAU);
    ctx.fillStyle = '#2a2e40';
    ctx.fill();
    ctx.stroke();
  }

  /** 적 위: 난입 물체 */
  drawActors(w: World): void {
    const c = w.chaos;
    if (!c) return;
    const ctx = this.ctx;
    for (const a of c.actors) if (a.t >= 0) this.actor(a, ctx);
    // 총구 불꽃
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flashes) {
      const s = (f.big ? 22 : 14) * (1 - f.t / 0.06);
      ctx.drawImage(this.glow.get('#ffd36b'), f.x - s / 2, f.y - s / 2, s, s);
      ctx.strokeStyle = rgba('#fff7d0', 0.9);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(f.a) * s * 0.7, f.y + Math.sin(f.a) * s * 0.7);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // 탄피
    ctx.fillStyle = '#e8b04a';
    for (const cs of this.casings) {
      ctx.save();
      ctx.translate(cs.x, cs.y);
      ctx.rotate(cs.r);
      ctx.globalAlpha = 1 - cs.t / 0.5;
      ctx.fillRect(-1.5, -0.8, 3, 1.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.drawSelected(w);
    for (const p of this.pops) {
      const k = p.t / 0.8;
      ctx.globalAlpha = 1 - k;
      ctx.font = `900 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - k * 18);
    }
    ctx.globalAlpha = 1;
  }

  /** 눌러서 고른 무기: 사거리 원(총·포탑) 또는 "화면 전체", 그리고 이름·레벨·다음 레벨 효과 */
  private drawSelected(w: World): void {
    const c = w.chaos!;
    const sel = c.selected;
    if (!sel || sel.until <= w.time) return;
    const m = c.mountOf(sel.id);
    const spec = ARMS[sel.id];
    if (!m || !spec) return;
    const ctx = this.ctx;
    const fade = clamp((sel.until - w.time) / 0.4, 0, 1);
    const ranged = hasRange(spec.cat);
    const range = c.rangeOf(spec);
    ctx.save();
    ctx.globalAlpha = fade;
    if (ranged) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, range, 0, TAU);
      ctx.fillStyle = rgba(COLORS.charge, 0.07);
      ctx.fill();
      ctx.strokeStyle = rgba(COLORS.charge, 0.8);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = rgba('#c77dff', 0.6);
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, FW - 4, LINE_Y - 2);
    }
    const L = w.augments.stacks(sel.id);
    const next = L < spec.up.length + 1 ? spec.up[L - 1]?.label : null;
    const lines = [
      `${spec.emoji} ${spec.name}  Lv ${L}`,
      ranged ? `사거리 ${Math.round(range)} · 쿨다운 ${c.cooldownOf(sel.id).toFixed(2)}초` : `사거리 없음 (화면 전체) · 쿨다운 ${c.cooldownOf(sel.id).toFixed(1)}초`,
      next ? `다음 레벨: ${next}` : '최대 레벨',
    ];
    ctx.font = `800 11px ${FONT}, ${EMOJI_FONT}`;
    const wBox = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 16;
    const bx = clamp(m.x - wBox / 2, 4, FW - wBox - 4);
    const by = m.y - 78;
    ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
    ctx.fillRect(bx, by, wBox, 54);
    ctx.strokeStyle = rgba(COLORS.charge, 0.6);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, wBox, 54);
    ctx.textAlign = 'left';
    lines.forEach((t, i) => {
      ctx.fillStyle = i === 0 ? COLORS.text : i === 2 ? COLORS.gold : COLORS.dim;
      ctx.fillText(t, bx + 8, by + 16 + i * 16);
    });
    ctx.restore();
  }

  private actor(a: Actor, ctx: CanvasRenderingContext2D): void {
    const k = clamp(a.t / a.ttl, 0, 1);
    switch (a.kind) {
      case 'meteor': {
        const ang = Math.atan2(a.ty - a.y, a.tx - a.x);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(this.glow.get('#ff7a3c'), a.x - 22, a.y - 22, 44, 44);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.icon('☄️', a.x, a.y, 30, false, ang - Math.PI * 0.75);
        // 떨어질 자리 표시
        if (a.y > -20) {
          ctx.beginPath();
          ctx.arc(a.tx, a.ty, 10 + 6 * Math.sin(this.time * 20), 0, TAU);
          ctx.strokeStyle = rgba('#ff7a3c', 0.6);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }
      case 'dino':
        this.icon('🦖', a.x, a.y + Math.abs(Math.sin(a.t * 14)) * -4, 34, a.dir > 0);
        break;
      case 'cow':
        this.icon('🐄', a.x, a.y, 30, false, Math.sin(a.t * 16) * 0.12);
        break;
      case 'sheep':
        this.icon('🐑', a.x, a.y + Math.abs(Math.sin(a.t * 12)) * -5, 24, a.dir > 0);
        break;
      case 'soldier':
        this.icon('💂', a.x, a.y + Math.abs(Math.sin(a.t * 10)) * -3, 20);
        break;
      case 'plane':
        this.icon('✈️', a.x, a.y, 34, false, a.dir > 0 ? Math.PI / 4 : -Math.PI * 0.75);
        break;
      case 'bomb':
        this.icon('💣', a.x, a.y, 14);
        break;
      case 'cannon':
        this.cannon(a.x, a.y, a.dir);
        break;
      case 'shell':
      case 'banana':
      case 'fireball':
      case 'bananaBit': {
        // 포물선: 출발→목표 사이를 위로 볼록하게
        const h = a.kind === 'bananaBit' ? 18 : a.kind === 'fireball' ? 30 : 70;
        const y = a.y - Math.sin(Math.PI * k) * h;
        if (a.kind === 'shell') {
          ctx.beginPath();
          ctx.arc(a.x, y, 4.5, 0, TAU);
          ctx.fillStyle = '#20232f';
          ctx.fill();
          ctx.strokeStyle = '#ffb347';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (a.kind === 'fireball') {
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(this.glow.get('#ff7a3c'), a.x - 12, y - 12, 24, 24);
          ctx.globalCompositeOperation = 'source-over';
          this.icon('🔥', a.x, y, 16);
        } else this.icon('🍌', a.x, y, a.kind === 'banana' ? 26 : 16, false, a.t * 14);
        break;
      }
      case 'donkey':
        this.icon('🐴', a.x, a.y, 34, false, a.t * 6);
        break;
      case 'ufo': {
        const beam = a.t >= 1 && a.t < 2.6;
        if (beam) {
          const grad = ctx.createLinearGradient(0, a.y, 0, LINE_Y);
          grad.addColorStop(0, 'rgba(120, 255, 200, 0.5)');
          grad.addColorStop(1, 'rgba(120, 255, 200, 0.05)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(a.x - 10, a.y + 8);
          ctx.lineTo(a.x + 10, a.y + 8);
          ctx.lineTo(a.x + 34, LINE_Y);
          ctx.lineTo(a.x - 34, LINE_Y);
          ctx.closePath();
          ctx.fill();
        }
        this.icon('🛸', a.x, a.y + Math.sin(a.t * 5) * 3, 40);
        break;
      }
      case 'train':
        for (let i = 0; i < 3; i++) this.icon(i === 0 ? '🚂' : '🚃', a.x - a.dir * i * 34, a.y, 36, a.dir > 0);
        break;
      case 'dragon': {
        // 아래로 뿜는 불
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const yy = a.y + 20 + i * 32;
          const s = 18 + i * 8;
          ctx.globalAlpha = 0.35 - i * 0.04;
          ctx.drawImage(this.glow.get(i % 2 ? '#ff7a3c' : '#ffb347'), a.x + a.dir * 10 - s / 2 + Math.sin(this.time * 30 + i) * 4, yy - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.icon('🐉', a.x, a.y, 46, a.dir > 0);
        break;
      }
      case 'tornado': {
        ctx.strokeStyle = rgba('#c8d0e8', 0.35);
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(a.x, a.y - 30 + i * 18, 60 - i * 10, 14 - i * 2, 0, this.time * 6 + i, this.time * 6 + i + Math.PI * 1.4);
          ctx.stroke();
        }
        this.icon('🌪️', a.x, a.y, 64, false, Math.sin(this.time * 8) * 0.08);
        break;
      }
      case 'slot': {
        const x = a.x - 66;
        const y = a.y - 26;
        ctx.fillStyle = 'rgba(30, 14, 40, 0.92)';
        ctx.fillRect(x, y, 132, 52);
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, 132, 52);
        for (let i = 0; i < 3; i++) {
          const spinning = !a.reels && a.t < 1.6;
          const e = a.reels ? a.reels[i] : SLOT_SPIN[Math.floor(this.time * 18 + i * 3) % SLOT_SPIN.length];
          this.icon(e, x + 22 + i * 44, a.y, spinning ? 26 : 32, false, 0, spinning ? 0.8 : 1);
        }
        break;
      }
      case 'cookie': {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 8);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 * pulse;
        ctx.drawImage(this.glow.get(COLORS.gold), a.x - 34, a.y - 34, 68, 68);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.icon('🍪', a.x, a.y, 34, false, Math.sin(this.time * 3) * 0.3);
        ctx.font = `900 10px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = rgba(COLORS.gold, pulse);
        ctx.fillText('TAP!', a.x, a.y + 28);
        break;
      }
      case 'frost': {
        const f = 1 - k;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.n * (0.6 + 0.4 * k), 0, TAU);
        ctx.fillStyle = rgba('#9fe8ff', 0.25 * f);
        ctx.fill();
        ctx.strokeStyle = rgba('#e8fbff', 0.8 * f);
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
      case 'laser': {
        // 기둥 (위성 레이저·궤도 폭격·낙뢰 손). ty 가 있으면 그 높이부터
        const f = 1 - k;
        const wdt = a.r || 20;
        const top = a.ty > a.y ? a.ty : 0;
        const col = a.emoji ?? '#ff3cc8';
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(col, 0.45 * f);
        ctx.fillRect(a.x - wdt, top, wdt * 2, LINE_Y - top);
        ctx.fillStyle = rgba('#ffffff', 0.8 * f);
        ctx.fillRect(a.x - wdt / 5, top, (wdt * 2) / 5, LINE_Y - top);
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'bullet':
        this.bullet(a, ctx);
        break;
      case 'beam': {
        const f = 1 - k;
        const col = a.emoji ?? '#ff3cc8';
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(col, 0.5 * f);
        ctx.lineWidth = a.r * 2.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.tx, a.ty);
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.9 * f);
        ctx.lineWidth = Math.max(1, a.r * 0.6);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'thrown': {
        const y = a.y - Math.sin(Math.PI * k) * 60;
        if (a.emoji) this.icon(a.emoji, a.x, y, 18, false, a.t * 10);
        else {
          ctx.beginPath();
          ctx.arc(a.x, y, 5, 0, TAU);
          ctx.fillStyle = '#20232f';
          ctx.fill();
          ctx.strokeStyle = '#ffb347';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        break;
      }
      case 'faller': {
        const size = a.p?.size ?? 26;
        if (a.y > -20) {
          ctx.beginPath();
          ctx.arc(a.tx, a.ty, (a.r || 20) * 0.4 + 4 * Math.sin(this.time * 20), 0, TAU);
          ctx.strokeStyle = rgba('#ff7a3c', 0.5);
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        this.icon(a.emoji ?? '☄️', a.x, a.y, size, false, size > 50 ? Math.sin(a.t * 6) * 0.2 : a.t * 4);
        break;
      }
      case 'walker':
        this.icon(a.emoji ?? '💂', a.x, a.y + Math.abs(Math.sin(a.t * 12)) * -4, a.p?.size ?? 20, a.dir > 0);
        break;
      case 'stamp':
        this.icon(a.emoji ?? '🦖', a.x, a.y + Math.abs(Math.sin(a.t * 14)) * -3, a.p?.size ? a.p.size + 8 : 30, a.dir > 0, a.vy < 0 ? 0 : 0);
        break;
      case 'saw':
        this.icon(a.p?.emoji ?? '⚙️', a.x, a.y, 24, false, a.t * 18);
        break;
      case 'trap': {
        // 깔린 함정: 작게, 밟힐 수 있는 범위를 옅게
        ctx.beginPath();
        ctx.arc(a.x, a.y, Math.min(a.r, 30) * 0.5, 0, TAU);
        ctx.strokeStyle = rgba(a.p?.color ?? '#ff8a3c', 0.25 + 0.15 * Math.sin(this.time * 6 + a.id));
        ctx.lineWidth = 1;
        ctx.stroke();
        this.icon(a.emoji ?? '🪤', a.x, a.y, 14);
        break;
      }
      case 'vortex': {
        ctx.strokeStyle = rgba('#b54dff', 0.5);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r * (0.3 + 0.25 * i) * (1 - k * 0.5), this.time * 8 + i, this.time * 8 + i + Math.PI * 1.3);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6;
        ctx.drawImage(this.glow.get('#5a3c8a'), a.x - 24, a.y - 24, 48, 48);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'bubble':
        for (const e of a.grabbed ?? []) {
          if (e.dead) continue;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.radius + 6, 0, TAU);
          ctx.fillStyle = 'rgba(160, 220, 255, 0.18)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(200, 240, 255, 0.8)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        break;
      case 'drone':
        this.icon(a.p?.emoji ?? '🚁', a.x, a.y, 20, Math.cos(this.time * 2 + a.n) > 0);
        break;
      case 'storm':
        this.icon('⛈️', a.x + Math.sin(this.time * 2) * 80, 36, 54);
        break;
      case 'sweep': {
        const wide = a.r >= 50;
        if (wide) {
          for (let x = 16; x < FW; x += 34) this.icon(a.emoji ?? '🌊', x, a.y + Math.sin(this.time * 8 + x) * 4, 34);
        } else this.icon(a.emoji ?? '🎳', a.x, a.y, a.p?.size ?? 34, false, a.t * 10);
        break;
      }
      case 'ring': {
        const f = 1 - k;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * (0.7 + 0.3 * k), 0, TAU);
        ctx.strokeStyle = rgba(a.emoji ?? '#ffffff', 0.7 * f);
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      }
    }
  }

  private bullet(a: Actor, ctx: CanvasRenderingContext2D): void {
    const p = a.p ?? {};
    const col = p.color ?? '#ffe08a';
    const sp = Math.hypot(a.vx, a.vy) || 1;
    const ux = a.vx / sp;
    const uy = a.vy / sp;
    switch (p.tracer) {
      case 'flame': {
        const f = clamp(a.t / a.ttl, 0, 1);
        const s = 8 + f * 18;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 * (1 - f);
        ctx.drawImage(this.glow.get(f < 0.4 ? '#ffd36b' : '#ff7a3c'), a.x - s / 2, a.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'ball': {
        const r = p.size ?? 3;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(this.glow.get(col), a.x - r * 3, a.y - r * 3, r * 6, r * 6);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, TAU);
        ctx.fillStyle = col;
        ctx.fill();
        break;
      }
      case 'rocket': {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(Math.atan2(a.vy, a.vx));
        ctx.fillStyle = '#c8d0e8';
        ctx.fillRect(-5, -1.8, 9, 3.6);
        ctx.fillStyle = '#ff3c6e';
        ctx.fillRect(3, -1.8, 2.5, 3.6);
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.7;
        ctx.drawImage(this.glow.get(col), a.x - ux * 8 - 6, a.y - uy * 8 - 6, 12, 12);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'arrow': {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x - ux * 12, a.y - uy * 12);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - ux * 4 - uy * 3, a.y - uy * 4 + ux * 3);
        ctx.lineTo(a.x - ux * 4 + uy * 3, a.y - uy * 4 - ux * 3);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        break;
      }
      case 'emoji':
        this.icon(a.emoji ?? p.emoji ?? '✴️', a.x, a.y, p.size ?? 12, false, a.t * 20);
        break;
      default: {
        // 예광탄: 진행 방향으로 짧은 빛줄기
        const len = Math.min(16, sp * 0.02);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(col, 0.9);
        ctx.lineWidth = (p.dmg ?? 1) >= 3 ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x - ux * len, a.y - uy * len);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  /** HUD: 피버 테두리, 큰 글씨, 버프 시간, 핵 섬광 */
  drawHud(w: World): void {
    const c = w.chaos;
    if (!c) return;
    const ctx = this.ctx;
    if (c.fever > 0) {
      const hue = (this.time * 240) % 360;
      ctx.strokeStyle = `hsla(${hue}, 100%, 60%, 0.85)`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, FW - 6, FH - 6);
      ctx.fillStyle = `hsla(${(hue + 180) % 360}, 100%, 60%, 0.06)`;
      ctx.fillRect(0, 0, FW, FH);
      ctx.font = `900 16px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
      ctx.fillText(`FEVER ${c.fever.toFixed(1)}`, FW / 2, 100);
    }
    // 버프 남은 시간
    let by = 118;
    const bar = (label: string, left: number, max: number, color: string) => {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.fillText(label, FW / 2, by);
      ctx.fillStyle = rgba(color, 0.2);
      ctx.fillRect(FW / 2 - 40, by + 3, 80, 3);
      ctx.fillStyle = color;
      ctx.fillRect(FW / 2 - 40, by + 3, 80 * clamp(left / max, 0, 1), 3);
      by += 18;
    };
    if (c.frenzy > 0) bar('FRENZY 피해 ×3', c.frenzy, BALANCE.chaos.frenzySec, COLORS.gold);
    if (c.clickFrenzy > 0) bar('CLICK FRENZY 게이지 무한', c.clickFrenzy, BALANCE.chaos.clickFrenzySec, COLORS.charge);
    // 가진 무기: 오른쪽 위부터 줄바꿈하며 아이콘 + 레벨 + 쿨다운 (강화는 그 아래 작게)
    const perRow = 9;
    let k = 0;
    const weapons = c.owned().filter((id) => ARMS[id].cat !== 'passive');
    for (const id of weapons) {
      const info = ARMS[id];
      const ix = FW - 16 - (k % perRow) * 20;
      const iy = 64 + Math.floor(k / perRow) * 22;
      const L = w.augments.stacks(id);
      const cd = c.cooldowns.get(id) ?? 0;
      const ready = 1 - clamp(cd / Math.max(0.01, c.cooldownOf(id)), 0, 1);
      const col = CATEGORY_COLOR[info.cat];
      ctx.beginPath();
      ctx.arc(ix, iy, 8.5, -Math.PI / 2, -Math.PI / 2 + TAU * ready);
      ctx.strokeStyle = rgba(col, 0.75);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      this.icon(info.emoji, ix, iy, 12);
      ctx.font = `900 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(L), ix + 7, iy + 9);
      k++;
    }
    const passives = c.owned('passive');
    const py = 64 + Math.ceil(Math.max(1, weapons.length) / perRow) * 22;
    passives.forEach((id, i) => {
      const px = FW - 14 - (i % 12) * 15;
      const yy = py + Math.floor(i / 12) * 14;
      this.icon(ARMS[id].emoji, px, yy, 10);
      ctx.font = `900 6px ${FONT}`;
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(String(w.augments.stacks(id)), px + 6, yy + 6);
    });
    // 손공격이 없으면 탭이 아무 일도 안 한다는 안내 (게이지 자리)
    if (c.owned('hand').length === 0 && w.phase === 'playing') {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText('손공격 없음 · 레벨 업에서 얻으면 탭으로 싸운다', FW / 2, 600);
    } else if (!c.hasBomb && w.phase === 'playing') {
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.charge;
      ctx.fillText(`탭: ${c.owned('hand').map((id) => ARMS[id].emoji).join(' ')}`, FW / 2, 600);
    }

    for (let i = 0; i < this.banners.length; i++) {
      const b = this.banners[i];
      const pop = b.t < 0.15 ? 1 + (0.15 - b.t) * 4 : 1;
      const alpha = b.t > 1.2 ? 1 - (b.t - 1.2) / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(FW / 2, 200 + i * 46);
      ctx.scale(pop, pop);
      ctx.font = `900 24px ${FONT}, ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.font = `800 11px ${FONT}`;
        ctx.lineWidth = 3;
        ctx.strokeText(b.sub, 0, 17);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(b.sub, 0, 17);
      }
      ctx.restore();
    }
    if (this.flash > 0) {
      ctx.fillStyle = rgba('#ffffff', 0.85 * this.flash);
      ctx.fillRect(0, 0, FW, FH);
    }
  }
}
