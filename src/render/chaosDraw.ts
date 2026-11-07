import { BALANCE } from '../data/balance';
import { ARMS, chaosEvent, type ChaosEventId } from '../data/chaos';
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

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly glow: GlowCache,
  ) {}

  reset(): void {
    this.banners = [];
    this.pops = [];
    this.flash = 0;
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
    for (const s of c.installSlots()) {
      const bob = Math.sin(this.time * 3 + s.x) * 1.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      ctx.drawImage(this.glow.get(COLORS.gold), s.x - 18, s.y - 18 + bob, 36, 36);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      this.icon(ARMS[s.id].emoji, s.x, s.y + bob, 24);
      for (let i = 0; i < s.stacks; i++) {
        ctx.beginPath();
        ctx.arc(s.x - 6 + i * 6, s.y + 15, 2, 0, TAU);
        ctx.fillStyle = COLORS.gold;
        ctx.fill();
      }
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
    for (const a of c.actors) this.actor(a, ctx);
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
        const f = 1 - k;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba('#ff3cc8', 0.5 * f);
        ctx.fillRect(a.x - 20, 0, 40, LINE_Y);
        ctx.fillStyle = rgba('#ffffff', 0.8 * f);
        ctx.fillRect(a.x - 4, 0, 8, LINE_Y);
        ctx.globalCompositeOperation = 'source-over';
        break;
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
    // 가진 무기: 오른쪽 위에 아이콘 + 레벨 + 쿨다운 (강화는 작게 그 아래)
    let ix = FW - 18;
    for (const id of c.owned()) {
      const info = ARMS[id];
      if (info.cat === 'passive') continue;
      const L = w.augments.stacks(id);
      const cd = c.cooldowns.get(id) ?? 0;
      const ready = 1 - clamp(cd / Math.max(0.01, c.cooldownOf(id)), 0, 1);
      ctx.beginPath();
      ctx.arc(ix, 66, 11, -Math.PI / 2, -Math.PI / 2 + TAU * ready);
      ctx.strokeStyle = rgba(info.cat === 'hand' ? COLORS.charge : info.cat === 'magic' ? '#c77dff' : COLORS.gold, 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
      this.icon(info.emoji, ix, 66, 15);
      ctx.font = `900 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(String(L), ix + 8, 78);
      ix -= 26;
    }
    let px = FW - 16;
    for (const id of c.owned('passive')) {
      this.icon(ARMS[id].emoji, px, 92, 11);
      ctx.font = `900 7px ${FONT}`;
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(String(w.augments.stacks(id)), px + 7, 99);
      px -= 18;
    }
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
