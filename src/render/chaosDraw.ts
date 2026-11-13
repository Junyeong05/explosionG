import { BALANCE } from '../data/balance';
import { ARMS, CATEGORY_COLOR, chaosEvent, hasRange, type ChaosEventId, type GunLook } from '../data/chaos';
import { TAU, clamp } from '../core/math';
import { CAST_SEC, SOUL_BURST, TAG_MINI, TRAP_FLY_SEC, type Actor } from '../sim/chaos';
import { TAG_ALLY } from '../sim/fusion';
import { glyphFor, paintGlyph } from './glyphs';
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

/**
 * 무기·물체 그림: 데이터의 이모지를 열쇠로 네온 벡터 그림(render/glyphs.ts)을 72px 캔버스에 한 번만 그려 두고 늘려 쓴다.
 * (11-09 "유아틱하다" 피드백으로 화면에 이모지를 그리지 않는다)
 */
class EmojiCache {
  private readonly map = new Map<string, HTMLCanvasElement>();

  get(e: string): HTMLCanvasElement {
    let c = this.map.get(e);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 72;
      paintGlyph(c.getContext('2d')!, glyphFor(e));
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
  /** 극적 반응: 크게, 테두리, 살짝 튀어오름 */
  big?: boolean;
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
        this.banner(`${def.name}!`, '', COLORS.gold);
        break;
      }
      case 'fever':
        if (e.on) this.banner('FEVER TIME', '탭이 두 배로 세지고 게이지가 세 배로 찬다', '#ff3cc8');
        break;
      case 'cookie':
        this.pop(e.x, e.y - 24, BUFF_TEXT[e.buff] ?? e.buff, COLORS.gold);
        this.banner('황금 보급!', BUFF_TEXT[e.buff] ?? '', COLORS.gold);
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
        if (spec) this.banner(`${spec.name}!`, '', '#c77dff');
        break;
      }
      case 'fusion':
        // 합성 v2: 처음 해낸 짝은 이름만 (규칙은 직접 보고 알아낸다)
        this.banner(`새 합성 · ${e.name}`, `${ARMS[e.a]?.name ?? ''} + ${ARMS[e.b]?.name ?? ''}`, '#7dff9a');
        // 처음 해낸 그 자리에 이름이 떠오른다 (두 갈래 색)
        this.pop(e.x, e.y - 18, e.name, CATEGORY_COLOR[ARMS[e.b]?.cat ?? 'gun']);
        break;
      case 'resist':
        this.pop(e.x, e.y - 16, '저항', '#cfd8dc');
        break;
      case 'react':
        this.pops.push({ x: e.x, y: e.y - 22, text: e.text, color: e.color, t: 0, big: true });
        if (this.pops.length > 16) this.pops.shift();
        break;
      case 'augment': {
        const spec = ARMS[e.id];
        if (spec?.fusion) {
          const [a, b] = spec.fusion.map((id) => ARMS[id]);
          this.banner(`융합! ${spec.name}`, `${a.name} + ${b.name}`, '#ff3cc8');
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
      // 합친 무기 안에 든 무기의 자리: 합친 무기가 그 자리에서도 쏜다 (합친 무기 그림 + 제 갈래 색 점선)
      const root = c.fusion.isKid(id) ? c.rootOf(id) : id;
      const spec = ARMS[root];
      // v4: 합친 무기는 한 자리에서만 (안에 든 무기의 자리는 보이지 않는다)
      if (root !== id && c.fusion.mode === 4) continue;
      if (root !== id) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 14, 0, TAU);
        ctx.strokeStyle = rgba(CATEGORY_COLOR[ARMS[id].cat], 0.85);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
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
      // 주문 분신: 두 배로 쏘는 동안 겹쳐 보이는 빛
      if ((c.cloned.get(id) ?? -1) > w.time) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 12);
        ctx.drawImage(this.glow.get('#e0b8ff'), m.x - 20, m.y - 20, 40, 40);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        this.icon(spec.emoji, m.x + 5, m.y - 5, 17, false, 0, 0.35);
      }
      if (m.wall !== 0 && spec.p.look) {
        this.gun(spec.p.look, m.x, m.y, c.aim.get(root) ?? -Math.PI / 2, 0, w.time - (c.firedAt.get(root) ?? -9));
      } else {
        const bob = spec.cat === 'magic' ? Math.sin(this.time * 2 + m.x) * 2 : 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22;
        ctx.drawImage(this.glow.get(glowCol), m.x - 14, m.y - 14 + bob, 28, 28);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // 합친 무기: 안에 든 갈래 색 고리를 겹쳐 그린다 (무엇을 합쳤는지 한눈에)
        (c.fusion.kids.get(id) ?? []).forEach((k, i) => {
          ctx.beginPath();
          ctx.arc(m.x, m.y + bob, 12 + i * 3, 0, TAU);
          ctx.strokeStyle = rgba(CATEGORY_COLOR[ARMS[k].cat], 0.9);
          ctx.lineWidth = 2;
          ctx.stroke();
        });
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
    // 주문: 변이된 적은 보라 덩어리, 매혹된 적은 분홍 테두리 + 위 화살
    for (const e of w.enemies) {
      if (e.dead) continue;
      if (e.poly > 0) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.9, 0, TAU);
        ctx.fillStyle = rgba('#3a2a5a', 0.85);
        ctx.fill();
        ctx.strokeStyle = rgba('#b4a0ff', 0.9);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.lineDashOffset = -this.time * 20;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.charm > 0) {
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 4, 0, TAU);
        ctx.strokeStyle = rgba('#ff6fb5', 0.9);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.x - 4, e.y - e.radius - 4);
        ctx.lineTo(e.x, e.y - e.radius - 10);
        ctx.lineTo(e.x + 4, e.y - e.radius - 4);
        ctx.stroke();
      }
    }
    if (c.hasteUntil > w.time) {
      ctx.strokeStyle = rgba('#e0b8ff', 0.35 + 0.15 * Math.sin(this.time * 10));
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, FW - 4, LINE_Y - 4);
    }
    // 떼가 붙어 약해진 적: 연두 점이 맴돌고 테두리가 옅게 빛난다
    for (const e of w.enemies) {
      if (e.dead || e.infest <= 0) continue;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 3, 0, TAU);
      ctx.strokeStyle = rgba(CATEGORY_COLOR.swarm, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const g = this.time * 6 + i * 1.57 + e.id;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(g) * (e.radius + 2), e.y + Math.sin(g) * (e.radius + 2), 1.4, 0, TAU);
        ctx.fillStyle = CATEGORY_COLOR.swarm;
        ctx.fill();
      }
    }
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
      ctx.textAlign = 'center';
      if (p.big) {
        // 극적 반응 이름: 처음에 크게 튀었다가 올라가며 사라진다
        const sc = k < 0.15 ? 1 + (0.15 - k) * 4 : 1;
        ctx.font = `900 ${Math.round(17 * sc)}px ${FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(p.text, p.x, p.y - k * 22);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y - k * 22);
        continue;
      }
      ctx.font = `900 13px ${FONT}`;
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
        const arty = ARMS[a.src]?.cat === 'turret';
        if (arty) {
          // 포격: 떨어질 자리에 조준 표시가 조여 든다
          const rr = 18 * (1 - k) + 8;
          ctx.strokeStyle = rgba(CATEGORY_COLOR.turret, 0.35 + 0.4 * k);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(a.tx, a.ty, rr, 0, TAU);
          ctx.moveTo(a.tx - rr - 4, a.ty);
          ctx.lineTo(a.tx - rr + 4, a.ty);
          ctx.moveTo(a.tx + rr - 4, a.ty);
          ctx.lineTo(a.tx + rr + 4, a.ty);
          ctx.stroke();
        }
        const y = a.y - Math.sin(Math.PI * k) * (arty ? 130 : 60);
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
        // 떨어질 자리에 그림자: 가까워질수록 짙고 커진다 (공중 갈래의 예고)
        {
          const near = clamp(1 - (a.ty - a.y) / 600, 0, 1);
          const rr = (a.r || 20) * (0.35 + 0.45 * near);
          ctx.beginPath();
          ctx.ellipse(a.tx, a.ty + 2, rr, rr * 0.42, 0, 0, TAU);
          ctx.fillStyle = rgba('#000000', 0.18 + 0.32 * near);
          ctx.fill();
          ctx.strokeStyle = rgba('#ff7a3c', 0.25 + 0.4 * near);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        this.icon(a.emoji ?? '☄️', a.x, a.y, size, false, size > 50 ? Math.sin(a.t * 6) * 0.2 : a.t * 4);
        break;
      }
      case 'walker':
        if (a.tag & TAG_ALLY) {
          // 합성으로 아군이 된 것: 초록 테
          ctx.beginPath();
          ctx.ellipse(a.x, a.y + 7, 11, 4, 0, 0, TAU);
          ctx.strokeStyle = rgba('#7dff9a', 0.85);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        this.icon(a.emoji ?? '💂', a.x, a.y + Math.abs(Math.sin(a.t * 12)) * -4, a.p?.size ?? 20, a.dir > 0);
        break;
      case 'tether': {
        // 합성: 두 점을 잇는 줄 (줄기·사슬·철조망)
        const fade = Math.min(1, (a.ttl - a.t) / 0.15) * Math.min(1, a.t / 0.05 + 0.3);
        const col = a.emoji ?? '#9fe8ff';
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = rgba(col, 0.55 * fade);
        ctx.lineWidth = a.r * 2.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.tx, a.ty);
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', 0.8 * fade);
        ctx.lineWidth = Math.max(0.8, a.r * 0.5);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'mark': {
        // 합성: 표식·조준 (점선 고리가 돈다)
        const fade = Math.min(1, (a.ttl - a.t) / 0.2);
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(this.time * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = rgba(a.emoji ?? '#ffffff', 0.8 * fade);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, a.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        break;
      }
      case 'stamp':
        this.icon(a.emoji ?? '🦖', a.x, a.y + Math.abs(Math.sin(a.t * 14)) * -3, a.p?.size ? a.p.size + 8 : 30, a.dir > 0, a.vy < 0 ? 0 : 0);
        break;
      case 'saw':
        this.icon(a.p?.emoji ?? '⚙️', a.x, a.y, 24, false, a.t * 18);
        break;
      case 'trap': {
        const col = a.p?.color ?? '#ff8a3c';
        if (a.t < TRAP_FLY_SEC) {
          // 자리에서 포물선으로 던져진다
          const f = a.t / TRAP_FLY_SEC;
          this.icon(a.emoji ?? '🪤', a.x, a.y - Math.sin(Math.PI * f) * 46, 16, false, a.t * 12);
          ctx.beginPath();
          ctx.ellipse(a.tx, a.ty + 3, 9 * f, 4 * f, 0, 0, TAU);
          ctx.fillStyle = rgba('#000000', 0.3 * f);
          ctx.fill();
          break;
        }
        // 깔린 함정: 바닥 자국 + 깜빡이는 "장전" 고리 + 밟히면 터지는 범위
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 7 + a.id);
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + 4, 13, 5, 0, 0, TAU);
        ctx.fillStyle = rgba('#000000', 0.35);
        ctx.fill();
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, Math.min(a.r, 40), 0, TAU);
        ctx.strokeStyle = rgba(col, 0.18 + 0.12 * pulse);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 11 + 2 * pulse, 0, TAU);
        ctx.strokeStyle = rgba(col, 0.55 + 0.35 * pulse);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        this.icon(a.emoji ?? '🪤', a.x, a.y, 19);
        break;
      }
      case 'open': {
        // 합성: 실린 것이 열리는 자리. 나르는 갈래 색 고리가 조여 들고, 실린 갈래 색 고리가 퍼진다
        const f = 1 - k;
        const outer = a.p?.color ?? '#ffffff';
        const inner = a.emoji ?? '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeStyle = rgba(outer, 0.9 * f);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * (1.8 - 1.2 * k), 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(inner, f);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * (0.2 + 1.2 * Math.sqrt(k)), 0, TAU);
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8 * f;
        ctx.drawImage(this.glow.get(inner), a.x - a.r * 1.4, a.y - a.r * 1.4, a.r * 2.8, a.r * 2.8);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'post': {
        // 실린 총: 잠깐 떠서 쏘는 작은 총구
        const fade = Math.min(1, (a.ttl - a.t) / 0.3) * Math.min(1, a.t / 0.15);
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + 9, 10, 3.5, 0, 0, TAU);
        ctx.fillStyle = rgba('#000000', 0.35 * fade);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(a.x, a.y, 11, 0, TAU);
        ctx.strokeStyle = rgba(CATEGORY_COLOR.gun, 0.7 * fade);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        this.icon(a.emoji ?? '🔫', a.x, a.y, 16, false, 0, fade);
        break;
      }
      case 'cast': {
        // 마법진: 돌면서 커지는 이중 고리 + 눈금 + 가운데 마법 그림, 다 차면 발동 (실려서 열린 것은 작고 빠르게)
        const f = clamp(a.t / a.ttl, 0, 1);
        const spec = ARMS[a.src];
        const R = (26 + 30 * Math.sqrt(f)) * (a.ttl < CAST_SEC ? 0.55 : 1);
        const rot = this.time * 2.2;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + 0.5 * f;
        ctx.drawImage(this.glow.get('#c77dff'), -R * 1.3, -R * 1.3, R * 2.6, R * 2.6);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = rgba('#e0b8ff', 0.5 + 0.5 * f);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, R, rot, rot + TAU * f);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.72, -rot, -rot + TAU);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
          const g = rot + (i / 12) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(g) * R * 0.78, Math.sin(g) * R * 0.78);
          ctx.lineTo(Math.cos(g) * R * 0.94, Math.sin(g) * R * 0.94);
          ctx.stroke();
        }
        // 삼각형 두 개 (별 모양)
        for (const off of [0, Math.PI]) {
          ctx.beginPath();
          for (let i = 0; i <= 3; i++) {
            const g = -rot * 0.5 + off + (i / 3) * TAU;
            const px = Math.cos(g) * R * 0.66;
            const py = Math.sin(g) * R * 0.66;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
        if (spec) this.icon(spec.emoji, a.x, a.y, (18 + 10 * f) * (a.ttl < CAST_SEC ? 0.6 : 1));
        break;
      }
      case 'ray': {
        if (!a.target) break;
        const col = a.emoji ?? '#ff3cc8';
        const ramp = Math.max(1, a.m);
        const fade = Math.min(1, 0.55 + 0.15 * ramp);
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        if (a.dir === -1) {
          // 번개 줄기: 들쭉날쭉, 매 프레임 바뀐다
          ctx.strokeStyle = rgba(col, 0.85 * fade);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          const segs = 7;
          for (let i = 1; i < segs; i++) {
            const k2 = i / segs;
            const j = (Math.sin(this.time * 90 + i * 7.3 + a.id) * 0.5) * 12;
            ctx.lineTo(a.x + (a.tx - a.x) * k2 + j, a.y + (a.ty - a.y) * k2 - j * 0.5);
          }
          ctx.lineTo(a.tx, a.ty);
          ctx.stroke();
        } else {
          // 빛줄기: 굵은 빛 + 하얀 심, 살짝 떨린다
          const wob = (1 + 0.15 * Math.sin(this.time * 50 + a.id)) * (0.7 + 0.35 * ramp);
          ctx.strokeStyle = rgba(col, 0.45 * fade);
          ctx.lineWidth = a.r * 3 * wob;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(a.tx, a.ty);
          ctx.stroke();
          ctx.strokeStyle = rgba('#ffffff', 0.9 * fade);
          ctx.lineWidth = Math.max(1, a.r * 0.7);
          ctx.stroke();
          ctx.globalAlpha = 0.7 * fade;
          ctx.drawImage(this.glow.get(col), a.tx - 12, a.ty - 12, 24, 24);
          ctx.globalAlpha = 1;
        }
        ctx.lineCap = 'butt';
        ctx.globalCompositeOperation = 'source-over';
        if (ramp >= 2) {
          ctx.font = `900 9px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = rgba('#ffffff', 0.85);
          ctx.fillText(`×${ramp.toFixed(1)}`, a.tx, a.ty - 14);
        }
        break;
      }
      case 'tossed': {
        // 통통: 처음 던질 땐 높게, 튕길 땐 낮게
        const y = a.y - Math.sin(Math.PI * k) * (a.dir === 0 ? 26 : 58);
        this.icon(a.emoji ?? '🪨', a.x, y, a.dir === 0 ? 16 : 18, false, a.t * 14);
        break;
      }
      case 'swarm': {
        // 구름: 옅은 그늘 + 작은 것들이 제멋대로 맴돈다
        const fade = Math.min(1, (a.ttl - a.t) / 0.4) * Math.min(1, a.t / 0.2);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, TAU);
        ctx.fillStyle = rgba('#000000', 0.16 * fade);
        ctx.fill();
        const size = a.p?.size ?? 10;
        for (let i = 0; i < a.n; i++) {
          const g = i * 2.399 + this.time * (1.6 + (i % 3) * 0.5) * (i % 2 ? 1 : -1);
          const rad = a.r * (0.3 + 0.7 * ((i * 0.618) % 1)) * (0.85 + 0.15 * Math.sin(this.time * 4 + i));
          this.icon(a.emoji ?? '🦟', a.x + Math.cos(g) * rad, a.y + Math.sin(g) * rad * 0.8, size, Math.cos(g) > 0, 0, fade);
        }
        break;
      }
      case 'soul': {
        // 혼: 정령 색 작은 불꽃이 꼬리를 끌며 날아간다
        const col = a.emoji ?? '#b4a0ff';
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.9;
        ctx.drawImage(this.glow.get(col), a.x - 9, a.y - 9, 18, 18);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(a.x, a.y, 2.2, 0, TAU);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
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
      case 'drone': {
        const full = clamp(a.left / (a.tag & TAG_MINI ? SOUL_BURST / 2 : SOUL_BURST), 0, 1);
        if (full > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.25 + 0.5 * full + 0.15 * Math.sin(this.time * (6 + 10 * full));
          const gr = 16 + 22 * full;
          ctx.drawImage(this.glow.get(a.p?.color ?? '#b4a0ff'), a.x - gr, a.y - gr, gr * 2, gr * 2);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        this.icon(a.p?.emoji ?? '🚁', a.x, a.y, 20 * (1 + 0.7 * full), Math.cos(this.time * 2 + a.n) > 0);
        break;
      }
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
    const weapons = c.owned().filter((id) => ARMS[id].cat !== 'passive' && !(c.fusion.mode === 4 && c.fusion.isKid(id)));
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
      // v4 합성: 안에 든 무기의 갈래 색 점 (깊이까지 전부)
      if (c.fusion.mode === 4 && c.fusion.has(id)) {
        const inside: string[] = [];
        const walk = (x: string) => {
          for (const kid of c.fusion.slotsOf(x).slice(1)) inside.push(kid);
        };
        walk(id);
        inside.slice(0, 5).forEach((kid, j) => {
          ctx.beginPath();
          ctx.arc(ix - 8 + j * 4, iy + 11, 1.7, 0, TAU);
          ctx.fillStyle = CATEGORY_COLOR[ARMS[kid].cat];
          ctx.fill();
        });
      }
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
      ctx.fillText(`탭: ${c.owned('hand').map((id) => ARMS[id].name).join(' · ')}`, FW / 2, 600);
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
