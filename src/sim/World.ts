import { BALANCE, enemyHp, packInterval, packSize, runReward, xpToNext } from '../data/balance';
import type { BossId } from '../data/bosses';
import { getChapter, type ChapterDef } from '../data/chapters';
import type { EnemyDef, EnemyKind } from '../data/enemies';
import { getEnemyDef } from '../data/lookup';
import { AUGMENTS } from '../data/augments';
import { clamp, dist2 } from '../core/math';
import { reactName } from '../data/combineV4';
import { Rng, deriveSeed } from '../core/rng';
import { SpatialGrid } from '../core/spatial';
import { AugmentManager } from './augments';
import type { ExplosionSpec, MineSpec, SimApi, ZoneSpec } from './api';
import type { SimEvent } from './events';
import { Chaos } from './chaos';
import { Experiments, type Shot } from './exp';
import { computeStats, type PlayerStats } from './stats';
import {
  RULE_IDS,
  CHAIN_BUCKETS,
  chainBucket,
  isDirect,
  type Chain,
  type Command,
  type DamageSource,
  type Enemy,
  type Explosion,
  type Mine,
  type Offer,
  type OfferKind,
  type Pack,
  type RunRules,
  type Phase,
  type RunConfig,
  type RunResult,
  type RunSummary,
  type Zone,
} from './types';

const ZONE_TICK_SEC = 0.25;
const MINE_TRIGGER_RADIUS = 14;
const MINE_ARM_SEC = 0.3;
/** 보스 등 큰 적까지 격자 질의에 걸리도록 여유 */
const MAX_ENEMY_RADIUS = 32;
/** 판 시작 후 첫 무리가 내려오기까지 (초) */
const FIRST_PACK_SEC = 1;
/** 무리 구성원끼리 겹치지 않게 자리를 다시 뽑는 횟수 */
const PACK_PLACE_TRIES = 12;

/**
 * 한 판의 전체 상태와 진행.
 *
 * - DOM·시간·Math.random 에 의존하지 않는다 → 브라우저·Node(자동 플레이)·테스트에서 똑같이 돈다.
 * - step(FIXED_DT, commands) 만으로 진행한다. 같은 시드 + 같은 commands = 같은 결과.
 * - 연출은 drainEvents() 로 꺼내 가서 처리한다.
 */
export class World implements SimApi {
  readonly config: RunConfig;
  readonly chapter: ChapterDef;
  readonly field = BALANCE.field;
  /** 전투 스트림 (치명타, 분열 위치, 증강 훅) */
  readonly rng: Rng;
  private readonly spawnRng: Rng;
  readonly augments: AugmentManager;
  stats: PlayerStats;

  phase: Phase = 'playing';
  result: RunResult | null = null;
  time = 0;
  life: number;
  /** 모으는 탭 게이지 (1 = 100%, 상한 stats.gaugeMax) */
  gauge: number;
  wave = 1;
  waveTimer = 0;
  private spawnTimer = 0;
  private bossTimer = 0;
  finalBossSpawned = false;
  private victoryPending = false;
  level = 1;
  xp = 0;
  kills = 0;
  maxChain = 0;
  /** 폭발을 만든 탭 수 (헛탭 제외). 탭당 처치 = kills / taps */
  taps = 0;
  /** 연쇄 환급 횟수 */
  refunds = 0;
  /** 판 동안 쌓인 피해 배율 (보스 처치·연쇄 공명). 증강 배율과 곱해져 stats.damageMult 가 된다 */
  runMult = 1;
  /** 실험 규칙 */
  readonly rules: RunRules;
  /** 11-07 실험 묶음 (exp.ts) */
  readonly exp: Experiments;
  /** 도파민 모드 (chaos.ts). 꺼져 있으면 null */
  readonly chaos: Chaos | null;
  /** 과충전 폭주 뒤 남은 과열 시간 (이 동안 못 쏨) */
  overheat = 0;
  /** 과충전 규칙: 100% 에서 누르고 있는 중 (이 동안만 100% 를 넘어 찬다, 떼면 쏨) */
  charging: { x: number; y: number } | null = null;
  /** 불씨 칠하기: 지난 스텝의 손끝 위치 (움직인 길만 칠함) */
  private paintFrom: { x: number; y: number } | null = null;
  overloads = 0;
  /** 연쇄 잇기 콤보: 처치 수와 끊기기까지 남은 시간 */
  readonly combo = { kills: 0, timer: 0 };
  maxCombo = 0;
  brinkKills = 0;
  sparkBlasts = 0;
  pairBlasts = 0;
  /** 쌓이는 바닥: 칸마다 아래부터 쌓인 블록 */
  readonly pileCols: Enemy[][] = [];
  pileLanded = 0;
  pileCleared = 0;
  pileMaxRows = 0;
  private nextPairColor = 0;
  rerollsLeft: number;
  bonusParts = 0;

  readonly enemies: Enemy[] = [];
  readonly packs: Pack[] = [];
  readonly explosions: Explosion[] = [];
  readonly zones: Zone[] = [];
  readonly mines: Mine[] = [];
  private readonly chains = new Map<number, Chain>();
  offer: Offer | null = null;
  private readonly offerQueue: OfferKind[] = [];
  private offerWait = 0;
  private readonly chainHistogram = CHAIN_BUCKETS.map(() => 0);

  private nextId = 1;
  private events: SimEvent[] = [];
  private readonly recordEvents: boolean;
  private readonly grid = new SpatialGrid<Enemy>(64);
  private readonly boxBuf: Enemy[] = [];
  private readonly readyBuf: Explosion[] = [];
  private readonly hitBuf: Enemy[] = [];

  constructor(config: RunConfig) {
    this.config = config;
    this.chapter = getChapter(config.chapterId);
    this.rng = new Rng(deriveSeed(config.seed, 'combat'));
    this.spawnRng = new Rng(deriveSeed(config.seed, 'spawn'));
    this.augments = new AugmentManager(new Rng(deriveSeed(config.seed, 'augment')), AUGMENTS);
    this.recordEvents = config.recordEvents ?? true;
    this.rules = config.rules ?? {};
    this.exp = new Experiments(this, this.rules);
    this.chaos = this.rules.chaos ? new Chaos(this) : null;
    if (this.rules.pile) {
      const n = Math.ceil(this.field.width / BALANCE.experiment.pile.colWidth);
      for (let i = 0; i < n; i++) this.pileCols.push([]);
    }
    this.stats = this.withRules(computeStats(config.meta, []));
    this.life = this.stats.maxLife;
    this.gauge = Math.min(1, this.stats.gaugeMax);
    this.rerollsLeft = config.meta.rerolls;
    // 도파민 모드: 시작 무기부터 고른다 (선행 증강은 그다음). 합성 시험판은 무기 여섯을 들고 바로 합성 카드부터
    if (this.chaos && config.fusionLab) {
      this.chaos.startLab();
      this.offerQueue.push('level', 'level');
    }
    else if (this.chaos) this.offerQueue.push('starter');
    for (let i = 0; i < config.meta.headStartPicks; i++) this.offerQueue.push('start');
    this.spawnTimer = packInterval(1) - FIRST_PACK_SEC;
  }

  // ═══════════════════════════════════════════════════════════
  // 진행
  // ═══════════════════════════════════════════════════════════

