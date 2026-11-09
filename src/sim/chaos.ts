import { BALANCE } from '../data/balance';
import { AUGMENTS, FALLBACK_AUGMENTS } from '../data/augments';
import {
  ARMS, ARSENAL, DEFAULT_RANGE, FUSE_LEVEL, FUSIONS, MAX_LEVEL, PASSIVE_SLOTS, WEAPON_SLOTS, effective, fusionsOf, hasRange,
  ATTACK_CATEGORIES, type ArmCategory, type ChaosEventId, type WeaponParams, type WeaponSpec,
} from '../data/chaos';
import { clamp, dist2 } from '../core/math';
import type { Shot } from './exp';
import type { Enemy, OfferKind } from './types';
import type { World } from './World';

/**
 * 도파민 모드: 카테고리 무기고 (data/chaos.ts).
 * 시작 무기 하나로 시작해서 레벨 업마다 무기를 늘리거나 올린다 (칸 제한 없음).
 * 자동 무기는 사거리 안의 적만 노린다 (자리 있는 무기는 자리에서 반경, 마법·돌진은 방어선에서 위로).
 * 피해는 연쇄 단계 1짜리 폭발·직접 피해 → 폭발형·폭약 붙은 적은 터지고, 더 깊은 연쇄는 폭탄 탭 몫.
 */

export type ActorKind =
  | 'meteor' | 'dino' | 'cow' | 'ufo' | 'plane' | 'bomb' | 'cannon' | 'shell' | 'sheep' | 'banana' | 'bananaBit'
  | 'donkey' | 'train' | 'dragon' | 'tornado' | 'slot' | 'cookie' | 'soldier' | 'fireball' | 'laser' | 'frost'
  | 'bullet' | 'beam' | 'thrown' | 'walker' | 'stamp' | 'saw' | 'vortex' | 'bubble' | 'drone' | 'storm'
  | 'faller' | 'sweep' | 'ring' | 'chill' | 'trap' | 'ray' | 'tossed' | 'swarm' | 'soul' | 'cast';

export interface Actor {
  id: number;
  kind: ActorKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 나온 뒤 지난 시간 (음수면 아직 대기), 수명 */
  t: number;
  ttl: number;
  /** 목표 지점 (빔은 끝점) */
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
  /** 이미 맞힌 적 */
  hits: Set<number> | null;
  /** UFO·토네이도·거품이 붙잡은 적 */
  grabbed: Enemy[] | null;
  /** 잭팟 결과 그림 */
  reels: string[] | null;
  /** 무기 수치 (탄·소환수·낙하물) */
  p: WeaponParams | null;
  /** 그릴 이모지 (없으면 kind 기본) */
  emoji: string | null;
  /** 한 번 맞힐 때 피해 (D 배율까지 곱한 값) */
  dmg: number;
  /** 남은 관통·튕김·때릴 횟수 */
  left: number;
  /** 사거리·반경 */
  r: number;
  /** 개인 타이머 (근접 공격 간격·드론 사격) */
  cd: number;
  /** 낸 무기 id */
  src: string;
  /** 유도탄이 쫓는 적 */
  target: Enemy | null;
}

type Buff = 'frenzy' | 'clickFrenzy' | 'lucky' | 'meteor';
interface Mount {
  x: number;
  y: number;
  /** 1 이면 총 모양으로 그림, 0 이면 이모지 */
  wall: number;
}