  step(dt: number, commands: readonly Command[] = []): void {
    for (const c of commands) this.applyCommand(c);
    if (this.phase !== 'playing') return;

    if (this.offerQueue.length > 0) {
      this.offerWait += dt;
      // 연쇄가 터지는 도중에 선택창이 뜨면 손맛이 끊기므로, 연쇄가 끝날 때까지 기다린다
      if (this.explosions.length === 0 || this.offerWait >= BALANCE.augment.offerMaxWaitSec) {
        this.openNextOffer();
        if (this.phase !== 'playing') return;
      }
    }

    this.time += dt;
    // 누를 때만 시간: 손을 떼면 적·웨이브·지속 피해가 거의 멈춘다 (폭발·연쇄는 그대로 터짐)
    const flow = dt * this.exp.timeScale();
    this.updateGauge(dt);
    this.updateCombo(dt);
    if (!this.config.sandbox) this.updateWaves(flow);
    this.moveEnemies(flow);
    if (this.chaos) this.separateEnemies();
    this.rebuildGrid();
    this.paintSparks();
    this.exp.update(flow);
    this.chaos?.update(flow);
    this.updateExplosions(dt);
    this.updateZones(flow);
    this.updateMines(flow);
    this.augments.onTick(this, flow);
    this.compactEnemies();
    this.sweepChains();

    if (this.life <= 0) this.end('defeat');
    else if (this.victoryPending) this.end('victory');
  }

  /** 위로 가는 움직임(dy<0)을 한도까지만 (합성 판만). 아래로는 그대로 */
  liftMove(e: Enemy, dy: number): number {
    const f = this.chaos?.fusion;
    return f && f.mode === 4 && f.active ? this.lifted(e, dy) : dy;
  }
  private lifted(e: Enemy, dy: number): number {
    if (dy >= 0) return dy;
    const room = Math.max(0, BALANCE.chaos.liftCap - e.lift);
    const up = Math.min(-dy, room);
    e.lift += up;
    if (up < -dy) e.ky = Math.max(0, e.ky);
    return -up;
  }

  /**
   * 넉백 세기 (합성 판의 제어 저항): 저항 중이면 0, 저항 게이지가 찰수록 약하게. 밀린 세기만큼 게이지에 쌓인다.
   * 11-13 v5 잠금 검사: 저항이 시간만 막아서 1.5초 안에 크게 날려 보내면 2초 저항 동안 내려온 것보다 더 올라갔다.
   * 모든 넉백(밀침·폭발 넉백·쓸기)이 이걸 거친다.
   */
  knockScale(e: Enemy, force: number): number {
    const f = this.chaos?.fusion;
    if (!f || f.mode !== 4 || !f.active) return 1;
    if (e.ccImmune > 0) return 0;
    const ccMax = BALANCE.chaos.ccMax;
    const k = Math.max(0.25, 1 - e.cc / ccMax);
    e.cc += Math.min(0.6, (Math.abs(force) * k) / 250);
    return k;
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** 앱에서 "포기" */
  quit(): void {
    if (this.phase !== 'ended') this.end('quit');
  }

  private end(result: RunResult): void {
    this.phase = 'ended';
    this.result = result;
    this.offer = null;
    this.emit({ type: 'runEnd', result });
  }

  // ═══════════════════════════════════════════════════════════
  // 입력
  // ═══════════════════════════════════════════════════════════

  private applyCommand(c: Command): void {
    switch (c.t) {
      case 'press':
        if (this.phase === 'playing') this.onPress(c.x, c.y);
        break;
      case 'move':
        this.chaos?.onMove(c.x, c.y);
        // 과충전 중에는 손가락을 따라 조준이 움직인다
        if (this.charging) {
          this.charging.x = clamp(c.x, 0, this.field.width);
          this.charging.y = clamp(c.y, 0, this.field.height);
        }
        break;
      case 'release':
        if (this.phase === 'playing') this.chaos?.onRelease(c.x, c.y);
        if (this.charging && this.phase === 'playing') {
          const at = this.charging;
          this.charging = null;
          this.fire(at.x, at.y);
        }
        break;
      case 'choose':
        if (this.phase === 'choosing') this.choose(c.index);
        break;
      case 'reroll':
        if (this.phase === 'choosing') this.reroll();
        break;
    }
  }

  /**
   * 모으는 탭: 게이지를 전부 써서 터진다.
   * 무한 연쇄: 연쇄가 이어지는 동안에는 게이지를 쓰지 않고 max(게이지, freeTapPower) 크기로 터진다.
   */
  private onPress(px: number, py: number): void {
    const x = clamp(px, 0, this.field.width);
    const y = clamp(py, 0, this.field.height);
    // 도파민 모드: 황금 쿠키를 누른 탭은 쿠키만 먹는다. 손공격 무기는 탭한 자리에서 나가고,
    // 폭탄 탭이 없으면 탭은 거기서 끝 (포탑·소환수로 시작한 판)
    if (this.chaos) {
      if (this.chaos.tryPickup(x, y)) return;
      if (this.chaos.trySelect(x, y)) return;
      this.chaos.onTap(x, y);
      if (!this.chaos.hasBomb) return;
    }
    // 과충전 규칙: 100% 가 찬 상태에서 누르면 바로 쏘지 않고 과충전을 시작한다 (떼면 쏨)
    const free = this.stats.freeTapDuringChain && this.explosions.length > 0;
    const startsCharge = this.gauge >= 1 || this.exp.pressStartsCharge();
    if (this.overloadable && !free && startsCharge && this.overheat <= 0 && !this.charging) {
      this.charging = { x, y };
      this.paintFrom = null;
      return;
    }
    this.fire(x, y);
  }

  private fire(x: number, y: number): void {
    const s = this.stats;
    const free = s.freeTapDuringChain && this.explosions.length > 0;
    const power = free ? Math.max(this.gauge, BALANCE.prism.infiniteChain.freeTapPower) : this.gauge;

    if (power < BALANCE.tap.gauge.minFire || this.overheat > 0) {
      this.emit({ type: 'dryTap', x, y });
      return;
    }

    const crit = this.rng.chance(s.critChance);
    let damage = this.tapDamageAt(power) * this.comboMult();
    if (crit) damage *= s.critMultiplier;
    // 실험 규칙이 탭 한 발을 고친다 (모양·색·지연, 지뢰·씨앗이면 폭발 대신)
    const shot: Shot = { x, y, power, radius: this.tapRadiusAt(power), damage, depth: this.chainDepthAt(power), delay: 0, tag: {}, cancel: false };
    this.exp.onFire(shot);
    this.chaos?.onFire(shot);
    if (!free) this.gauge = shot.gaugeAfter ?? Math.min(power, s.gaugeLeftover);
    if (shot.cancel) {
      this.taps++;
      return;
    }
    this.taps++;
    this.emit({ type: 'tap', x, y, free, power });
    const chainId = this.newChain(shot.depth);
    const tag = shot.tag;
    if (tag.color !== undefined || tag.knock !== undefined) this.chains.get(chainId)!.tag = { color: tag.color, knock: tag.knock };
    this.spawnExplosion({
      x, y, radius: shot.radius, damage: shot.damage, chainId, source: 'tap', crit,
      edgeMul: tag.row ? 1 : s.tapEdgeMul, delay: shot.delay, tag,
    });
    this.exp.afterFire(shot, chainId);
  }

  /** 게이지 power(1 = 100%)로 쏘면 반경이 얼마인가 (렌더러 미리보기·봇도 씀) */
  tapRadiusAt(power: number): number {
    const G = BALANCE.tap.gauge;
    return this.stats.tapRadius * (G.radiusAt0 + (G.radiusAt1 - G.radiusAt0) * power);
  }

  /** 탭 피해. 게이지와 무관 (게이지는 크기·연쇄 단계, 피해는 화력 축) */
  tapDamageAt(_power: number): number {
    return this.stats.tapDamage * BALANCE.tap.gauge.damage;
  }

  /** 게이지 power 로 쏘면 연쇄가 몇 단계까지 가나 (0 = 연쇄 없음) + 증강 보너스 */
  chainDepthAt(power: number): number {
    let d = 0;
    for (const at of BALANCE.tap.gauge.chainDepthAt) if (power >= at - 1e-9) d++;
    return d > 0 ? d + this.stats.chainDepthBonus : 0;
  }

  // ═══════════════════════════════════════════════════════════
  // 증강 선택
  // ═══════════════════════════════════════════════════════════

  private openNextOffer(): void {
    while (this.offerQueue.length > 0) {
      const kind = this.offerQueue.shift()!;
      const choices = this.chaos ? this.chaos.roll(kind) : this.augments.roll(kind, this.level);
      if (choices.length === 0) continue;
      this.offer = { kind, choices };
      this.phase = 'choosing';
      this.offerWait = 0;
      // 선택창이 뜨면 과충전은 쏘지 않고 취소 (게이지는 100% 로)
      if (this.charging) {
        this.charging = null;
        this.gauge = Math.min(this.gauge, 1);
      }
      this.emit({ type: 'offer', kind });
      return;
    }
    this.offerWait = 0;
  }

  private choose(index: number): void {
    const id = this.offer?.choices[index];
    if (!id) return;
    // 갈래 합성 카드 (도파민 모드)
    if (id.startsWith('fuse:') && this.chaos) {
      this.chaos.applyFuse(id);
      this.offer = null;
      this.phase = 'playing';
      return;
    }
    const def = this.augments.acquire(id, this);
    this.recomputeStats();
    this.offer = null;
    this.phase = 'playing';
    this.emit({ type: 'augment', id, rarity: def.rarity });
  }

  private reroll(): void {
    if (!this.offer || this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.offer = { kind: this.offer.kind, choices: this.chaos ? this.chaos.roll(this.offer.kind) : this.augments.roll(this.offer.kind, this.level) };
  }

  private recomputeStats(): void {
    const before = this.stats.damageMult;
    this.stats = this.withRules(computeStats(this.config.meta, this.augments.active(), this.runMult));
    if (this.stats.damageMult > before + 1e-9) this.emit({ type: 'mult', value: this.stats.damageMult });
    this.gauge = Math.min(this.gauge, this.stats.gaugeMax);
    this.life = Math.min(this.life, this.stats.maxLife);
  }

  private queueOffer(kind: OfferKind): void {
    this.offerQueue.push(kind);
  }

  get pendingOffers(): number {
    return this.offerQueue.length;
  }

  // ═══════════════════════════════════════════════════════════
  // 시스템
  // ═══════════════════════════════════════════════════════════

  /** 실험 규칙이 능력치에 주는 변화 (과충전: 게이지 상한 150%) */
  private withRules(s: PlayerStats): PlayerStats {
    if (this.overchargeOn) s.gaugeMax = Math.max(s.gaugeMax, BALANCE.experiment.overcharge.max);
    return s;
  }

  /** 과충전 규칙에서 상한에 닿으면 폭주하는가 (초신성이 상한을 더 올렸으면 폭주 없음) */
  get overloadable(): boolean {
    return this.overchargeOn && this.stats.gaugeMax <= BALANCE.experiment.overcharge.max;
  }

  /**
   * 과충전은 기본 규칙이다 (플레이 피드백: "모았다가 팡"이 그나마 나으니 메인으로).
   * 100% 에서 꾹 누르면 150% 까지 차고 떼면 발사, 넘기면 폭주. rules.overcharge 는 옛 세이브 호환용으로만 남음.
   */
  private get overchargeOn(): boolean {
    return true;
  }

  /**
   * 게이지는 100% 까지 fillSec 동안 찬다. 100% 를 넘는 구간은
   *   과충전: 누르고 있는 동안만, 1 → 1 + accel 배로 점점 빨라지다 상한에서 폭주 (떼면 그 크기로 쏨)
   *   초신성: overfillRate 배 속도로 상한까지
   */
  private updateGauge(dt: number): void {
    if (this.overheat > 0) {
      this.overheat = Math.max(0, this.overheat - dt);
      return;
    }
    const s = this.stats;
    if (this.gauge >= s.gaugeMax) return;
    // 과충전 규칙: 100% 넘게는 누르고 있을 때만 찬다
    if (this.overloadable && this.gauge >= 1 && !this.charging) return;
    if (!this.exp.gaugeFills()) return;
    let rate = 1;
    if (this.gauge >= 1) {
      if (this.overloadable) {
        const OC = BALANCE.experiment.overcharge;
        rate = 1 + (OC.accel * (this.gauge - 1)) / (OC.max - 1);
      } else rate = BALANCE.prism.supernova.overfillRate;
    }
    rate *= this.chaos?.gaugeRateMul() ?? 1;
    // 과충전: 누르고 있지 않으면 100% 에서 딱 멈춘다
    this.fillGauge((rate / s.gaugeFillSec) * dt, this.overloadable && !this.charging ? 1 : s.gaugeMax);
    if (this.overloadable && this.gauge >= s.gaugeMax) this.overload();
  }

  /**
   * 불씨 칠하기: 과충전으로 누르고 있는 동안 손끝 붓(brush)이 **움직이며 지나간 길**의 적에 불씨를 붙인다
   * (피해·게이지 변화 없음). 가만히 누르고만 있으면 안 칠해진다.
   */
  private paintSparks(): void {
    const c = this.charging;
    if (!c || !this.rules.paint) return;
    const last = this.paintFrom;
    this.paintFrom = { x: c.x, y: c.y };
    if (!last) return;
    const len = Math.hypot(c.x - last.x, c.y - last.y);
    if (len < 0.5) return;
    // 지난 위치 → 지금 위치 선분을 따라 붓 반경 간격으로 칠한다 (빠르게 그어도 빈틈 없게)
    const brush = BALANCE.experiment.paint.brush;
    const n = Math.max(1, Math.ceil(len / brush));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const hits = this.collectEnemiesNear(last.x + (c.x - last.x) * t, last.y + (c.y - last.y) * t, brush, this.hitBuf);
      for (const e of hits) if (!e.spark && !e.def.deathBlast) e.spark = true;
    }
  }

  /**
   * 짝 폭발형: 새 폭발형은 다른 무리의 짝 없는 폭발형 중 가장 먼 것과 짝을 맺는다 (minDistance 이상일 때만).
   * 동시에 살아 있는 짝은 maxActive 쌍까지.
   */
  private assignPair(e: Enemy, pack: Pack): void {
    const P = BALANCE.experiment.pairs;
    let active = 0;
    let best: Enemy | null = null;
    let bestD = P.minDistance * P.minDistance;
    for (const x of this.enemies) {
      if (x.dead || x === e) continue;
      if (x.partner) {
        active++;
        continue;
      }
      if (!x.def.deathBlast || x.def.boss || x.pack === pack) continue;
      const d = dist2(x.x, x.y, e.x, e.y);
      if (d >= bestD) {
        bestD = d;
        best = x;
      }
    }
    if (!best || active / 2 >= P.maxActive) return;
    const color = this.nextPairColor++ % P.maxActive;
    e.partner = best;
    best.partner = e;
    e.pairColor = best.pairColor = color;
  }

  /** 과충전 폭주: 게이지가 날아가고 잠깐 쏠 수 없다 */
  private overload(): void {
    this.charging = null;
    this.gauge = 0;
    this.overheat = BALANCE.experiment.overcharge.overheatSec;
    this.overloads++;
    this.emit({ type: 'overload' });
  }

  /** 시간으로 차는 게이지 (상한까지). 100% 를 넘는 순간 gaugeFull */
  private fillGauge(amount: number, cap = this.stats.gaugeMax): void {
    const before = this.gauge;
    this.gauge = Math.min(cap, this.gauge + amount);
    if (before < 1 && this.gauge >= 1) this.emit({ type: 'gaugeFull' });
  }

  /** 연쇄 잇기: 처치 없이 windowSec 이 지나면 콤보가 끊긴다 */
  private updateCombo(dt: number): void {
    const c = this.combo;
    if (c.timer <= 0) return;
    c.timer -= dt;
    if (c.timer <= 0) {
      if (c.kills > 0) this.emit({ type: 'comboEnd', kills: c.kills });
      c.kills = 0;
      c.timer = 0;
    }
  }

  /** 연쇄 잇기 콤보 배율 (규칙이 꺼져 있으면 1) */
  comboMult(): number {
    if (!this.rules.combo) return 1;
    const C = BALANCE.experiment.combo;
    return Math.min(C.maxMult, 1 + C.perKill * this.combo.kills);
  }

  private updateWaves(dt: number): void {
    const W = BALANCE.wave;
    const ch = this.chapter;
    const endless = this.config.mode === 'endless';

    this.waveTimer += dt;
    if (this.waveTimer >= W.durationSec) {
      if (endless || this.wave < ch.waves) {
        this.waveTimer -= W.durationSec;
        this.wave++;
        this.emit({ type: 'wave', wave: this.wave });
      } else if (!this.finalBossSpawned) {
        this.finalBossSpawned = true;
        this.spawnBoss(ch.finalBoss, true);
      }
    }

    if (!this.finalBossSpawned) {
      this.bossTimer += dt;
      if (this.bossTimer >= ch.miniBossIntervalSec) {
        this.bossTimer -= ch.miniBossIntervalSec;
        this.spawnBoss(ch.miniBoss, false);
      }
    }

    this.spawnTimer += dt;
    const C = BALANCE.chaos;
    const chaosPack = Math.max(C.packIntervalMin, C.packIntervalMul - C.packIntervalPerWave * (this.wave - 1));
    const interval = packInterval(this.wave) * (this.rules.chaos ? chaosPack : 1);
    while (this.spawnTimer >= interval) {
      // 화면 안 적 상한: 무리가 다 들어갈 자리가 없으면 자리가 날 때까지 미룬다
      if (this.enemies.length + BALANCE.wave.packSizeMax + 1 > BALANCE.limits.maxEnemies) {
        this.spawnTimer = interval;
        break;
      }
      this.spawnTimer -= interval;
      this.spawnPack();
    }
  }

  /**
   * 무리 하나를 화면 위 바깥에 내린다. 구성원 종류는 하나씩 따로 뽑아서
   * 폭발형(노릴 곳)·장갑/보호막(연쇄를 끊는 곳)이 무리 안에 섞인다.
   */
  spawnPack(): void {
    const W = BALANCE.wave;
    const rng = this.spawnRng;
    // 폭발형을 쓰는 실험 규칙을 켜면 폭발형은 처음부터 나온다 (챕터 1 은 웨이브 3부터라 1분 동안 해볼 게 없었다)
    const r = this.rules;
    const bombsEarly = !!(r.magnet || r.ripen || r.bouncer || r.pairs);
    const pool = this.chapter.roster.filter((x) => x.fromWave <= this.wave || (bombsEarly && x.kind === 'explosive'));
    const size = Math.max(1, packSize(this.wave) + rng.int(3) - 1);
    const spread = W.packSpread * Math.max(1, Math.sqrt(size / W.packSpreadRefSize));
    const cx = rng.range(spread + 12, this.field.width - spread - 12);
    // 무리 전체가 화면 위 바깥에서 시작하도록 아래 끝을 spawnY 에 맞춘다
    const cy = this.field.spawnY - spread;
    const pack: Pack = { id: this.nextId++, x: cx, y: cy, speed: Number.POSITIVE_INFINITY, members: 0, dx: 0, dy: 1 };
    const spawned: Enemy[] = [];

    const placed: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < size; i++) {
      const entry = rng.weighted(pool, (r) => r.weight ?? getEnemyDef(r.kind).spawnWeight);
      if (!entry) break;
      const def = getEnemyDef(entry.kind);
      const p = this.packSpot(cx, cy, spread, def, placed);
      placed.push(p);
      const e = this.spawnEnemy(def.id, p.x, p.y);
      if (e) spawned.push(e);
      if (e && this.rules.pairs && def.deathBlast && !def.boss) this.assignPair(e, pack);
      if (!e || def.loner) continue;
      // 무리는 가장 느린 구성원 속도로 같이 내려온다
      e.pack = pack;
      e.packOx = e.x - cx;
      e.packOy = e.y - cy;
      pack.speed = Math.min(pack.speed, e.speed);
      pack.members++;
    }
    this.exp.placePack(pack, spawned);
    if (pack.members > 0) this.packs.push(pack);
  }