const TRAMPLE_R = 18;
const PROJECTILE_KINDS: ReadonlySet<ActorKind> = new Set(['shell', 'fireball', 'soldier', 'sheep', 'bananaBit', 'bullet', 'thrown', 'walker']);
const SLOT_EMOJI = ['🦖', '🐄', '☄️', '🛸', '🐑', '🍌', '7️⃣'];
const BURST_GAP = 0.07;
/** 화면에 동시에 깔리는 함정 수 (넘으면 오래된 것부터 걷는다) */
const MAX_TRAPS = 36;
/** 함정이 자리에서 던져져 바닥에 꽂히기까지 (그리기도 씀) */
export const TRAP_FLY_SEC = 0.45;
/** 마법은 마법진을 이만큼 먼저 띄우고 발동한다 (포탑과 확 다르게, 예고가 보이게) */
export const CAST_SEC = 0.7;
/** 포탑이 서는 줄 (방어선에서 위로), 막는 몸 반지름 */
export const TURRET_ROW_Y = 150;
const TURRET_BODY = 15;
/** 정령이 혼을 이만큼 모으면 터진다 */
export const SOUL_BURST = 10;
const MAX_SOULS = 40;
/** 한 줄 10칸을 채우는 순서: 가운데부터 좌우로 */
const CENTER_OUT = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0];

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
  /** 무기별 남은 쿨다운 */
  readonly cooldowns = new Map<string, number>();
  /** 총: 겨누는 각도와 마지막으로 쏜 시각 (그리기용) */
  readonly aim = new Map<string, number>();
  readonly firedAt = new Map<string, number>();
  private mounts = new Map<string, Mount>();
  /** 포탑 체력 (앞에 설치돼 적을 막는다). down > 0 이면 부서져 다시 서는 중 */
  readonly turrets = new Map<string, { hp: number; max: number; down: number }>();
  /** 마법이 힘을 모으기 시작한 시각 (쿨다운이 끝난 뒤, 몰린 곳이 생길 때까지) */
  readonly charging = new Map<string, number>();
  /** 눌러서 고른 무기 (사거리·정보 표시, until 까지) */
  selected: { id: string; until: number } | null = null;
  private nextId = 1;
  /** 지금 만드는 물체의 피해 배율·사거리 (마법 효과가 쓰는 것) */
  private curMul = 1;
  private curRange = DEFAULT_RANGE;

  constructor(private readonly w: World) {
    this.cookieTimer = BALANCE.chaos.cookieEverySec;
  }

  private get D(): number {
    return this.w.stats.tapDamage;
  }

  private get LINE(): number {
    return this.w.field.defenseLineY;
  }

  lv(id: string): number {
    return this.w.augments.stacks(id);
  }

  get hasBomb(): boolean {
    return this.lv('arm_bomb') > 0;
  }

  /** 지금 레벨의 실제 수치 (기본값 + 무기별 레벨 업 효과, data/chaosUp.ts) */
  eff(spec: WeaponSpec): { p: WeaponParams; dmg: number; cd: number } {
    return effective(spec, Math.max(1, this.lv(spec.id)));
  }

  /** 무기 피해 배율: 레벨 업 효과 + 소환술 */
  private dmgMul(spec: WeaponSpec): number {
    let m = this.eff(spec).dmg;
    if (spec.cat === 'summon') m *= 1 + 0.2 * this.lv('arm_summoner');
    return m;
  }

  /** 다중 강화: 수 + (1·3·5레벨) */
  private get extra(): number {
    return Math.floor((this.lv('arm_multi') + 1) / 2);
  }

  cooldownOf(id: string): number {
    const spec = ARMS[id];
    let cd = spec.cd * this.eff(spec).cd * Math.max(0.5, 1 - 0.08 * this.lv('arm_haste'));
    if (spec.kind === 'gun' || spec.kind === 'beam') cd *= Math.max(0.5, 1 - 0.08 * this.lv('arm_gunsmith'));
    if (spec.cat === 'magic') cd *= Math.max(0.5, 1 - 0.08 * this.lv('arm_archmage'));
    return cd;
  }

  /** 사거리: 총·포탑만 (소환수·마법은 화면 전체, 플레이 피드백) */
  rangeOf(spec: WeaponSpec): number {
    if (!hasRange(spec.cat)) return this.LINE - 50;
    return (this.eff(spec).p.range ?? DEFAULT_RANGE) * (1 + 0.12 * this.lv('arm_range'));
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
   * 레벨 업 선택지 3장: 가진 무기 레벨 업 / 새 무기 / 강화 / 폭탄 탭이 있으면 기존 탭 증강 약간.
   * 시작 선택지는 손공격·총·포탑·소환수·마법 중 세 갈래를 골라 한 장씩 (플레이 피드백: 선택지는 3개 정도로).
   */
  roll(kind: OfferKind): string[] {
    const rng = this.w.rng;
    if (kind === 'starter') {
      // 시작 무기가 있는 갈래 중 셋 (순서는 갈래 순서대로). 11-08 확장으로 갈래가 15개
      const cats: ArmCategory[] = ATTACK_CATEGORIES.filter((cat) => Object.values(ARMS).some((a) => a.cat === cat && a.starter));
      while (cats.length > 3) cats.splice(rng.int(cats.length), 1);
      return cats.map((cat) => rng.pick(Object.keys(ARMS).filter((id) => ARMS[id].cat === cat && ARMS[id].starter)));
    }
    const weapons = this.owned().filter((id) => ARMS[id].cat !== 'passive');
    const passives = this.owned('passive');
    // 무기 종류가 100개가 넘어서 한 장씩 같은 무게로 섞으면 가진 무기 레벨 업이 거의 안 나왔다.
    // 그래서 갈래별 전체 무게를 정해 두고 나눠 준다: 레벨 업 1장당 1, 새 무기 전체 max(2, 0.25 × 가진 무기 수),
    // 새 강화 전체 0.8 (보스 보상은 새 마법을 더 자주).
    const ups: string[] = [];
    const newWeapons: string[] = [];
    const newPassives: string[] = [];
    for (const d of ARSENAL) {
      const L = this.lv(d.id);
      if (L >= MAX_LEVEL) continue;
      if (L > 0) ups.push(d.id);
      else if (ARMS[d.id].fusion) continue;
      else if (ARMS[d.id].cat === 'passive') {
        if (passives.length < PASSIVE_SLOTS) newPassives.push(d.id);
      } else if (weapons.length < WEAPON_SLOTS) newWeapons.push(d.id);
    }
    const cand: { id: string; wt: number }[] = [];
    // 융합 짝: 가진 무기의 짝은 새 무기로 훨씬 자주, 짝을 이미 가진 무기의 레벨 업도 더 자주
    const partnerOwned = (id: string) => fusionsOf(id).some((f) => this.lv(f.id) === 0 && f.fusion!.some((x) => x !== id && this.lv(x) > 0));
    for (const id of ups) cand.push({ id, wt: partnerOwned(id) && this.lv(id) < FUSE_LEVEL ? 2 : 1 });
    const newTotal = Math.max(2, 0.25 * weapons.length);
    const each = newTotal / Math.max(1, newWeapons.length);
    for (const id of newWeapons) {
      const boss = kind === 'boss' && ARMS[id].cat === 'magic' ? 4 : 1;
      cand.push({ id, wt: Math.max(each * boss, partnerOwned(id) ? 0.6 : 0) });
    }
    for (const id of newPassives) cand.push({ id, wt: Math.max(0.8 / newPassives.length, partnerOwned(id) ? 0.6 : 0) });
    if (this.hasBomb) {
      for (const d of AUGMENTS) if (d.rarity !== 'prism' && !d.evolution && this.w.augments.isAvailable(d)) cand.push({ id: d.id, wt: 0.05 });
    }
    const out: string[] = [];
    // 융합: 재료 둘이 다 FUSE_LEVEL 이상이면 융합 카드를 꼭 한 장 (첫 칸)
    const fusable = this.fusable();
    if (fusable.length > 0) out.push(rng.pick(fusable));
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

  /** 지금 고를 수 있는 융합 (재료 둘이 다 FUSE_LEVEL 이상, 아직 안 가짐) */
  fusable(): string[] {
    return FUSIONS.filter((f) => this.lv(f.id) === 0 && f.fusion!.every((id) => this.lv(id) >= FUSE_LEVEL)).map((f) => f.id);
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
      const spec = ARMS[id];
      if (spec.kind === 'bomb' || (this.cooldowns.get(id) ?? 0) > 0) continue;
      this.cooldowns.set(id, this.cooldownOf(id));
      any = true;
      const p = this.eff(spec).p;
      const D = this.D * this.dmgMul(spec) * (this.frenzy > 0 ? BALANCE.chaos.frenzyDamage : 1) * (this.fever > 0 ? BALANCE.chaos.feverDamage : 1);
      this.curMul = D / this.D;
      switch (spec.kind) {
        case 'tapZap': {
          const near = w.enemiesNear(x, y, p.radius ?? 110).sort((a, b) => dist2(a.x, a.y, x, y) - dist2(b.x, b.y, x, y));
          const chainId = w.newChain(1);
          for (const e of near.slice(0, (p.count ?? 3) + this.extra)) {
            w.emit({ type: 'bolt', kind: 'lightning', x1: x, y1: y, x2: e.x, y2: e.y });
            w.spawnExplosion({ x: e.x, y: e.y, radius: 18, damage: (p.dmg ?? 2) * D, chainId, source: 'lightning' });
          }
          break;
        }
        case 'tapMine': {
          const max = p.count ?? 4;
          const own = w.mines.filter((m) => m.depth !== undefined);
          if (own.length >= max) w.mines.splice(w.mines.indexOf(own[0]), 1);
          w.addMine({ x, y, radius: (p.radius ?? 48) * this.areaMul, damage: (p.dmg ?? 3) * D, ttl: 15, depth: 1 });
          break;
        }
        case 'tapSlash':
          w.spawnExplosion({ x, y, radius: p.width ?? 12, damage: (p.dmg ?? 2.5) * D, chainId: w.newChain(1), source: 'tap', tag: { row: true } });
          break;
        case 'tapZone':
          w.addZone({ x, y, radius: (p.radius ?? 36) * this.areaMul, dps: (p.dps ?? 1) * D, ttl: (p.ttl ?? 2) * this.durMul, chainId: w.newChain(1), source: 'exp' });
          this.add('ring', x, y, { ttl: 0.4, r: (p.radius ?? 36) * this.areaMul, emoji: p.color ?? '#ff8a3c' });
          break;
        case 'tapSnipe': {
          let best: Enemy | null = null;
          for (const e of w.enemiesNear(x, y, p.radius ?? 90)) if (!best || e.hp > best.hp) best = e;
          if (best) {
            w.emit({ type: 'bolt', kind: 'shard', x1: x, y1: w.field.height, x2: best.x, y2: best.y });
            this.hit(best, (p.dmg ?? 8) * D, p, w.newChain(1));
          }
          break;
        }
        case 'tapBoom': {
          const r = (p.radius ?? 50) * this.areaMul;
          if (p.freeze || p.knock) {
            for (const e of w.enemiesNear(x, y, r)) {
              if (p.freeze && !e.def.boss) {
                e.frozen = Math.max(e.frozen, p.freeze);
                e.pack = null;
              }
              if (p.knock) this.push(e, x, y, p.knock);
            }
          }
          this.boom(x, y, r, (p.dmg ?? 1) * D, p, true);
          this.add('ring', x, y, { ttl: 0.35, r, emoji: p.freeze ? '#9fe8ff' : '#ffffff' });
          break;
        }
        case 'tapThrow': {
          const a = this.lob('thrown', w.field.width / 2, this.LINE + 20, x, y, 520);
          if (a) {
            a.p = p;
            a.emoji = p.emoji ?? null;
            a.dmg = (p.dmg ?? 3) * D;
          }
          break;
        }
        case 'tapStrike': {
          const width = p.width ?? 22;
          const chainId = w.newChain(1);
          for (const e of [...w.enemies]) if (!e.dead && Math.abs(e.x - x) <= width + e.radius && e.y > 0) this.hit(e, (p.dmg ?? 4) * D, p, chainId);
          this.add('laser', x, 0, { ttl: 0.35, r: width, emoji: '#fff7a8', n: -1 });
          w.emit({ type: 'bolt', kind: 'lightning', x1: x, y1: 0, x2: x, y2: y });
          break;
        }
        case 'tapMissiles':
          for (let i = 0; i < (p.count ?? 3) + this.extra; i++) {
            const a = this.bullet(id, w.field.width / 2 + (i - 1) * 30, this.LINE + 10, -Math.PI / 2 + (i - 1) * 0.5, p, (p.dmg ?? 2) * D, 600, 0);
            if (a) {
              a.tx = x;
              a.ty = y;
            }
          }
          break;
        case 'tapPull':
          this.add('vortex', x, y, { ttl: p.ttl ?? 1.2, r: p.radius ?? 90, p, dmg: (p.dmg ?? 3) * D });
          break;
        case 'tapRain':
          for (let i = 0; i < (p.count ?? 8) + 2 * this.extra; i++) {
            const tx = x + w.rng.range(-50, 50);
            const ty = y + w.rng.range(-50, 50);
            this.add('faller', tx + w.rng.range(-20, 20), -30 - i * 25, { tx, ty, ttl: 4, p, emoji: p.emoji ?? '🪙', dmg: (p.dmg ?? 1.5) * D });
          }
          break;
      }
      this.curMul = 1;
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

  onKill(e: Enemy): void {
    this.heat++;
    // 정령이 있으면 처치한 적의 혼이 아무 정령에게나 빨려 간다 (정령은 혼을 모아 터진다)
    let drones = 0;
    let souls = 0;
    for (const a of this.actors) {
      if (a.kind === 'drone') drones++;
      else if (a.kind === 'soul') souls++;
    }
    if (drones === 0 || souls >= MAX_SOULS) return;
    let pick = this.w.rng.int(drones);
    for (const a of this.actors) {
      if (a.kind !== 'drone') continue;
      if (pick-- === 0) {
        const s = this.add('soul', e.x, e.y, { ttl: 3, n: a.id });
        if (s) s.emoji = this.eff(ARMS[a.src]).p.color ?? '#b4a0ff';
        break;
      }
    }
  }

  private get areaMul(): number {
    return 1 + 0.1 * this.lv('arm_area');
  }

  private get durMul(): number {
    return 1 + 0.15 * this.lv('arm_duration');
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
        this.add('cookie', w.rng.range(50, w.field.width - 50), w.rng.range(140, this.LINE - 140), { ttl: C.cookieSec });
      }
    }
    for (const [id, t] of this.cooldowns) this.cooldowns.set(id, t - dt);
    this.layoutMounts();
    this.updateTurrets(dt);
    this.updateWeapons();
    this.updateGate();
    for (let i = this.actors.length - 1; i >= 0; i--) {
      const a = this.actors[i];
      a.t += dt;
      if (a.t < 0) continue;
      if (!this.step(a, dt) || a.t >= a.ttl) this.actors.splice(i, 1);
    }
  }

  // ─── 자리 ──────────────────────────────────────────────

  /**
   * 무기 자리: 얻은 순서대로 방어선 바로 뒤 한 줄에 가운데부터 좌우로 가지런히 (한 줄 10칸), 넘치면 방어선 위로 한 줄씩.
   * 플레이 피드백: 총은 벽, 포탑은 아래, 마법은 자리 없음… 으로 제각각이라 이상했다. 손공격·강화만 자리가 없다.
   */
  private layoutMounts(): void {
    const W = this.w.field.width;
    const perRow = 10;
    const gap = (W - 24) / (perRow - 1);
    const m = new Map<string, Mount>();
    // 포탑: 방어선 앞 전장에 한 줄(5칸)씩 고르게 선다 (총은 방어선 뒤에서 쏘고, 포탑은 앞에 서서 막는다)
    const turrets = this.owned().filter((id) => ARMS[id].cat === 'turret');
    turrets.forEach((id, j) => {
      const row = Math.floor(j / 5);
      const inRow = Math.min(5, turrets.length - row * 5);
      const k = j % 5;
      m.set(id, { x: (W * (k + 1)) / (inRow + 1), y: this.LINE - TURRET_ROW_Y - row * 60, wall: 0 });
    });
    let i = 0;
    for (const id of this.owned()) {
      const spec = ARMS[id];
      if (spec.cat === 'hand' || spec.cat === 'passive' || spec.cat === 'turret') continue;
      const row = Math.floor(i / perRow);
      const y = row === 0 ? this.LINE + 16 : this.LINE - 14 - (row - 1) * 30;
      const gun = (spec.kind === 'gun' || spec.kind === 'beam') && !!spec.p.look;
      // 가운데부터 좌우로 번갈아 채운다 (첫 무기가 구석에 있으면 반대편이 사거리 밖이었다)
      const col = CENTER_OUT[i % perRow];
      m.set(id, { x: 12 + col * gap, y, wall: gun ? 1 : 0 });
      i++;
    }
    this.mounts = m;
  }

  /** 무기를 눌렀으면 그 무기 정보·사거리를 잠깐 보여 주고 탭은 거기서 끝 (같은 걸 또 누르면 닫힘) */
  trySelect(x: number, y: number): boolean {
    let best: string | null = null;
    let bd = 17 * 17;
    for (const [id, m] of this.mounts) {
      const d = dist2(x, y, m.x, m.y);
      if (d < bd) {
        bd = d;
        best = id;
      }
    }
    if (!best) return false;
    if (this.selected && this.selected.id === best && this.selected.until > this.w.time) this.selected = null;
    else this.selected = { id: best, until: this.w.time + 3 };
    return true;
  }

  mountOf(id: string): Mount | undefined {
    return this.mounts.get(id);
  }

  /** 그리기용: 자리 있는 무기 전부 */
  allMounts(): { id: string; m: Mount }[] {
    return [...this.mounts].map(([id, m]) => ({ id, m }));
  }

  // ─── 자동 무기 ─────────────────────────────────────────

  private updateWeapons(): void {
    for (const id of this.owned()) {
      const spec = ARMS[id];
      if (spec.cat === 'hand' || spec.cat === 'passive') continue;
      if (spec.kind === 'drone') {
        this.keepDrones(spec);
        continue;
      }
      if (spec.kind === 'beam' || spec.kind === 'zap') {
        this.keepRays(spec);
        continue;
      }
      if (spec.cat === 'turret' && (this.turrets.get(id)?.down ?? 0) > 0) continue;
      const left = this.cooldowns.get(id);
      if (left === undefined) {
        // 얻자마자 처음 한 번은 금방
        this.cooldowns.set(id, Math.min(0.8, this.cooldownOf(id)));
        continue;
      }
      if (left > 0) continue;
      this.curMul = this.dmgMul(spec);
      this.curRange = this.rangeOf(spec);
      if (spec.cat === 'magic') {
        // 마법: 쿨다운이 끝나도 바로 안 쓰고 모은다. 몰린 곳이 생기거나 magicMaxHold 초가 되면,
        // 모은 만큼 세게 (최대 ×2) 마법진을 띄우고 CAST_SEC 뒤 발동 (step 'cast')
        const C = BALANCE.chaos;
        let start = this.charging.get(id);
        if (start === undefined) {
          start = this.w.time;
          this.charging.set(id, start);
        }
        const hold = this.w.time - start;
        const spot = this.pickTarget('dense', undefined, this.curRange);
        const crowd = spot ? this.w.enemiesNear(spot.x, spot.y, 80).length : 0;
        if (spot && (crowd >= C.magicCrowd || hold >= C.magicMaxHold)) {
          const mult = 1 + Math.min(1, hold / C.magicMaxHold);
          this.curMul *= mult;
          const a = this.add('cast', spot.x, spot.y, { ttl: CAST_SEC });
          if (a) {
            a.src = id;
            a.left = Math.round(mult * 10);
          }
          this.charging.delete(id);
          this.cooldowns.set(id, this.cooldownOf(id));
        }
        this.curMul = 1;
        this.curRange = DEFAULT_RANGE;
        continue;
      }
      const fired = this.fire(spec);
      // 사거리 안에 적이 없어서 못 쐈으면 조금 뒤 다시 본다
      this.cooldowns.set(id, fired ? this.cooldownOf(id) : 0.2);
      this.curMul = 1;
      this.curRange = DEFAULT_RANGE;
    }
  }

  /** 무기 한 번 쓰기. 쏠 대상이 없으면 false */
  private fire(spec: WeaponSpec): boolean {
    const w = this.w;
    const p = this.eff(spec).p;
    const D = this.D * this.curMul;
    const range = this.curRange;
    const mount = this.mounts.get(spec.id);
    const from = mount ?? { x: w.field.width / 2, y: this.LINE - 12, wall: 0 };
    switch (spec.kind) {
      case 'gun': {
        const t = this.pickTarget(p.target ?? 'front', mount, range);
        if (!t) return false;
        const ang = Math.atan2(t.y - from.y, t.x - from.x);
        this.aim.set(spec.id, ang);
        this.firedAt.set(spec.id, w.time);
        const muzzle = mount && mount.wall !== 0 ? (p.look?.len ?? 12) + (p.look?.body ?? 10) / 2 : 6;
        const mx = from.x + Math.cos(ang) * muzzle;
        const my = from.y + Math.sin(ang) * muzzle;
        const shots = p.burst ?? 1;
        const count = (p.count ?? 1) + ((p.count ?? 1) > 1 ? this.extra : 0);
        for (let b = 0; b < shots + (shots > 1 ? this.extra : 0); b++) {
          for (let i = 0; i < count; i++) {
            const a = ang + (p.spread ?? 0) * (count > 1 ? i / (count - 1) - 0.5 : w.rng.range(-0.5, 0.5));
            const bl = this.bullet(spec.id, mx, my, a, p, (p.dmg ?? 1) * D, range, b * BURST_GAP);
            if (bl && p.homing) bl.target = t;
          }
        }
        w.emit({ type: 'gunFire', x: mx, y: my, angle: ang, big: (p.dmg ?? 1) >= 3 || !!p.boom });
        return true;
      }
      case 'lob': {
        const t = this.pickTarget(p.target ?? 'dense', mount, range);
        if (!t) return false;
        const n = (p.count ?? 1) + this.extra;
        for (let i = 0; i < n; i++) {
          const tt = i === 0 ? t : this.pickTarget('random', mount, range) ?? t;
          const a = this.lob('thrown', from.x, from.y - 8, tt.x, tt.y, p.speed ?? 480);
          if (a) {
            a.p = p;
            a.emoji = p.emoji ?? null;
            a.dmg = (p.dmg ?? 2) * D;
            a.src = spec.id;
          }
        }
        return true;
      }
      case 'column': {
        const t = this.pickTarget('dense', undefined, range);
        if (!t) return false;
        this.add('laser', t.x, 0, { ttl: 0.5, r: p.width ?? 20, dmg: (p.dmg ?? 4) * D, ty: this.LINE - range });
        return true;
      }
      case 'strikes': {
        let any = false;
        const chainId = w.newChain(1);
        for (let i = 0; i < (p.count ?? 2) + this.extra; i++) {
          const e = this.pickTarget('random', mount, range);
          if (!e) break;
          any = true;
          w.emit({ type: 'bolt', kind: 'lightning', x1: e.x + w.rng.range(-15, 15), y1: 0, x2: e.x, y2: e.y });
          this.boom(e.x, e.y, (p.width ?? 14) + 2, (p.dmg ?? 2) * D, p, false, chainId);
        }
        return any;
      }
      case 'frostArea': {
        const t = this.pickTarget('dense', mount, range);
        if (!t) return false;
        const r = (p.radius ?? 55) * this.areaMul;
        const chainId = w.newChain(1);
        for (const e of w.enemiesNear(t.x, t.y, r)) {
          if (!e.def.boss) {
            e.frozen = Math.max(e.frozen, p.freeze ?? 2);
            e.pack = null;
          }
          this.hit(e, (p.dmg ?? 0.5) * D, p, chainId);
        }
        this.add('ring', t.x, t.y, { ttl: 0.5, r, emoji: '#9fe8ff' });
        return true;
      }
      case 'zoneAt': {
        const t = this.pickTarget('dense', mount, range);
        if (!t) return false;
        const r = (p.radius ?? 40) * this.areaMul;
        w.addZone({ x: t.x, y: t.y, radius: r, dps: (p.dps ?? 1) * D, ttl: (p.ttl ?? 3) * this.durMul, chainId: w.newChain(1), source: 'exp' });
        this.add('ring', t.x, t.y, { ttl: 0.4, r, emoji: p.color ?? '#ff8a3c' });
        return true;
      }
      case 'saw': {
        const t = this.pickTarget('random', mount, range);
        if (!t) return false;
        for (let i = 0; i < (p.count ?? 1) + this.extra; i++) {
          const ang = Math.atan2(t.y - from.y, t.x - from.x) + i * 0.6;
          const speed = p.speed ?? 260;
          this.add('saw', from.x, from.y - 10, { vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ttl: (p.ttl ?? 5) * this.durMul, p, dmg: (p.dmg ?? 1.5) * D, hits: true, r: range });
        }
        return true;
      }
      case 'pullAt': {
        const t = this.pickTarget('dense', mount, range);
        if (!t) return false;
        this.add('vortex', t.x, t.y, { ttl: p.ttl ?? 1.2, r: (p.radius ?? 100) * this.areaMul, p, dmg: (p.dmg ?? 2) * D });
        if (spec.cat === 'magic') w.emit({ type: 'magic', id: spec.id, x: t.x, y: t.y });
        return true;
      }
      case 'bubble': {
        const t = this.pickTarget('dense', mount, range);
        if (!t) return false;
        const a = this.add('bubble', t.x, t.y, { ttl: (p.ttl ?? 2) * this.durMul, r: (p.radius ?? 50) * this.areaMul, p, dmg: (p.dmg ?? 3) * D, grabbed: true });
        if (a) for (const e of w.enemiesNear(t.x, t.y, a.r)) if (!e.def.boss) a.grabbed!.push(e);
        return true;
      }
      case 'pulse': {
        const r = range;
        const near = w.enemiesNear(from.x, from.y, r);
        if (near.length === 0) return false;
        const chainId = w.newChain(1);
        for (const e of near) {
          if (p.freeze && !e.def.boss) e.frozen = Math.max(e.frozen, p.freeze);
          this.hit(e, (p.dmg ?? 0.8) * D, p, chainId);
          if (p.knock && !e.dead) this.push(e, from.x, from.y, p.knock);
        }
        this.add('ring', from.x, from.y, { ttl: 0.5, r, emoji: p.color ?? '#ffd36b' });
        return true;
      }
      case 'toss': {
        // 투척: 던진 물건이 적에 맞고 통통 튕겨 다음 적으로 옮겨 간다 (포탑처럼 한 점에서 터지지 않는다)
        const t = this.pickTarget(p.target ?? 'front', mount, range);
        if (!t) return false;
        for (let i = 0; i < (p.count ?? 1) + this.extra; i++) {
          const tt = i === 0 ? t : this.pickTarget('random', mount, range) ?? t;
          const a = this.lob('tossed', from.x, from.y - 8, tt.x, tt.y, p.speed ?? 440);
          if (a) {
            a.p = p;
            a.emoji = p.emoji ?? null;
            a.dmg = (p.dmg ?? 2) * D;
            a.src = spec.id;
            a.left = p.bounce ?? 3;
            a.hits = new Set();
            a.dir = 1;
          }
        }
        return true;
      }
      case 'swarm': {
        // 떼: 작은 것 수십 마리가 한 구름으로 몰려가 덮은 적 전부를 갉는다 (소환수는 하나하나, 떼는 한 덩어리)
        const t = this.pickTarget('dense', mount, range);
        if (!t) return false;
        const k = (p.count ?? 3) + this.extra;
        const a = this.add('swarm', from.x, from.y - 10, { ttl: (p.ttl ?? 4) * this.durMul, p, emoji: p.emoji ?? '🦟', dmg: (p.dmg ?? 0.6) * D, r: (20 + 3 * k) * this.areaMul, n: 6 + 3 * k });
        if (a) {
          a.target = t;
          a.src = spec.id;
        }
        return true;
      }
      case 'trap': {
        // 함정: 자리에서 던져 적이 걸어올 길(조금 아래) 바닥에 꽂아 두고, 밟히면 터진다. 화면에 너무 많으면 오래된 것부터 걷는다
        // 적이 없어도 깐다 (미리 깔아 두는 준비형: 웨이브 사이에도 쌓인다)
        for (let i = 0; i < (p.count ?? 1) + this.extra; i++) {
          const t = this.pickTarget(i === 0 ? (p.target ?? 'front') : 'random', mount, range) ?? this.randomPoint(Math.min(range, 300));
          const traps = this.actors.filter((a) => a.kind === 'trap');
          if (traps.length >= MAX_TRAPS) this.actors.splice(this.actors.indexOf(traps[0]), 1);
          // 적이 걸어올 길 위 (적보다 조금 아래). 깔린 게 보이게 바로 밑이 아니라 한 걸음 앞
          const x = clamp(t.x + w.rng.range(-12, 12), 12, w.field.width - 12);
          const y = clamp(t.y + w.rng.range(45, 90), 40, this.LINE - 16);
          const a = this.add('trap', from.x, from.y - 6, { ttl: (p.ttl ?? BALANCE.chaos.trapSec) * this.durMul + TRAP_FLY_SEC, p, emoji: p.emoji ?? '🪤', dmg: (p.dmg ?? 3) * D, r: (p.boom ?? 40) * this.areaMul, left: p.melee ?? 1, tx: x, ty: y });
          if (a) {
            a.src = spec.id;
            // 던진 자리 (날아가는 동안 쓴다)
            a.vx = from.x;
            a.vy = from.y - 6;
          }
        }
        return true;
      }
      case 'walker': {
        if (!this.pickTarget('front', undefined, range)) return false;
        // 소환수: 방어선 여기저기에서 하나씩 나와 (한 자리에서 우르르 나오지 않게) 각자 다른 적을 맡는다 (stepWalker)
        const n = (p.count ?? 1) + this.extra;
        for (let i = 0; i < n; i++) {
          const x = w.rng.range(20, w.field.width - 20);
          const y = this.LINE - 4;
          this.add('walker', x, y, { ttl: 12 * this.durMul, p, emoji: p.emoji ?? '💂', dmg: (p.dmg ?? 2) * D, r: range, left: p.melee ?? 0 });
          this.add('ring', x, y, { ttl: 0.35, r: 14, emoji: '#7dff9a' });
        }
        return true;
      }
      case 'stamp': {
        const t = this.pickTarget('dense', undefined, range);
        if (!t) return false;
        const n = (p.count ?? 2) + this.extra;
        const W = w.field.width;
        const speed = p.speed ?? 230;
        if (p.dir === 'side') {
          const dir = w.rng.chance(0.5) ? 1 : -1;
          for (let i = 0; i < n; i++) {
            const y = clamp(t.y + w.rng.range(-40, 40), this.LINE - range, this.LINE - 20);
            this.add('stamp', dir > 0 ? -30 - i * 45 : W + 30 + i * 45, y, { vx: speed * dir, dir, ttl: 5, p, emoji: p.emoji ?? '🦖', dmg: (p.dmg ?? 3) * D, hits: true });
          }
        } else {
          for (let i = 0; i < n; i++) {
            const x = clamp(t.x + (i - (n - 1) / 2) * 34, 20, W - 20);
            this.add('stamp', x, this.LINE + 10 + i * 14, { vy: -speed, ttl: (range + 40) / speed + i * 0.06, p, emoji: p.emoji ?? '🐄', dmg: (p.dmg ?? 2.5) * D, hits: true });
          }
        }
        return true;
      }
      case 'event': {
        if (!this.pickTarget('front', undefined, range)) return false;
        // 규모 = 레벨 업으로 오른 count (기본 1)
        this.startEvent(p.event ?? 'meteor', p.count ?? 1, spec.cat !== 'magic', p);
        if (spec.cat === 'magic' && p.emoji) w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: 200 });
        return true;
      }
      case 'drop': {
        const t = this.pickTarget(p.target ?? 'dense', undefined, range);
        if (!t) return false;
        for (let i = 0; i < (p.count ?? 1) + this.extra; i++) {
          const tt = i === 0 ? t : this.pickTarget('random', undefined, range) ?? t;
          this.add('faller', tt.x + 40, -60 - i * 80, { tx: tt.x, ty: tt.y, ttl: 5, p, emoji: p.emoji ?? '🔨', dmg: (p.dmg ?? 6) * D, r: (p.radius ?? 80) + (p.boom ?? 0) });
        }
        if (spec.cat === 'magic') w.emit({ type: 'magic', id: spec.id, x: t.x, y: t.y });
        return true;
      }
      case 'rain': {
        if (!this.pickTarget('front', undefined, range)) return false;
        const n = (p.count ?? 10) + 2 * this.extra;
        const blast = (p.radius ?? 30) + (p.boom ?? 0);
        for (let i = 0; i < n; i++) {
          const t = this.pickTarget('random', undefined, range) ?? this.randomPoint(range);
          if (p.fromBottom) {
            const a = this.lob('thrown', clamp(t.x + w.rng.range(-30, 30), 10, w.field.width - 10), this.LINE + 20, t.x, t.y, 420);
            if (a) {
              a.p = { ...p, boom: blast };
              a.emoji = p.emoji ?? null;
              a.dmg = (p.dmg ?? 2) * D;
              a.t = -i * 0.08;
            }
          } else {
            this.add('faller', t.x + w.rng.range(-30, 30), -30 - i * 22, { tx: t.x, ty: t.y, ttl: 5, p, emoji: p.emoji ?? '☄️', dmg: (p.dmg ?? 2) * D, r: blast });
          }
        }
        w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: this.LINE - range / 2 });
        return true;
      }
      case 'sweep': {
        if (!this.pickTarget('front', undefined, range)) return false;
        const lane = p.width ?? 50;
        if (lane >= 50) {
          this.add('sweep', w.field.width / 2, this.LINE + 20, { vy: -220, ttl: (range + 40) / 220, p, emoji: p.emoji ?? '🌊', dmg: (p.dmg ?? 4) * D, r: lane, hits: true });
        } else {
          const t = this.pickTarget('dense', undefined, range)!;
          this.add('sweep', t.x, this.LINE + 20, { vy: -300, ttl: (range + 40) / 300, p, emoji: p.emoji ?? '🎳', dmg: (p.dmg ?? 4) * D, r: lane, hits: true });
        }
        w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: this.LINE - 40 });
        return true;
      }
      case 'columns': {
        if (!this.pickTarget('front', undefined, range)) return false;
        for (let i = 0; i < (p.count ?? 5) + this.extra; i++) {
          const t = i === 0 ? this.pickTarget('dense', undefined, range)! : this.pickTarget('random', undefined, range) ?? this.randomPoint(range);
          this.add('laser', t.x, 0, { ttl: 0.5, r: p.width ?? 20, dmg: (p.dmg ?? 4) * D, ty: this.LINE - range });
          this.actors[this.actors.length - 1].t = -i * 0.12;
        }
        w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: 120 });
        return true;
      }
      case 'storm': {
        if (!this.pickTarget('front', undefined, range)) return false;
        this.add('storm', w.field.width / 2, 40, { ttl: (p.ttl ?? 4) * this.durMul, p, dmg: (p.dmg ?? 2) * D, r: range });
        w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: 60 });
        return true;
      }
      case 'freezeAll':
      case 'quake':
      case 'nuke': {
        const targets = this.inZone(undefined, range);
        if (targets.length === 0) return false;
        const chainId = w.newChain(1);
        for (const e of targets) {
          if (spec.kind === 'nuke') {
            w.spawnExplosion({ x: e.x, y: e.y, radius: 24, damage: (e.def.boss ? 2 : 1) * (p.dmg ?? 8) * D, chainId, source: 'exp', delay: w.rng.range(0, 0.4) });
            continue;
          }
          if (p.freeze && !e.def.boss) {
            e.frozen = Math.max(e.frozen, p.freeze);
            e.pack = null;
          }
          this.hit(e, (p.dmg ?? 1) * D, p, chainId);
        }
        if (spec.kind === 'nuke') w.emit({ type: 'nuke' });
        else w.emit({ type: 'shake', power: spec.kind === 'quake' ? 0.8 : 0.3 });
        w.emit({ type: 'magic', id: spec.id, x: w.field.width / 2, y: this.LINE - range / 2 });
        this.add('ring', w.field.width / 2, this.LINE, { ttl: 0.6, r: range, emoji: spec.kind === 'freezeAll' ? '#9fe8ff' : '#ffb347' });
        return true;
      }
    }
    return false;
  }

  /**
   * 포탑: 앞에 서서 닿은 적을 막는다 (멈춤). 막힌 적은 포탑을 깎고, 부서지면 turretDownSec 뒤 다시 선다.
   * 포탑 근처 위쪽 적은 포탑 쪽으로 조금씩 끌려와 포탑 앞에 뭉친다.
   */
  private updateTurrets(dt: number): void {
    const C = BALANCE.chaos;
    const w = this.w;
    for (const id of this.turrets.keys()) if (this.lv(id) <= 0) this.turrets.delete(id);
    for (const id of this.owned('turret')) {
      const m = this.mounts.get(id);
      if (!m) continue;
      const max = C.turretHp * (1 + 0.5 * (this.lv(id) - 1)) * (1 + 0.15 * this.lv('arm_duration'));
      let st = this.turrets.get(id);
      if (!st) {
        st = { hp: max, max, down: 0 };
        this.turrets.set(id, st);
      }
      if (st.max !== max) {
        st.hp += max - st.max;
        st.max = max;
      }
      if (st.down > 0) {
        st.down -= dt;
        if (st.down <= 0) {
          st.down = 0;
          st.hp = st.max;
          this.add('ring', m.x, m.y, { ttl: 0.4, r: 22, emoji: '#ffc94d' });
        }
        continue;
      }
      for (const e of w.enemies) {
        if (e.dead || e.def.boss || e.pileCol >= 0) continue;
        const dx = m.x - e.x;
        const dy = m.y - e.y;
        if (Math.abs(dx) < C.turretAggro && dy > 0 && dy < C.turretAggro * 1.8) {
          // 끌려온다: 포탑 쪽으로 옆걸음
          e.x += Math.sign(dx) * Math.min(Math.abs(dx), 45 * dt);
        }
        if (dx * dx + dy * dy <= (TURRET_BODY + e.radius) ** 2) {
          e.held = Math.max(e.held, 0.1);
          e.pack = null;
          st.hp -= C.turretBite * (e.def.boss ? 5 : 1) * dt;
        }
      }
      if (st.hp <= 0) {
        st.hp = 0;
        st.down = C.turretDownSec;
        this.add('ring', m.x, m.y, { ttl: 0.5, r: 34, emoji: '#ff6b6b' });
        w.emit({ type: 'shake', power: 0.3 });
      }
    }
  }

  /**
   * 광선: 무기마다 늘 이어진 줄기. 빛(beam)은 가장 단단한 적 하나에, 번개(zap)는 count 마리에 매달려
   * 0.1초마다 지진다. 한 적에 오래 붙어 있을수록 세진다 (rayRampPerSec, 최대 ×rayRampMax)
   */
  private keepRays(spec: WeaponSpec): void {
    const want = spec.kind === 'zap' ? (this.eff(spec).p.count ?? 3) + this.extra : 1;
    let have = 0;
    for (const a of this.actors) if (a.kind === 'ray' && a.src === spec.id) have++;
    for (let i = have; i < want; i++) {
      const a = this.add('ray', this.w.field.width / 2, this.LINE, { ttl: Number.POSITIVE_INFINITY, r: spec.p.width ?? 3 });
      if (a) {
        a.src = spec.id;
        a.dir = spec.kind === 'zap' ? -1 : 1;
        a.emoji = spec.p.color ?? (spec.kind === 'zap' ? '#9fe8ff' : '#ff3cc8');
      }
    }
  }

  /** 드론: 레벨 + 다중 만큼 떠서 돌며 쏜다 */
  private keepDrones(spec: WeaponSpec): void {
    const want = (this.eff(spec).p.count ?? 1) + this.extra;
    let have = 0;
    for (const a of this.actors) if (a.kind === 'drone' && a.src === spec.id) have++;
    // 정령 갈래가 생겨 떠다니는 무기가 여럿: 무기마다 도는 자리를 엇갈리게
    const slot = this.owned().filter((id) => ARMS[id].kind === 'drone').indexOf(spec.id);
    for (let i = have; i < want; i++) {
      const a = this.add('drone', this.w.field.width / 2, this.LINE - 60, { ttl: Number.POSITIVE_INFINITY, p: this.eff(spec).p, r: this.rangeOf(spec) });
      if (a) {
        a.n = i + Math.max(0, slot) * 2.3;
        a.src = spec.id;
        a.dmg = (spec.p.dmg ?? 0.6) * this.D * this.dmgMul(spec);
      }
    }
  }

  // ─── 큰 효과 (마법·소환이 쓰는 예전 난입) ──────────────

  /** L = 무기 레벨 (수가 늘어남). quiet 면 배너 없이. p.emoji 가 있으면 그림을 바꿈 (산타) */
  startEvent(id: ChaosEventId, L = 1, quiet = false, p?: WeaponParams): void {
    const w = this.w;
    const rng = w.rng;
    const W = w.field.width;
    const LINE = this.LINE;
    const spot = this.pickTarget('dense', undefined, this.curRange) ?? { x: W / 2, y: LINE - this.curRange / 2 };
    const more = L - 1 + this.extra;
    this.events++;
    if (!quiet && !p?.emoji) w.emit({ type: 'chaos', id, x: spot.x, y: spot.y });
    switch (id) {
      case 'meteor':
        for (let i = 0; i < 5 + 2 * more; i++) {
          const t = this.pickTarget('random', undefined, this.curRange) ?? this.randomPoint(this.curRange);
          this.add('meteor', t.x + 90, -40 - i * 60, { tx: t.x, ty: t.y, ttl: 5 });
        }
        break;
      case 'sheep':
        for (let i = 0; i < 4 + more; i++) this.add('sheep', 40 + (i * (W - 80)) / Math.max(1, 3 + more), LINE - 6, { ttl: 8, r: this.curRange });
        break;
      case 'banana':
        this.add('banana', W / 2, LINE, { tx: spot.x, ty: spot.y, ttl: 0.6, n: 5 + more });
        break;
      case 'airstrike': {
        const dir = rng.chance(0.5) ? 1 : -1;
        const a = this.add('plane', dir > 0 ? -40 : W + 40, 40, { vx: 260 * dir, dir, ty: spot.y, ttl: 2.2, n: Math.max(14, 26 - 3 * more) });
        if (a && p?.emoji) a.emoji = p.emoji;
        break;
      }
      case 'cookie':
        this.add('cookie', rng.range(50, W - 50), rng.range(140, LINE - 140), { ttl: BALANCE.chaos.cookieSec });
        break;
      case 'dino': {
        const dir = rng.chance(0.5) ? 1 : -1;
        for (let i = 0; i < 2 + more; i++) {
          this.add('dino', dir > 0 ? -30 - i * 45 : W + 30 + i * 45, clamp(spot.y + rng.range(-50, 50), LINE - this.curRange, LINE - 30), { vx: 230 * dir, dir, ttl: 4, hits: true });
        }
        break;
      }
      case 'cows':
        for (let i = 0; i < 3 + more; i++) this.add('cow', 30 + (i * (W - 60)) / Math.max(1, 2 + more), LINE + 10 + i * 18, { vy: -240, ttl: (this.curRange + 40) / 240, hits: true });
        break;
      case 'cannons':
        this.add('cannon', 14, 430, { n: 4, dir: 1, ttl: 2.2 });
        this.add('cannon', W - 14, 430, { n: 4, dir: -1, ttl: 2.2 });
        break;
      case 'donkey':
        this.add('donkey', spot.x, -30, { vy: 0, ttl: 6, n: -(4 + more) });
        break;
      case 'ufo':
        this.add('ufo', -40, LINE - this.curRange - 30, { tx: spot.x, ttl: 4, grabbed: true, n: 30 + 4 * more });
        break;
      case 'jackpot':
        this.add('slot', W / 2, 120, { ttl: 2.4, n: L });
        break;
      case 'tornado': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('tornado', dir > 0 ? 30 : W - 30, clamp(spot.y, LINE - this.curRange + 60, LINE - 80), { vx: 55 * dir, dir, ttl: 4, grabbed: true, n: 110 + 10 * more, p });
        break;
      }
      case 'train': {
        const dir = rng.chance(0.5) ? 1 : -1;
        this.add('train', dir > 0 ? -120 : W + 120, clamp(spot.y, LINE - this.curRange, LINE - 40), { vx: 650 * dir, dir, ttl: 1.6, hits: true });
        break;
      }
      case 'dragon': {
        const dir = rng.chance(0.5) ? 1 : -1;
        // 적이 몰린 곳 조금 위를 날며 아래로 불을 뿜는다
        this.add('dragon', dir > 0 ? -40 : W + 40, clamp(spot.y - 110, 60, LINE - 200), { vx: 130 * dir, dir, ttl: 3.6, n: more });
        break;
      }
    }
  }

  private add(
    kind: ActorKind, x: number, y: number,
    o: {
      vx?: number; vy?: number; ttl: number; tx?: number; ty?: number; n?: number; dir?: number; hits?: boolean; grabbed?: boolean;
      p?: WeaponParams; emoji?: string; dmg?: number; r?: number; left?: number;
    },
  ): Actor | null {
    if (this.actors.length >= BALANCE.chaos.maxActors && kind !== 'drone') return null;
    const a: Actor = {
      id: this.nextId++, kind, x, y, vx: o.vx ?? 0, vy: o.vy ?? 0, t: 0, ttl: o.ttl,
      tx: o.tx ?? x, ty: o.ty ?? y, n: o.n ?? 0, dir: o.dir ?? 1, m: this.curMul, gated: false,
      hits: o.hits ? new Set() : null, grabbed: o.grabbed ? [] : null, reels: null,
      p: o.p ?? null, emoji: o.emoji ?? null, dmg: o.dmg ?? 0, left: o.left ?? 0, r: o.r ?? 0, cd: 0, src: '', target: null,
    };
    this.actors.push(a);
    return a;
  }

  /** 포물선 비행: 출발 → 목표까지 */
  private lob(kind: ActorKind, x: number, y: number, tx: number, ty: number, speed: number): Actor | null {
    const dur = Math.max(0.2, Math.hypot(tx - x, ty - y) / speed);
    const a = this.add(kind, x, y, { tx, ty, ttl: dur + 0.02 });
    if (a) {
      a.vx = (tx - x) / dur;
      a.vy = (ty - y) / dur;
    }
    return a;
  }

  /** 총알 하나 */
  private bullet(src: string, x: number, y: number, ang: number, p: WeaponParams, dmg: number, range: number, delay: number): Actor | null {
    const speed = (p.speed ?? 800) * (1 + 0.15 * this.lv('arm_velocity'));
    const a = this.add('bullet', x, y, {
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ttl: p.pullOrb ? range / speed : Math.min(4, range / speed + 0.05),
      p, dmg, hits: true, left: (p.pierce ?? 0) + this.lv('arm_pierce') + (p.bounce ? 0 : 0),
    });
    if (a) {
      a.t = -delay;
      a.src = src;
      a.n = p.bounce ?? 0;
      a.r = range;
      a.emoji = p.tracer === 'emoji' ? p.emoji ?? null : null;
    }
    return a;
  }

  // ─── 물체 하나 움직이기 (false = 사라짐) ─────────────────

  private step(a: Actor, dt: number): boolean {
    const w = this.w;
    const D = this.D * a.m;
    const W = w.field.width;
    const LINE = this.LINE;
    switch (a.kind) {
      case 'bullet':
        return this.stepBullet(a, dt);
      case 'beam':
      case 'ring':
      case 'frost':
        return true;
      case 'chill':
        if (a.t + dt >= a.ttl) for (const e of w.enemiesNear(a.x, a.y, a.r)) if (!e.def.boss) e.frozen = Math.max(e.frozen, a.n);
        return true;
      case 'thrown': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.t + dt >= a.ttl - 0.02) {
          const p = a.p ?? {};
          this.boom(a.tx, a.ty, (p.boom ?? 40) * this.areaMul, a.dmg || 2 * D, p);
          if (p.chain) {
            const first = w.enemiesNear(a.tx, a.ty, 60)[0];
            if (first) this.chainZap(first, p.chain, (a.dmg || 2 * D) * 0.6);
          }
          return false;
        }
        return true;
      }
      case 'faller': {
        // 위에서 떨어져 목표 높이에 닿으면 쾅 (운석·별·피자·고래·망치·독수리·동전)
        if (a.y < -20) {
          a.y += 400 * dt;
          return true;
        }
        const k = (a.p?.size ?? 0) > 50 ? 420 * dt : 560 * dt;
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= k) {
          const r = (a.r || a.p?.radius || 30) * this.areaMul;
          this.boom(a.tx, a.ty, r, a.dmg, a.p ?? undefined);
          if (r >= 80) w.emit({ type: 'shake', power: 0.6 });
          return false;
        }
        a.x += (dx / d) * k;
        a.y += (dy / d) * k;
        return true;
      }
      case 'trap': {
        // 날아가는 중: 자리에서 꽂힐 곳까지 (그리기가 포물선으로 띄운다). 꽂히면 "착"
        if (a.t < TRAP_FLY_SEC) {
          const k = Math.min(1, (a.t + dt) / TRAP_FLY_SEC);
          a.x = a.vx + (a.tx - a.vx) * k;
          a.y = a.vy + (a.ty - a.vy) * k;
          if (k >= 1) this.add('ring', a.tx, a.ty, { ttl: 0.3, r: Math.min(a.r, 30), emoji: a.p?.color ?? '#ff8a3c' });
          return true;
        }
        // 밟히면 터진다 (left 번까지, 터진 뒤 잠깐 쉼)
        if (a.cd > 0) {
          a.cd -= dt;
          return true;
        }
        if (w.enemiesNear(a.x, a.y, 16).length === 0) return true;
        const p = a.p ?? {};
        // 밟은 자리 근처 적은 묶인다 (멈춤). 스프링은 묶는 대신 날린다
        for (const e of [...w.enemiesNear(a.x, a.y, Math.max(20, a.r * 0.6))]) {
          if (e.def.boss) continue;
          if (p.knock) this.push(e, a.x, a.y, p.knock);
          else {
            e.held = Math.max(e.held, BALANCE.chaos.trapRootSec);
            e.pack = null;
          }
        }
        this.boom(a.x, a.y, a.r, a.dmg, p);
        this.add('ring', a.x, a.y, { ttl: 0.3, r: a.r, emoji: p.color ?? '#ffb347' });
        a.left--;
        a.cd = 0.4;
        return a.left > 0;
      }
      case 'walker':
        return this.stepWalker(a, dt);
      case 'cast': {
        // 마법진이 다 차면 발동
        if (a.t + dt < a.ttl) return true;
        const spec = ARMS[a.src];
        if (spec && this.lv(a.src) > 0) {
          this.curMul = a.m;
          this.curRange = this.rangeOf(spec);
          this.fire(spec);
          this.curMul = 1;
          this.curRange = DEFAULT_RANGE;
        }
        return false;
      }
      case 'ray': {
        // 늘 이어진 줄기 (keepRays). 무기 자리에서 나가 표적에 붙고, 오래 붙을수록 세진다. a.n = 같은 적에 붙은 시간
        const spec = ARMS[a.src];
        if (!spec || this.lv(a.src) <= 0) return false;
        const C = BALANCE.chaos;
        const m = this.mounts.get(a.src);
        if (m) {
          a.x = m.x;
          a.y = m.y - (a.dir === -1 ? 10 : 0);
        }
        const range = this.rangeOf(spec);
        let t = a.target && !a.target.dead && this.visible(a.target) && dist2(a.x, a.y, a.target.x, a.target.y) <= range * range ? a.target : null;
        if (!t) {
          a.n = 0;
          if (a.dir === -1) {
            // 번개: 같은 무기의 다른 줄기가 안 잡은 적
            const taken = new Set<number>();
            for (const o of this.actors) if (o !== a && o.kind === 'ray' && o.src === a.src && o.target) taken.add(o.target.id);
            const pool = this.inZone(m, range).filter((e) => !taken.has(e.id));
            t = pool.length ? pool[this.w.rng.int(pool.length)] : null;
          } else t = this.pickTarget('strong', m, range);
          a.target = t;
        }
        if (!t) return true;
        a.tx = t.x;
        a.ty = t.y;
        a.n += dt;
        if (a.dir !== -1) {
          this.aim.set(a.src, Math.atan2(t.y - a.y, t.x - a.x));
          this.firedAt.set(a.src, w.time);
        }
        a.cd -= dt;
        if (a.cd <= 0) {
          a.cd = 0.1;
          const p = this.eff(spec).p;
          const ramp = Math.min(C.rayRampMax, 1 + C.rayRampPerSec * a.n);
          a.m = ramp;
          const dmg = ((p.dmg ?? 2) * this.D * this.dmgMul(spec) / Math.max(0.3, this.cooldownOf(a.src))) * 0.1 * 0.5 * ramp;
          this.hit(t, dmg, p, w.newChain(1));
          if (p.chain && a.n < 0.1) this.chainZap(t, p.chain, dmg);
        }
        return true;
      }
      case 'tossed': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if (a.t + dt < a.ttl - 0.02) return true;
        const p = a.p ?? {};
        let hitE: Enemy | null = null;
        for (const e of w.enemiesNear(a.tx, a.ty, 24)) if (!e.dead && !a.hits!.has(e.id)) { hitE = e; break; }
        if (hitE) {
          a.hits!.add(hitE.id);
          this.hit(hitE, a.dmg, p, w.newChain(1));
          if (p.boom) this.boom(a.tx, a.ty, Math.min(24, p.boom * 0.4) * this.areaMul, a.dmg * 0.35, p);
          if (p.chain) this.chainZap(hitE, p.chain, a.dmg * 0.5);
          this.add('ring', a.tx, a.ty, { ttl: 0.2, r: 12, emoji: '#ffd36b' });
        }
        if (a.left > 0) {
          // 아직 안 맞힌 가장 가까운 적에게 통 튕겨 간다
          let next: Enemy | null = null;
          let bd = 140 * 140;
          for (const e of w.enemies) {
            if (e.dead || a.hits!.has(e.id) || !this.visible(e)) continue;
            const d = dist2(a.tx, a.ty, e.x, e.y);
            if (d < bd) {
              bd = d;
              next = e;
            }
          }
          if (next) {
            const b = this.lob('tossed', a.tx, a.ty, next.x, next.y, 380);
            if (b) {
              b.p = p;
              b.emoji = a.emoji;
              b.dmg = a.dmg * 0.85;
              b.src = a.src;
              b.left = a.left - 1;
              b.hits = a.hits;
              b.m = a.m;
              b.dir = 0;
            }
          }
        }
        return false;
      }
      case 'swarm': {
        // 구름: 몰린 곳으로 흘러가 덮은 적을 0.25초마다 갉는다
        const p = a.p ?? {};
        let t = a.target && !a.target.dead && this.visible(a.target) ? a.target : null;
        if (!t) {
          t = this.pickTarget('dense', { x: a.x, y: a.y, wall: 0 }, 220) ?? this.pickTarget('dense', undefined, this.LINE - 50);
          a.target = t;
        }
        if (t) {
          const dx = t.x - a.x;
          const dy = t.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(d / dt, (p.speed ?? 220) * 0.6);
          a.x += (dx / d) * sp * dt;
          a.y += (dy / d) * sp * dt;
        }
        a.cd -= dt;
        if (a.cd <= 0) {
          a.cd = 0.25;
          const chainId = w.newChain(1);
          const under = [...w.enemiesNear(a.x, a.y, a.r)];
          for (const e of under) {
            if (e.dead) continue;
            // 붙은 적: 느려지고 모든 피해를 더 받는다 (다른 무기를 돕는 약화). 직접 피해는 작게
            e.infest = Math.max(e.infest, BALANCE.chaos.infestSec);
            e.pack = null;
            this.hit(e, a.dmg * 0.5, p, chainId);
          }
          if (p.chain && under.length > 0 && w.rng.chance(0.3)) this.chainZap(under[0], p.chain, a.dmg);
        }
        return true;
      }
      case 'soul': {
        // 처치한 적의 혼이 정령에게 빨려 간다
        let d: Actor | null = null;
        for (const x of this.actors) if (x.kind === 'drone' && x.id === a.n) d = x;
        if (!d) return false;
        const dx = d.x - a.x;
        const dy = d.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const sp = 140 + 560 * Math.min(1, a.t / 0.7);
        if (dist <= sp * dt + 6) {
          d.left++;
          return false;
        }
        a.x += (dx / dist) * sp * dt;
        a.y += (dy / dist) * sp * dt;
        return true;
      }
      case 'stamp': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        const reach = a.p?.size ?? TRAMPLE_R;
        for (const e of w.enemiesNear(a.x, a.y, reach)) {
          if (a.hits!.has(e.id) || e.pileCol >= 0) continue;
          a.hits!.add(e.id);
          // 밟힌 적만 맞는다 (밟을 때마다 범위 폭발을 냈더니 몰린 적에게 몇 배로 들어가 펭귄·코끼리가 압도적이었다)
          this.hit(e, a.dmg, a.p ?? {}, w.newChain(1));
          this.add('ring', e.x, e.y, { ttl: 0.25, r: 14, emoji: '#ffd36b' });
        }
        if (a.vy < 0) return a.y > -40;
        return a.dir > 0 ? a.x < W + 140 : a.x > -140;
      }
      case 'saw': {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        if ((a.x < 10 && a.vx < 0) || (a.x > W - 10 && a.vx > 0)) a.vx = -a.vx;
        const top = LINE - a.r;
        if ((a.y < top && a.vy < 0) || (a.y > LINE - 10 && a.vy > 0)) a.vy = -a.vy;
        a.cd -= dt;
        if (a.cd <= 0) {
          a.cd = 0.3;
          a.hits!.clear();
        }
        for (const e of w.enemiesNear(a.x, a.y, 14)) {
          if (a.hits!.has(e.id)) continue;
          a.hits!.add(e.id);
          this.hit(e, a.dmg, a.p ?? {}, w.newChain(1));
        }
        return true;
      }
      case 'vortex': {
        for (const e of w.enemiesNear(a.x, a.y, a.r)) {
          if (e.def.boss || e.pileCol >= 0) continue;
          e.pack = null;
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          const pull = Math.min(d, 160 * dt);
          e.x += (dx / d) * pull - (dy / d) * 60 * dt;
          e.y += (dy / d) * pull + (dx / d) * 60 * dt;
          e.held = Math.max(e.held, 0.1);
        }
        if (a.t + dt >= a.ttl) {
          this.boom(a.x, a.y, (a.p?.boom ?? 60) * this.areaMul, a.dmg, a.p ?? undefined);
          if ((a.p?.boom ?? 0) >= 100) w.emit({ type: 'shake', power: 0.7 });
        }
        return true;
      }
      case 'bubble': {
        for (const e of a.grabbed!) {
          if (e.dead) continue;
          e.held = Math.max(e.held, 0.1);
          e.pack = null;
          e.y -= 30 * dt;
        }
        if (a.t + dt >= a.ttl) {
          const chainId = w.newChain(1);
          for (const e of a.grabbed!) if (!e.dead) this.hit(e, a.dmg, a.p ?? {}, chainId);
        }
        return true;
      }
      case 'drone': {
        // 화면 가운데 아래쪽을 돌며 사거리 안 가장 앞의 적을 쏜다
        if (this.lv(a.src) <= 0) return false;
        const k = a.n * 1.7 + w.time * 1.2;
        a.x = W / 2 + Math.cos(k) * 120;
        a.y = LINE - 110 + Math.sin(k * 1.3) * 40;
        a.cd -= dt;
        if (a.cd <= 0) {
          // 레벨이 오르면 바로 반영되게 쏠 때마다 다시 계산
          const spec = ARMS[a.src];
          const p = this.eff(spec).p;
          a.dmg = (p.dmg ?? 0.6) * this.D * this.dmgMul(spec);
          const t = this.pickTarget('front', { x: a.x, y: a.y, wall: 0 }, a.r);
          a.cd = this.cooldownOf(a.src);
          if (t) this.bullet(a.src, a.x, a.y, Math.atan2(t.y - a.y, t.x - a.x), p, a.dmg, a.r, 0);
        }
        // 혼을 SOUL_BURST 개 모으면 터진다: 사방으로 혼탄 열여섯 발
        if (a.left >= SOUL_BURST) {
          a.left = 0;
          const p = this.eff(ARMS[a.src]).p;
          const bp = { ...p, pierce: (p.pierce ?? 0) + 1 };
          for (let i = 0; i < 16; i++) this.bullet(a.src, a.x, a.y, (i / 16) * Math.PI * 2, bp, a.dmg * 2.5, 360, 0);
          this.add('ring', a.x, a.y, { ttl: 0.5, r: 60, emoji: p.color ?? '#b4a0ff' });
          w.emit({ type: 'shake', power: 0.25 });
        }
        return true;
      }
      case 'storm': {
        a.cd -= dt;
        if (a.cd <= 0) {
          a.cd = 0.15;
          const e = this.pickTarget('random', undefined, a.r);
          if (e) {
            w.emit({ type: 'bolt', kind: 'lightning', x1: e.x + w.rng.range(-20, 20), y1: 30, x2: e.x, y2: e.y });
            this.boom(e.x, e.y, 22, a.dmg, a.p ?? undefined);
          }
        }
        return true;
      }
      case 'sweep': {
        a.y += a.vy * dt;
        const half = a.r;
        const wide = half >= 50;
        for (const e of w.enemies) {
          if (e.dead || a.hits!.has(e.id) || Math.abs(e.y - a.y) > 16 + e.radius) continue;
          if (!wide && Math.abs(e.x - a.x) > half + e.radius) continue;
          a.hits!.add(e.id);
          if (a.p?.knock) {
            e.ky -= a.p.knock;
            e.pack = null;
          }
          this.hit(e, a.dmg, a.p ?? {}, w.newChain(1));
        }
        return true;
      }
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
          this.boom(a.tx, a.ty, 48 * this.areaMul, 2.5 * D);
          return false;
        }
        a.x += (dx / d) * k;
        a.y += (dy / d) * k;
        return true;
      }
      case 'sheep':
      case 'soldier': {
        const speed = a.kind === 'sheep' ? 150 : 90;
        const t = this.nearestInZone(a.x, a.y, a.r || this.curRange);
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
          a.vy = -speed * 0.3;
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
          else this.boom(a.tx, a.ty, 34, 1.5 * D, { ignite: true });
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
          const b = this.add('bomb', a.x, a.y + 8, { tx: a.x, ty: a.ty + w.rng.range(-20, 20), vy: 520, ttl: 2 });
          if (b && a.emoji) b.emoji = '🎁';
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
          else {
            this.hit(e, (a.kind === 'dino' ? 3 : 2.5) * D, {}, w.newChain(1));
            this.add('ring', e.x, e.y, { ttl: 0.25, r: 14, emoji: '#ffd36b' });
          }
        }
        if (a.kind === 'cow') return a.y > -40;
        return a.dir > 0 ? a.x < W + 140 : a.x > -140;
      }
      case 'cannon': {
        const shots = Math.floor((a.t - 0.3) / 0.35) + 1;
        const fired = 4 - a.n;
        if (a.t >= 0.3 && shots > fired && a.n > 0) {
          a.n--;
          const t = this.pickTarget('dense', undefined, this.curRange) ?? this.randomPoint(this.curRange);
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
            }
          }
          for (const e of a.grabbed!) {
            if (e.dead) continue;
            e.y -= 80 * dt;
            e.x += (a.x - e.x) * Math.min(1, dt * 3);
            e.held = Math.max(e.held, 0.2);
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
          if (a.p?.ignite) e.burn = Math.max(e.burn, 3);
          const dx = a.x - e.x;
          const dy = a.y - e.y;
          const d = Math.hypot(dx, dy) || 1;
          e.x += ((dx / d) * 90 - (dy / d) * 120) * dt;
          e.y += ((dy / d) * 90 + (dx / d) * 120) * dt;
          e.held = Math.max(e.held, 0.1);
        }
        if (a.t + dt >= a.ttl) {
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
        // 기둥: n = -1 이면 그림만 (낙뢰 손은 이미 맞힘)
        if (a.n >= 0 && a.t < 0.15 && a.t + dt >= 0.15) {
          const chainId = w.newChain(1);
          const top = a.ty < a.y ? 0 : a.ty;
          const dmg = a.dmg || 4 * D;
          for (const e of [...w.enemies]) {
            if (e.dead || Math.abs(e.x - a.x) > (a.r || 20) + e.radius || e.y < Math.max(0, top)) continue;
            this.hit(e, dmg, {}, chainId);
          }
        }
        return true;
      }
    }
    return true;
  }

  private stepBullet(a: Actor, dt: number): boolean {
    const w = this.w;
    const p = a.p ?? {};
    const W = w.field.width;
    // 유도: 목표(없으면 사거리 안 가장 앞)를 향해 돈다
    if (p.homing) {
      let t = a.target && !a.target.dead ? a.target : null;
      if (!t && a.tx !== a.x) {
        const near = w.enemiesNear(a.tx, a.ty, 60)[0];
        if (near) t = near;
      }
      if (!t) t = this.pickTarget('front', { x: a.x, y: a.y, wall: 0 }, 300);
      if (t) {
        a.target = t;
        const want = Math.atan2(t.y - a.y, t.x - a.x);
        const cur = Math.atan2(a.vy, a.vx);
        let dA = want - cur;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        const turn = clamp(dA, -p.homing * dt, p.homing * dt);
        const sp = Math.hypot(a.vx, a.vy);
        a.vx = Math.cos(cur + turn) * sp;
        a.vy = Math.sin(cur + turn) * sp;
      }
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.n > 0) {
      if ((a.x < 4 && a.vx < 0) || (a.x > W - 4 && a.vx > 0)) {
        a.vx = -a.vx;
        a.n--;
      }
      if (a.y < 4 && a.vy < 0) {
        a.vy = -a.vy;
        a.n--;
      }
    }
    if (a.x < -20 || a.x > W + 20 || a.y < -20 || a.y > w.field.height) return false;
    // 블랙홀 구슬: 날아가며 주변을 빨아들이다 끝에서 터짐
    if (p.pullOrb) {
      // 블랙홀 건 구슬이 빨아들이는 반경 (플레이 피드백: 블랙홀이 너무 커서 사기 → 70 에서 40)
      for (const e of w.enemiesNear(a.x, a.y, 40)) {
        if (e.def.boss) continue;
        e.pack = null;
        const dx = a.x - e.x;
        const dy = a.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * 100 * dt;
        e.y += (dy / d) * 100 * dt;
      }
      if (a.t + dt >= a.ttl) this.boom(a.x, a.y, (p.boom ?? 60) * this.areaMul, a.dmg, p);
      return true;
    }
    const size = p.tracer === 'flame' ? 10 : (p.size ?? 3) + 3;
    for (const e of w.enemiesNear(a.x, a.y, size)) {
      if (a.hits!.has(e.id)) continue;
      a.hits!.add(e.id);
      if (p.boom) {
        this.boom(a.x, a.y, p.boom * this.areaMul, a.dmg, p);
        return false;
      }
      if (p.knock) this.push(e, a.x - a.vx, a.y - a.vy, p.knock);
      this.hit(e, a.dmg, p, w.newChain(1));
      if (p.chain) this.chainZap(e, p.chain, a.dmg * 0.6);
      if (p.popcorn) {
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + w.rng.range(0, 1);
          const c = this.add('bullet', e.x, e.y, { vx: Math.cos(ang) * 300, vy: Math.sin(ang) * 300, ttl: 0.25, p: { tracer: 'emoji', emoji: '🍿', size: 7 }, dmg: a.dmg * 0.4, hits: true });
          if (c) {
            c.hits!.add(e.id);
            c.emoji = '🍿';
          }
        }
      }
      a.left--;
      if (a.left < 0) return false;
    }
    // 사거리 끝에서 터지는 탄 (유탄·로켓은 빗나가도 터진다)
    if (p.boom && a.t + dt >= a.ttl) this.boom(a.x, a.y, p.boom * this.areaMul, a.dmg, p);
    return true;
  }

  /** 소환수: 사거리 안 가장 가까운 적에게 가서 자폭하거나, 여러 번 때린다 */
  private stepWalker(a: Actor, dt: number): boolean {
    const w = this.w;
    const p = a.p ?? {};
    const speed = p.speed ?? 100;
    let t = a.target && !a.target.dead && this.visible(a.target) ? a.target : null;
    if (!t) {
      t = this.walkerTarget(a);
      a.target = t;
    }
    a.cd -= dt;
    if (t) {
      const dx = t.x - a.x;
      const dy = t.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      a.dir = dx >= 0 ? 1 : -1;
      const reach = t.radius + (p.size ?? 20) * 0.4;
      if (d < reach) {
        if (!p.melee) {
          this.boom(a.x, a.y, (p.boom ?? 40) * this.areaMul, a.dmg, p);
          return false;
        }
        if (a.cd <= 0) {
          a.cd = 0.35;
          this.hit(t, a.dmg, p, w.newChain(1));
          a.left--;
          if (a.left <= 0) {
            if (p.boom) this.boom(a.x, a.y, p.boom * this.areaMul, a.dmg * 1.5, p);
            return false;
          }
        }
        return true;
      }
      a.x += (dx / d) * speed * dt;
      a.y += (dy / d) * speed * dt;
    } else {
      // 사거리 안에 적이 없으면 사거리 가운데쯤에서 기다린다
      const guardY = this.LINE - a.r * 0.4;
      if (a.y > guardY) a.y -= speed * 0.5 * dt;
    }
    return true;
  }

  /** 잭팟: 777 이면 사거리 안 전부 폭파, 같은 그림 셋이면 그 효과 두 번, 아니면 하나 */
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

  private nuke(): void {
    const w = this.w;
    const chainId = w.newChain(1);
    for (const e of this.inZone(undefined, 360)) {
      w.spawnExplosion({ x: e.x, y: e.y, radius: 24, damage: (e.def.boss ? 15 : 8) * this.D, chainId, source: 'exp', delay: w.rng.range(0, 0.4) });
    }
    w.emit({ type: 'nuke' });
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
    this.gate = { x, y: this.LINE - 150, w: gw, mult: n + 1 };
    const g = this.gate;
    const born: Actor[] = [];
    for (const a of this.actors) {
      if (a.gated || a.t < 0 || !PROJECTILE_KINDS.has(a.kind)) continue;
      if (Math.abs(a.x - g.x) > g.w / 2) continue;
      const prevY = a.y - a.vy * (1 / 60);
      if ((prevY - g.y) * (a.y - g.y) > 0) continue;
      a.gated = true;
      for (let k = 1; k < g.mult; k++) {
        const c: Actor = { ...a, id: this.nextId++, gated: true, hits: a.hits ? new Set(a.hits) : null, grabbed: null, reels: null };
        const off = (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 18;
        if (a.kind === 'bullet') {
          const ang = Math.atan2(a.vy, a.vx) + off * 0.01;
          const sp = Math.hypot(a.vx, a.vy);
          c.vx = Math.cos(ang) * sp;
          c.vy = Math.sin(ang) * sp;
        } else {
          c.x += off;
          c.tx += off;
        }
        born.push(c);
      }
      this.w.emit({ type: 'gate', x: a.x, y: g.y, mult: g.mult });
    }
    for (const c of born) if (this.actors.length < BALANCE.chaos.maxActors) this.actors.push(c);
  }

  // ─── 피해 ──────────────────────────────────────────────

  /** 직접 피해 + 무기 효과(얼림·불·폭약) + 강화(치명타·폭약) */
  private hit(e: Enemy, dmg: number, p: WeaponParams, chainId: number): void {
    const rng = this.w.rng;
    if (this.lv('arm_crit') > 0 && rng.chance(0.06 * this.lv('arm_crit'))) dmg *= 2.5;
    // 약점 공략: 불타거나 언 적에게 더
    const weak = this.lv('arm_explosive');
    if (weak > 0 && (e.burn > 0 || e.frozen > 0)) dmg *= 1 + 0.12 * weak;
    // 피해를 먼저 주고 얼린다 (먼저 얼리면 그 한 방부터 언 적 피해 2.5배가 붙어서 얼리는 무기가 다 셌다)
    this.w.hitFromExp(e, dmg, chainId, 0);
    if (e.dead) return;
    if (p.freeze && !e.def.boss) {
      e.frozen = Math.max(e.frozen, p.freeze);
      e.pack = null;
    }
    if (p.ignite) e.burn = Math.max(e.burn, 3);

  }

  /** 폭발 (연쇄 1단계). 다시 터짐 강화면 가끔 한 번 더 */
  private boom(x: number, y: number, radius: number, damage: number, p?: WeaponParams, _direct = false, chainId?: number): void {
    const w = this.w;
    const tag = p?.ignite ? { ignite: true } : undefined;
    w.spawnExplosion({ x, y, radius, damage, chainId: chainId ?? w.newChain(1), source: 'exp', tag });
    // 얼림은 폭발이 터진 뒤에 (먼저 얼리면 그 폭발이 2.5배로 들어감)
    if (p?.freeze) this.add('chill', x, y, { ttl: 0.05, r: radius, n: p.freeze });
    const re = this.lv('arm_retrigger');
    if (re > 0 && w.rng.chance(0.06 * re)) w.spawnExplosion({ x, y, radius, damage, chainId: w.newChain(1), source: 'exp', delay: 0.2, tag });
  }

  private push(e: Enemy, fromX: number, fromY: number, force: number): void {
    if (e.def.boss || e.pileCol >= 0) return;
    let dx = e.x - fromX;
    let dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) {
      dx = 0;
      dy = -1;
    } else {
      dx /= d;
      dy /= d;
    }
    e.kx += dx * force;
    e.ky += dy * force;
    e.pack = null;
  }

  private chainZap(from: Enemy, n: number, dmg: number): void {
    const w = this.w;
    let cur = from;
    const done = new Set<number>([from.id]);
    for (let i = 0; i < n; i++) {
      let next: Enemy | null = null;
      let bd = 90 * 90;
      for (const e of w.enemiesNear(cur.x, cur.y, 90)) {
        if (done.has(e.id)) continue;
        const d = dist2(cur.x, cur.y, e.x, e.y);
        if (d < bd) {
          bd = d;
          next = e;
        }
      }
      if (!next) break;
      done.add(next.id);
      w.emit({ type: 'bolt', kind: 'lightning', x1: cur.x, y1: cur.y, x2: next.x, y2: next.y });
      this.hit(next, dmg, {}, w.newChain(1));
      cur = next;
    }
  }

  // ─── 대상 고르기 (사거리 안만) ─────────────────────────

  private visible(e: Enemy): boolean {
    return !e.dead && e.y > 10 && e.y < this.LINE + 10 && e.x > 0 && e.x < this.w.field.width;
  }

  /** 사거리 안의 적. from 이 있으면 그 자리에서 반경, 없으면 방어선에서 위로 range 까지 */
  private inZone(from: { x: number; y: number } | undefined, range: number): Enemy[] {
    const out: Enemy[] = [];
    const r2 = range * range;
    const top = this.LINE - range;
    for (const e of this.w.enemies) {
      if (!this.visible(e)) continue;
      if (from ? dist2(from.x, from.y, e.x, e.y) <= r2 : e.y >= top) out.push(e);
    }
    return out;
  }

  private pickTarget(mode: 'front' | 'near' | 'strong' | 'random' | 'dense', from: Mount | { x: number; y: number; wall: number } | undefined, range: number): Enemy | null {
    const pool = this.inZone(from, range);
    if (pool.length === 0) return null;
    switch (mode) {
      case 'random':
        return pool[this.w.rng.int(pool.length)];
      case 'strong': {
        let b = pool[0];
        for (const e of pool) if (e.hp > b.hp) b = e;
        return b;
      }
      case 'near': {
        if (!from) return pool[0];
        let b = pool[0];
        let bd = Infinity;
        for (const e of pool) {
          const d = dist2(from.x, from.y, e.x, e.y);
          if (d < bd) {
            bd = d;
            b = e;
          }
        }
        return b;
      }
      case 'dense': {
        const step = Math.max(1, Math.floor(pool.length / 30));
        let b = pool[0];
        let bn = -1;
        for (let i = 0; i < pool.length; i += step) {
          const c = pool[i];
          const n = this.w.enemiesNear(c.x, c.y, 55).length + c.y / 1000;
          if (n > bn) {
            bn = n;
            b = c;
          }
        }
        return b;
      }
      default: {
        // 가장 앞 (방어선에 가장 가까운)
        let b = pool[0];
        for (const e of pool) if (e.y > b.y) b = e;
        return b;
      }
    }
  }

  /** 소환수가 맡을 적: 다른 소환수가 아직 안 맡은 적 중 가장 가까운 것 (다 맡았으면 가장 가까운 것) */
  private walkerTarget(a: Actor): Enemy | null {
    const pool = this.inZone(undefined, a.r);
    if (pool.length === 0) return null;
    const claimed = new Map<number, number>();
    for (const o of this.actors) if (o !== a && o.kind === 'walker' && o.target && !o.target.dead) claimed.set(o.target.id, (claimed.get(o.target.id) ?? 0) + 1);
    let best: Enemy | null = null;
    let bs = Infinity;
    for (const e of pool) {
      const s = (claimed.get(e.id) ?? 0) * 1e7 + dist2(a.x, a.y, e.x, e.y);
      if (s < bs) {
        bs = s;
        best = e;
      }
    }
    return best;
  }

  private nearestInZone(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    const top = this.LINE - range;
    for (const e of this.w.enemies) {
      if (!this.visible(e) || e.y < top) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private randomPoint(range: number): { x: number; y: number } {
    return { x: this.w.rng.range(40, this.w.field.width - 40), y: this.w.rng.range(this.LINE - range, this.LINE - 30) };
  }
}