  /** 무리 안 빈자리. 몇 번 뽑아도 겹치면 마지막 자리를 그대로 쓴다 */
  private packSpot(cx: number, cy: number, spread: number, def: EnemyDef, placed: readonly { x: number; y: number; r: number }[]): { x: number; y: number; r: number } {
    const rng = this.spawnRng;
    let x = cx;
    let y = cy;
    for (let t = 0; t < PACK_PLACE_TRIES; t++) {
      const a = rng.range(0, Math.PI * 2);
      const d = spread * Math.sqrt(rng.next());
      x = cx + Math.cos(a) * d;
      y = cy + Math.sin(a) * d;
      let ok = true;
      for (const q of placed) {
        const rr = q.r + def.radius + 3;
        if (dist2(x, y, q.x, q.y) < rr * rr) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }
    return { x, y, r: def.radius };
  }

  private spawnBoss(id: BossId, final: boolean): void {
    const e = this.spawnEnemy(id, this.field.width / 2, this.field.spawnY - 10, final ? this.chapter.finalBossHpMul : 1);
    if (!e) return;
    e.isFinalBoss = final;
    this.emit({ type: 'bossSpawn', id, final });
  }

  private moveEnemies(dt: number): void {
    const W = this.field.width;
    const wind = this.exp.windAt();
    const core = !!this.rules.core;
    for (const p of this.packs) {
      p.x += p.dx * p.speed * dt + wind * dt;
      p.y += p.dy * p.speed * dt;
    }
    const pile = !!this.rules.pile;
    const damp = Math.exp(-BALANCE.experiment.knockback.damping * dt);
    const ccResist = !!this.chaos && this.chaos.fusion.mode === 4 && this.chaos.fusion.active;
    for (const e of this.enemies) {
      if (e.dead) continue;
      // 쌓인 블록: 아래 블록이 사라졌으면 떨어진다
      if (e.pileCol >= 0) {
        if (e.y < e.pileY) e.y = Math.min(e.pileY, e.y + BALANCE.experiment.pile.fallSpeed * dt);
        continue;
      }
      // 제어 저항 (합성 v4): 계속 묶이거나 밀려나면 잠깐 안 묶인다. 조합으로 적이 아예 못 다가오게 되는 것을 막는다
      if (ccResist) {
        if (e.lift > 0) e.lift = Math.max(0, e.lift - BALANCE.chaos.liftDecay * dt);
        const C2 = BALANCE.chaos;
        if (e.ccImmune > 0) {
          e.ccImmune -= dt;
          // 저항이 끝나도 게이지는 반쯤 남는다 (곧바로 다시 크게 날려 보내 잠그지 못하게, 11-13 v5 잠금 검사)
          if (e.ccImmune <= 0) e.cc = BALANCE.chaos.ccMax * 0.5;
          e.held = 0;
          e.frozen = 0;
          // 매혹도 풀린다 (11-13 v5 잠금 검사: 돌려세운 적이 저항 중에도 거슬러 올라가 잠금 21)
          e.charm = 0;
        } else {
          const stop = e.held > 0 || e.frozen > 0 || e.charm > 0 || Math.abs(e.kx) + Math.abs(e.ky) > 40;
          const slowed = e.poly > 0 || e.infest > 0;
          e.cc = stop ? e.cc + dt : slowed ? e.cc + dt * 0.5 : Math.max(0, e.cc - dt * C2.ccDecay);
          if (e.cc >= C2.ccMax && !e.def.boss) {
            e.cc = 0;
            e.ccImmune = C2.ccImmune;
            e.held = 0;
            e.frozen = 0;
            e.charm = 0;
            e.kx = e.ky = 0;
            this.emit({ type: 'resist', x: e.x, y: e.y });
          }
        }
      }
      // 얼리고 깨기: 언 적은 멈춘다
      if (e.frozen > 0 || e.held > 0) continue;
      const p = e.pack;
      if (p) {
        e.x = p.x + e.packOx;
        e.y = p.y + e.packOy;
      } else {
        // 떼가 붙은 적·변이된 적은 느리다 (붙을 때 무리에서 떨어져 혼자 움직인다). 매혹된 적은 거슬러 올라간다
        const C = BALANCE.chaos;
        // 저항 중엔 감속도 안 통한다
        const slow = e.ccImmune > 0 ? 1 : (e.infest > 0 ? C.infestSlow : 1) * (e.poly > 0 ? C.polySlow : 1);
        const dir = e.charm > 0 ? -1 : 1;
        e.x += e.dx * e.speed * slow * dt + wind * dt;
        e.y += ccResist ? this.lifted(e, e.dy * e.speed * slow * dt * dir) : e.dy * e.speed * slow * dt * dir;
      }
      // 밀어내기: 받은 속도로 날아가다 점점 멈춘다
      if (e.kx !== 0 || e.ky !== 0) {
        e.x += e.kx * dt;
        e.y += ccResist ? this.lifted(e, e.ky * dt) : e.ky * dt;
        e.kx *= damp;
        e.ky *= damp;
        if (Math.abs(e.kx) + Math.abs(e.ky) < 2) e.kx = e.ky = 0;
      }
      if (!core) e.x = clamp(e.x, e.radius, W - e.radius);
      // 쌓이는 바닥: 방어선이나 더미 위에 닿으면 블록이 된다 (최종 보스는 그대로 즉시 패배)
      if (pile && !e.isFinalBoss) {
        const col = this.pileColAt(e.x);
        if (e.y + e.radius >= this.pileTopY(col)) {
          this.landOnPile(e, col);
          if (this.phase === 'ended') return;
          continue;
        }
      }
      if (this.exp.leaked(e)) {
        e.dead = true;
        // 짝이 방어선을 넘으면 짝 관계만 끊긴다 (남은 쪽은 보통 폭발형)
        if (e.partner) {
          e.partner.partner = null;
          e.partner = null;
        }
        // 최종 보스가 방어선을 넘으면 즉시 패배
        const damage = e.isFinalBoss ? this.life : e.def.leak;
        this.life -= damage;
        this.emit({ type: 'leak', x: e.x, damage });
      }
    }
  }

  /** 적이 x 에서 내려앉는 높이 (쌓이는 바닥이면 그 칸 더미 윗면, 아니면 방어선) */
  landingY(x: number): number {
    return this.rules.pile ? this.pileTopY(this.pileColAt(x)) : this.field.defenseLineY;
  }

  /** 쌓이는 바닥: 가장 높은 칸의 블록 수 */
  pileHeight(): number {
    let h = 0;
    for (const c of this.pileCols) if (c.length > h) h = c.length;
    return h;
  }

  /** 쌓이는 바닥: x 가 속한 칸 */
  private pileColAt(x: number): number {
    return clamp(Math.floor(x / BALANCE.experiment.pile.colWidth), 0, this.pileCols.length - 1);
  }

  /** 쌓이는 바닥: 칸의 더미 윗면 y */
  pileTopY(col: number): number {
    return this.field.defenseLineY - this.pileCols[col].length * BALANCE.experiment.pile.blockH;
  }

  /** 쌓이는 바닥: 적이 칸에 내려앉아 블록이 된다. 한계까지 차면 패배 */
  private landOnPile(e: Enemy, col: number): void {
    const P = BALANCE.experiment.pile;
    const stack = this.pileCols[col];
    e.pileCol = col;
    e.pileY = this.field.defenseLineY - (stack.length + 0.5) * P.blockH;
    e.x = (col + 0.5) * P.colWidth;
    e.y = Math.min(e.y, e.pileY);
    e.pack = null;
    e.speed = 0;
    stack.push(e);
    this.pileLanded++;
    if (stack.length > this.pileMaxRows) this.pileMaxRows = stack.length;
    this.emit({ type: 'land', x: e.x, y: e.pileY, rows: stack.length });
    if (stack.length >= P.maxRows) this.end('defeat');
  }

  /** 쌓이는 바닥: 블록이 죽으면 칸에서 빼고, 위 블록들이 떨어질 자리를 다시 정한다 */
  private removeFromPile(e: Enemy): void {
    const stack = this.pileCols[e.pileCol];
    const i = stack.indexOf(e);
    if (i < 0) return;
    stack.splice(i, 1);
    const h = BALANCE.experiment.pile.blockH;
    for (let k = i; k < stack.length; k++) stack[k].pileY = this.field.defenseLineY - (k + 0.5) * h;
    e.pileCol = -1;
    this.pileCleared++;
  }

  /**
   * 적끼리 가운데 작은 충돌 (도파민 모드, BALANCE.chaos.sepCore · sepPush): 끌어모아도 한 점으로 겹치지 않게.
   * 칸 해시로 가까운 짝만 보고, 겹친 만큼의 sepPush 씩 반반 떼어 놓는다 (한쪽이 안 밀리는 적이면 다른 쪽이 다).
   */
  private sepCells = new Map<number, Enemy[]>();
  private separateEnemies(): void {
    const C = BALANCE.chaos;
    const core = C.sepCore;
    if (core <= 0) return;
    const cell = 24;
    const cells = this.sepCells;
    for (const l of cells.values()) l.length = 0;
    const key = (cx: number, cy: number) => (cx + 64) * 4096 + (cy + 64);
    for (const e of this.enemies) {
      if (e.dead || e.pileCol >= 0) continue;
      const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell));
      let l = cells.get(k);
      if (!l) cells.set(k, (l = []));
      l.push(e);
    }
    const fixed = (e: Enemy) => e.def.boss || e.pack !== null;
    const W = this.field.width;
    for (const a of this.enemies) {
      if (a.dead || a.pileCol >= 0) continue;
      const cx = Math.floor(a.x / cell);
      const cy = Math.floor(a.y / cell);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const l = cells.get(key(cx + ox, cy + oy));
          if (!l) continue;
          for (const b of l) {
            if (b.id <= a.id || b.dead) continue;
            const minD = (a.radius + b.radius) * core;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= minD * minD) continue;
            const fa = fixed(a);
            const fb = fixed(b);
            if (fa && fb) continue;
            let d = Math.sqrt(d2);
            if (d < 1e-3) {
              // 딱 겹치면 id 로 정한 방향 (결정적)
              const g = ((a.id * 7 + b.id * 13) % 360) * (Math.PI / 180);
              dx = Math.cos(g);
              dy = Math.sin(g);
              d = 1;
            } else {
              dx /= d;
              dy /= d;
            }
            const push = (minD - Math.min(d, minD)) * C.sepPush;
            const wa = fa ? 0 : fb ? 1 : 0.5;
            const wb = fb ? 0 : fa ? 1 : 0.5;
            a.x = clamp(a.x - dx * push * wa, a.radius, W - a.radius);
            a.y -= dy * push * wa;
            b.x = clamp(b.x + dx * push * wb, b.radius, W - b.radius);
            b.y += dy * push * wb;
          }
        }
    }
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) if (!e.dead) this.grid.insert(e);
  }

  private updateExplosions(dt: number): void {
    // 이번 스텝에 터질 것만 꺼낸다. 터지면서 새로 생긴 폭발은 다음 스텝 이후에 처리 → 한 스텝 처리량이 유한
    const list = this.explosions;
    const ready = this.readyBuf;
    ready.length = 0;
    let write = 0;
    for (let i = 0; i < list.length; i++) {
      const ex = list[i];
      ex.delay -= dt;
      if (ex.delay <= 0) ready.push(ex);
      else list[write++] = ex;
    }
    list.length = write;
    for (const ex of ready) this.detonate(ex);
  }

  private detonate(ex: Explosion): void {
    const chain = this.chains.get(ex.chainId);
    if (chain && ex.source === 'chain') chain.links++;
    this.emit({
      type: 'explosion', x: ex.x, y: ex.y, radius: ex.radius, source: ex.source,
      chainId: ex.chainId, chainKills: chain?.kills ?? 0, crit: ex.crit,
    });
    if (ex.tag?.row) this.emit({ type: 'rowBlast', y: ex.y, half: ex.radius });
    const hits = ex.tag?.row ? this.exp.collectRow(ex, this.hitBuf) : this.collectEnemiesNear(ex.x, ex.y, ex.radius, this.hitBuf);
    const edge = ex.edgeMul;
    for (const e of hits) {
      let dmg = ex.damage;
      if (edge < 1) {
        // 가장자리 감쇠: 적 중심까지 거리 / (반경 + 적 반지름)
        const t = clamp(Math.sqrt(dist2(ex.x, ex.y, e.x, e.y)) / (ex.radius + e.radius), 0, 1);
        dmg *= 1 - (1 - edge) * t;
      }
      this.hitEnemy(e, dmg, ex.source, ex.chainId, ex.crit, ex.depth, ex);
    }
    this.exp.onDetonate(ex);
    this.augments.onExplosion(this, ex);
    if (chain) chain.refs--;
  }

  private updateZones(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      z.ttl -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick += ZONE_TICK_SEC;
        const hits = this.collectEnemiesNear(z.x, z.y, z.radius, this.hitBuf);
        for (const e of hits) this.hitEnemy(e, z.dps * ZONE_TICK_SEC, z.source, z.chainId, false, z.depth);
      }
      if (z.ttl > 0) this.zones[write++] = z;
      else {
        const c = this.chains.get(z.chainId);
        if (c) c.refs--;
      }
    }
    this.zones.length = write;
  }

  private updateMines(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
      m.armIn -= dt;
      m.ttl -= dt;
      let keep = m.ttl > 0;
      if (keep && m.armIn <= 0) {
        // 지뢰 심기 규칙의 지뢰(depth 있음)는 탭 폭발처럼 터진다
        const own = m.depth !== undefined;
        const near = this.collectEnemiesNear(m.x, m.y, own ? BALANCE.experiment.mines.trigger : MINE_TRIGGER_RADIUS, this.hitBuf);
        if (near.length > 0) {
          this.spawnExplosion({
            x: m.x, y: m.y, radius: m.radius, damage: m.damage, chainId: this.newChain(m.depth), source: own ? 'tap' : 'mine',
            edgeMul: own ? this.stats.tapEdgeMul : 1,
          });
          if (own) this.emit({ type: 'mineBlast', x: m.x, y: m.y, radius: m.radius });
          keep = false;
        }
      }
      if (keep) this.mines[write++] = m;
    }
    this.mines.length = write;
  }

  private compactEnemies(): void {
    for (const p of this.packs) p.members = 0;
    let write = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      this.enemies[write++] = e;
      if (e.pack) e.pack.members++;
    }
    this.enemies.length = write;
    let pw = 0;
    for (let i = 0; i < this.packs.length; i++) {
      const p = this.packs[i];
      if (p.members > 0) this.packs[pw++] = p;
    }
    this.packs.length = pw;
  }

  private sweepChains(): void {
    for (const [id, c] of this.chains) {
      if (c.refs > 0) continue;
      if (c.kills > 0) {
        this.chainHistogram[chainBucket(c.kills)]++;
        this.emit({ type: 'chainEnd', chainId: id, kills: c.kills, links: c.links });
      }
      this.chains.delete(id);
      this.chainSrc.delete(id);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 전투
  // ═══════════════════════════════════════════════════════════

  private hitEnemy(e: Enemy, amount: number, source: DamageSource, chainId: number, crit: boolean, depth: number, ex?: Explosion): void {
    if (e.dead) return;
    e.lastHitAt = this.time;
    const chainTag = this.chains.get(chainId)?.tag;
    // 실험 규칙 피해 배율 (색·얼음). 얼리는 탭이면 피해 없이 끝
    const expDmg = this.exp.modifyDamage(e, amount, ex?.tag, chainTag);
    if (expDmg < 0) return;
    amount = expDmg;
    if (e.shield > 0 && !(source === 'pile' && e.pileCol >= 0)) {
      e.shield--;
      this.emit({ type: 'shieldBreak', x: e.x, y: e.y });
      return;
    }
    let dmg = amount;
    if (!isDirect(source) && e.def.indirectDamageTakenMul !== undefined) dmg *= e.def.indirectDamageTakenMul;
    // 쌓이는 바닥: 무너지는 블록의 폭발은 옆 블록을 바로 무너뜨린다
    if (source === 'pile' && e.pileCol >= 0) dmg = Math.max(dmg, e.hp);
    // 도파민 모드: 매혹된 적(우리 편)은 맞지 않는다. 떼가 붙은 적·변이된 적은 모든 피해를 더 받는다
    if (e.charm > 0) return;
    if (e.infest > 0) dmg *= BALANCE.chaos.infestDamageMul;
    if (e.poly > 0) dmg *= BALANCE.chaos.polyDamageMul;
    const hpBefore = e.hp;
    e.hp -= dmg;
    // 어느 무기의 피해인가 (도파민 모드): 숫자 색 · 판 끝 무기별 피해
    const src = this.chainSrc.get(chainId);
    if (src && this.chaos) this.chaos.noteDamage(src, Math.min(dmg, Math.max(0, hpBefore)));
    this.emit({ type: 'hit', x: e.x, y: e.y, amount: dmg, crit, src });
    e.def.boss?.onDamaged?.(this, e);
    // 체력을 넘긴 만큼이 넘친 피해 → 연쇄로 이월
    if (e.hp <= 0) this.killEnemy(e, chainId, -e.hp, depth);
    else this.exp.afterHit(e, ex, chainTag);
  }

  /** 실험 규칙의 지속 피해 (불 등). 증강 훅과 달리 바로 피해를 준다 (exp.ts 의 스텝 갱신에서만 부름) */
  hitFromExp(e: Enemy, amount: number, chainId: number, depth: number): void {
    this.hitEnemy(e, amount, 'exp', chainId, false, depth);
  }

  /** 황금 적을 연쇄로 잡음: 즉시 레벨 업 + 게이지 가득 */
  goldenReward(): void {
    this.gainXp(Math.max(0, this.xpNeeded - this.xp));
    this.gainGauge(1);
  }

  /** overflow = 이 적을 죽인 피해 중 체력을 넘긴 양, depth = 이 적을 죽인 폭발의 연쇄 단계 */
  private killEnemy(e: Enemy, chainId: number, overflow = 0, depth = 0): void {
    e.dead = true;
    e.hp = 0;
    this.kills++;
    const chain = this.chains.get(chainId) ?? this.chains.get(this.newChain())!;
    chain.kills++;
    if (chain.kills > this.maxChain) this.maxChain = chain.kills;
    this.emit({ type: 'kill', x: e.x, y: e.y, kind: e.def.id, chainKills: chain.kills, boss: !!e.def.boss });

    if (this.rules.combo) {
      this.combo.kills++;
      this.combo.timer = BALANCE.experiment.combo.windowSec;
      if (this.combo.kills > this.maxCombo) this.maxCombo = this.combo.kills;
    }
    if (this.rules.brink && e.y >= this.field.defenseLineY - BALANCE.experiment.brink.zone) {
      this.brinkKills++;
      this.gainGauge(BALANCE.experiment.brink.refundPerKill);
      this.emit({ type: 'brink', x: e.x, y: e.y });
    }

    // 연쇄 환급: 한 연쇄에서 N마리마다 게이지 + (이미 가득이면 없음)
    const every = this.stats.chainRefundKills;
    if (every > 0 && chain.kills % every === 0 && this.gauge < this.stats.gaugeMax) {
      this.gainGauge(this.stats.chainRefundGauge);
      this.refunds++;
      this.emit({ type: 'refund', x: e.x, y: e.y, chainKills: chain.kills });
    }

    // 분열: 자기 연쇄 폭발 반경 안에 떨어뜨려서 "분열체까지 연쇄에 물리기"가 되게
    const split = e.def.splitInto;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.spawnEnemy(split.kind, e.x + this.rng.range(-split.spread, split.spread), e.y + this.rng.range(-split.spread, split.spread * 0.5));
      }
    }

    // 연쇄: 처치된 적이 그 자리에서 다시 폭발. 기본은 deathBlast 가 있는 적(폭발형·보스)만,
    // "연쇄 반응" 증강이 있으면 모든 적. 단, 이 묶음의 연쇄 단계(게이지로 정함)를 넘으면 안 터진다
    // (플레이 피드백: 연쇄로 죽은 적이 또 터져서 끝없이 이어지면 너무 세다).
    //   피해 = 넘친 피해 × carry + 자기 폭약 × 연쇄 배율(1 + 처치당 증가 × 지금까지 처치 수)
    // 넘친 피해는 단계마다 체력만큼 깎이므로 연쇄는 저절로 약해지다 끊긴다.
    // 연쇄 배율을 넘친 피해에 곱하면 단계마다 복리로 불어나서 끊기지 않으므로, 폭발형의 자기 폭약에만 곱한다.
    const s = this.stats;
    // 쌓이는 바닥: 블록은 늘 터지고, 블록끼리는 연쇄 단계 × stepsPerDepth 칸까지 줄줄이 무너진다
    const pileBlock = e.pileCol >= 0;
    if (pileBlock) this.removeFromPile(e);
    const PB = BALANCE.experiment.pile;
    const pileBlast = pileBlock ? { radiusMul: PB.blastRadius / s.chainRadius, charge: PB.blastCharge } : undefined;
    // 불씨 칠하기: 불씨 붙은 적은 폭발형처럼 터진다
    // 도파민 모드: 적이 죽을 때 저절로 터지지 않는다 (폭발형·보스·폭약 전부). 플레이 피드백: 무기가 많아지니
    // 거의 모든 적이 죽으면서 터져서 왜 터지는지 알 수 없었다. "연쇄 반응" 증강을 고르면 그때만 터진다.
    const ownBlast = this.chaos ? undefined : e.def.deathBlast ?? (e.spark ? BALANCE.experiment.paint.blast : undefined);
    const blast = pileBlast ?? this.exp.deathBlast(e) ?? ownBlast;
    const depthOk = pileBlock ? chain.maxDepth > 0 && depth + 1 <= chain.maxDepth * PB.stepsPerDepth : depth + 1 <= chain.maxDepth;
    let exploded = false;
    if ((blast || s.chainOnAllKills) && depthOk) {
      const mult = 1 + s.chainMultiplierPerKill * chain.kills;
      const damage = overflow * s.chainCarry + (blast?.charge ?? 0) * s.tapDamage * mult * this.comboMult();
      if (damage >= BALANCE.chain.minDamage) {
        this.spawnExplosion({
          x: e.x,
          y: e.y,
          radius: s.chainRadius * (blast?.radiusMul ?? 1),
          damage,
          chainId: chain.id,
          source: pileBlock ? 'pile' : 'chain',
          delay: s.chainDelaySec,
          depth: depth + 1,
        });
        exploded = true;
        if (e.spark && !e.def.deathBlast) this.sparkBlasts++;
      }
    }

    // 짝 폭발형: 이 폭발형이 터졌으면 짝도 그 자리에서 같은 단계로 죽어 터진다
    const mate = e.partner;
    if (mate) {
      e.partner = null;
      mate.partner = null;
      if (exploded && !mate.dead) {
        this.pairBlasts++;
        this.emit({ type: 'pairBlast', x1: e.x, y1: e.y, x2: mate.x, y2: mate.y, color: e.pairColor });
        this.killEnemy(mate, chain.id, 0, depth);
      }
    }

    this.exp.onKill(e, depth, exploded);
    this.chaos?.onKill(e);
    this.gainXp(e.def.xp);

    if (e.def.boss) {
      this.emit({ type: 'bossKill', x: e.x, y: e.y, final: e.isFinalBoss });
      if (e.isFinalBoss) this.victoryPending = true;
      else {
        this.multiplyRunMult(BALANCE.mult.bossKill);
        this.queueOffer('boss');
      }
    }

    this.augments.onKill(this, { enemy: e, chainId: chain.id, chainKills: chain.kills, depth });
  }

  private gainXp(amount: number): void {
    this.xp += amount * (this.chaos?.xpMul() ?? 1);
    let need = xpToNext(this.level);
    while (this.xp >= need) {
      this.xp -= need;
      this.level++;
      this.emit({ type: 'levelUp', level: this.level });
      this.queueOffer('level');
      need = xpToNext(this.level);
    }
  }

  private collectEnemiesNear(x: number, y: number, r: number, out: Enemy[]): Enemy[] {
    out.length = 0;
    const box = this.boxBuf;
    box.length = 0;
    this.grid.queryBox(x, y, r + MAX_ENEMY_RADIUS, box);
    for (const e of box) {
      if (e.dead) continue;
      const rr = r + e.radius;
      if (dist2(x, y, e.x, e.y) <= rr * rr) out.push(e);
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════
  // SimApi (증강·보스 훅이 쓰는 창구)
  // ═══════════════════════════════════════════════════════════

  enemiesNear(x: number, y: number, r: number): Enemy[] {
    return this.collectEnemiesNear(x, y, r, []);
  }

  aliveEnemies(): Enemy[] {
    return this.enemies.filter((e) => !e.dead && e.y > 0);
  }

  spawnExplosion(spec: ExplosionSpec): void {
    if (this.explosions.length >= BALANCE.limits.maxExplosions) return;
    const chain = this.chains.get(spec.chainId);
    if (chain) chain.refs++;
    this.explosions.push({
      id: this.nextId++,
      x: spec.x,
      y: spec.y,
      radius: spec.radius,
      damage: spec.damage,
      chainId: spec.chainId,
      source: spec.source,
      delay: spec.delay ?? 0,
      crit: spec.crit ?? false,
      edgeMul: spec.edgeMul ?? 1,
      depth: spec.depth ?? 0,
      tag: spec.tag,
    });
  }

  spawnEnemy(kind: EnemyKind | BossId | string, x: number, y: number, hpMul = 1): Enemy | null {
    if (this.enemies.length >= BALANCE.limits.maxEnemies) return null;
    const def = getEnemyDef(kind);
    const pileMul = this.rules.pile ? BALANCE.experiment.pile.enemyHpMul : 1;
    const C = BALANCE.chaos;
    const chaosMul = this.rules.chaos
      ? C.enemyHpMul + C.enemyHpPerWave * (this.wave - 1) + (this.chaos?.fusion.active ? C.enemyHpLatePerWave * Math.max(0, this.wave - C.enemyHpLateFrom) + C.enemyHpPerFusion * this.chaos.parent.size : 0)
      : 1;
    const hp = enemyHp(this.wave) * this.chapter.hpMul * def.hpMul * hpMul * pileMul * chaosMul;
    const e: Enemy = {
      id: this.nextId++,
      def,
      x: clamp(x, def.radius, this.field.width - def.radius),
      y,
      hp,
      maxHp: hp,
      shield: def.shields ?? 0,
      radius: def.radius,
      speed: def.speed * (def.boss ? 1 : BALANCE.enemy.speedMul),
      dead: false,
      phase: 0,
      lastHitAt: -1,
      isFinalBoss: false,
      pileCol: -1,
      pileY: 0,
      pack: null,
      packOx: 0,
      packOy: 0,
      spark: false,
      partner: null,
      pairColor: -1,
      dx: 0,
      dy: 1,
      kx: 0,
      ky: 0,
      frozen: 0,
      held: 0,
      infest: 0,
      poly: 0,
      charm: 0,
      cc: 0,
      ccImmune: 0,
      lift: 0,
      burn: 0,
      color: -1,
      inflate: 0,
      bornAt: 0,
      golden: false,
    };
    this.enemies.push(e);
    this.grid.insert(e);
    this.exp.onSpawn(e);
    return e;
  }

  /** 새 연쇄 묶음. maxDepth 를 안 주면 탭이 아닌 시작(지뢰·번개)의 기본 단계 */
  /** 연쇄 id → 그것을 낸 무기 (도파민 모드: 피해 숫자 색 · 무기별 피해). 연쇄가 끝나면 지운다 */
  private chainSrc = new Map<number, string>();

  newChain(maxDepth?: number): number {
    const id = this.nextId++;
    const src = this.chaos?.curSrc;
    if (src) this.chainSrc.set(id, src);
    const depth = maxDepth ?? BALANCE.chain.otherStartDepth + this.stats.chainDepthBonus;
    this.chains.set(id, { id, kills: 0, refs: 0, links: 0, maxDepth: depth });
    return id;
  }

  addZone(spec: ZoneSpec): void {
    if (this.zones.length >= BALANCE.limits.maxZones) return;
    const chain = this.chains.get(spec.chainId);
    if (chain) chain.refs++;
    this.zones.push({ id: this.nextId++, ...spec, depth: spec.depth ?? 0, maxTtl: spec.ttl, tick: ZONE_TICK_SEC });
  }

  addMine(spec: MineSpec): void {
    if (this.mines.length >= BALANCE.limits.maxMines) return;
    this.mines.push({ id: this.nextId++, ...spec, armIn: MINE_ARM_SEC });
  }

  heal(amount: number): void {
    this.life = Math.min(this.stats.maxLife, this.life + amount);
  }

  /**
   * 환급·증강으로 얻는 게이지. 과충전 규칙에서는 100% 까지만 (환급 때문에 폭주하면 억울하므로).
   * 이미 그보다 많으면 줄이지 않는다.
   */
  gainGauge(amount: number): void {
    const cap = this.overloadable ? Math.min(1, this.stats.gaugeMax) : this.stats.gaugeMax;
    if (this.gauge >= cap) return;
    const before = this.gauge;
    this.gauge = Math.min(cap, this.gauge + amount);
    if (before < 1 && this.gauge >= 1) this.emit({ type: 'gaugeFull' });
  }

  multiplyRunMult(factor: number): void {
    const next = Math.min(BALANCE.mult.runMax, this.runMult * factor);
    if (next === this.runMult) return;
    this.runMult = next;
    this.recomputeStats();
  }

  addBonusParts(amount: number): void {
    this.bonusParts += amount;
  }

  emit(ev: SimEvent): void {
    if (this.recordEvents) this.events.push(ev);
  }

  // ═══════════════════════════════════════════════════════════
  // 조회 (HUD·봇·결과)
  // ═══════════════════════════════════════════════════════════

  /** 진행 중인 묶음 중 처치가 가장 많은 것 (links = 연쇄 폭발 수) */
  currentChain(): { kills: number; links: number } {
    let best = { kills: 0, links: 0 };
    for (const c of this.chains.values()) if (c.refs > 0 && c.kills > best.kills) best = c;
    return { kills: best.kills, links: best.links };
  }

  /** 지금 화면에 있는 보스 (HP 바용) */
  activeBoss(): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) if (!e.dead && e.def.boss && (!best || e.isFinalBoss)) best = e;
    return best;
  }

  get xpNeeded(): number {
    return xpToNext(this.level);
  }

  /** 증강 선택지 표시용 */
  offerCards(): { id: string; stacks: number }[] {
    return (this.offer?.choices ?? []).map((id) => ({ id, stacks: this.augments.stacks(id) }));
  }

  summary(): RunSummary {
    return {
      seed: this.config.seed,
      mode: this.config.mode,
      daily: this.config.daily ?? false,
      chapterId: this.chapter.id,
      result: this.result ?? 'quit',
      wave: this.wave,
      kills: this.kills,
      maxChain: this.maxChain,
      taps: this.taps,
      refunds: this.refunds,
      damageMult: this.stats.damageMult,
      rules: RULE_IDS.filter((r) => this.rules[r]),
      overloads: this.overloads,
      maxCombo: this.maxCombo,
      brinkKills: this.brinkKills,
      sparkBlasts: this.sparkBlasts,
      pairBlasts: this.pairBlasts,
      pileLanded: this.pileLanded,
      pileCleared: this.pileCleared,
      pileMaxRows: this.pileMaxRows,
      level: this.level,
      durationSec: this.time,
      picks: [...this.augments.history],
      fusions: this.chaos && this.chaos.fusion.mode === 4 ? [...this.chaos.parent].map(([b, a]) => `${a}>${b}`) : undefined,
      fusionLab: this.config.fusionLab || undefined,
      weaponDamage: this.chaos ? this.chaos.damageTable() : undefined,
      reacts: this.chaos && this.chaos.parent.size > 0 ? [...new Set([...this.chaos.parent.keys()].map((b) => reactName(b)))] : undefined,
      partsEarned: runReward(this.wave, this.kills) + this.bonusParts,
      chainHistogram: [...this.chainHistogram],
    };
  }

  /** 결정론 확인용 상태 지문 */
  fingerprint(): string {
    let h = 0;
    const mix = (v: number) => {
      h = (Math.imul(h ^ Math.round(v * 1000), 0x01000193) + 0x9e3779b9) | 0;
    };
    mix(this.time);
    mix(this.kills);
    mix(this.life);
    mix(this.gauge);
    mix(this.wave);
    for (const e of this.enemies) {
      mix(e.x);
      mix(e.y);
      mix(e.hp);
    }
    return `${(h >>> 0).toString(16)}:${this.enemies.length}:${this.kills}`;
  }
}

