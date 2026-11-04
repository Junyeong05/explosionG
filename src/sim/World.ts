import { BALANCE, enemyHp, packInterval, packSize, runReward, xpToNext } from '../data/balance';
import type { BossId } from '../data/bosses';
import { getChapter, type ChapterDef } from '../data/chapters';
import type { EnemyDef, EnemyKind } from '../data/enemies';
import { getEnemyDef } from '../data/lookup';
import { clamp, dist2 } from '../core/math';
import { Rng, deriveSeed } from '../core/rng';
import { SpatialGrid } from '../core/spatial';
import { AugmentManager } from './augments';
import type { ExplosionSpec, MineSpec, SimApi, ZoneSpec } from './api';
import type { SimEvent } from './events';
import { computeStats, type PlayerStats } from './stats';
import {
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
const PACK_PLACE_TRIES = 6;

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
    this.augments = new AugmentManager(new Rng(deriveSeed(config.seed, 'augment')));
    this.recordEvents = config.recordEvents ?? true;
    this.stats = computeStats(config.meta, []);
    this.life = this.stats.maxLife;
    this.gauge = this.stats.gaugeMax;
    this.rerollsLeft = config.meta.rerolls;
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
    this.updateGauge(dt);
    if (!this.config.sandbox) this.updateWaves(dt);
    this.moveEnemies(dt);
    this.rebuildGrid();
    this.updateExplosions(dt);
    this.updateZones(dt);
    this.updateMines(dt);
    this.augments.onTick(this, dt);
    this.compactEnemies();
    this.sweepChains();

    if (this.life <= 0) this.end('defeat');
    else if (this.victoryPending) this.end('victory');
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
      case 'release':
        // 지금 조작은 누르는 순간 터지는 탭 하나뿐. 누르고 떼기 조작이 생기면 여기서 받는다
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
    const s = this.stats;
    const free = s.freeTapDuringChain && this.explosions.length > 0;
    const power = free ? Math.max(this.gauge, BALANCE.prism.infiniteChain.freeTapPower) : this.gauge;

    if (power < BALANCE.tap.gauge.minFire) {
      this.emit({ type: 'dryTap', x, y });
      return;
    }
    if (!free) this.gauge = Math.min(power, s.gaugeLeftover);

    const crit = this.rng.chance(s.critChance);
    let damage = this.tapDamageAt(power);
    if (crit) damage *= s.critMultiplier;
    this.taps++;
    this.emit({ type: 'tap', x, y, free, power });
    this.spawnExplosion({ x, y, radius: this.tapRadiusAt(power), damage, chainId: this.newChain(), source: 'tap', crit });
  }

  /** 게이지 power(1 = 100%)로 쏘면 반경이 얼마인가 (렌더러 미리보기·봇도 씀) */
  tapRadiusAt(power: number): number {
    const G = BALANCE.tap.gauge;
    return this.stats.tapRadius * (G.radiusAt0 + (G.radiusAt1 - G.radiusAt0) * power);
  }

  tapDamageAt(power: number): number {
    const G = BALANCE.tap.gauge;
    return this.stats.tapDamage * (G.damageAt0 + (G.damageAt1 - G.damageAt0) * power);
  }

  // ═══════════════════════════════════════════════════════════
  // 증강 선택
  // ═══════════════════════════════════════════════════════════

  private openNextOffer(): void {
    while (this.offerQueue.length > 0) {
      const kind = this.offerQueue.shift()!;
      const choices = this.augments.roll(kind);
      if (choices.length === 0) continue;
      this.offer = { kind, choices };
      this.phase = 'choosing';
      this.offerWait = 0;
      this.emit({ type: 'offer', kind });
      return;
    }
    this.offerWait = 0;
  }

  private choose(index: number): void {
    const id = this.offer?.choices[index];
    if (!id) return;
    const def = this.augments.acquire(id, this);
    this.recomputeStats();
    this.offer = null;
    this.phase = 'playing';
    this.emit({ type: 'augment', id, rarity: def.rarity });
  }

  private reroll(): void {
    if (!this.offer || this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.offer = { kind: this.offer.kind, choices: this.augments.roll(this.offer.kind) };
  }

  private recomputeStats(): void {
    this.stats = computeStats(this.config.meta, this.augments.active());
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

  /** 게이지는 100% 까지 fillSec 동안 차고, 100% 를 넘는 구간(초신성)은 overfillRate 배 속도로 찬다 */
  private updateGauge(dt: number): void {
    const s = this.stats;
    if (this.gauge >= s.gaugeMax) return;
    const rate = (this.gauge < 1 ? 1 : BALANCE.prism.supernova.overfillRate) / s.gaugeFillSec;
    this.gainGauge(rate * dt);
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
    const interval = packInterval(this.wave);
    while (this.spawnTimer >= interval) {
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
    const pool = this.chapter.roster.filter((r) => r.fromWave <= this.wave);
    const size = Math.max(1, packSize(this.wave) + rng.int(3) - 1);
    const spread = W.packSpread;
    const cx = rng.range(spread + 12, this.field.width - spread - 12);
    // 무리 전체가 화면 위 바깥에서 시작하도록 아래 끝을 spawnY 에 맞춘다
    const cy = this.field.spawnY - spread;
    const pack: Pack = { id: this.nextId++, x: cx, y: cy, speed: Number.POSITIVE_INFINITY, members: 0 };

    const placed: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < size; i++) {
      const entry = rng.weighted(pool, (r) => r.weight ?? getEnemyDef(r.kind).spawnWeight);
      if (!entry) break;
      const def = getEnemyDef(entry.kind);
      const p = this.packSpot(cx, cy, spread, def, placed);
      placed.push(p);
      const e = this.spawnEnemy(def.id, p.x, p.y);
      if (!e || def.loner) continue;
      // 무리는 가장 느린 구성원 속도로 같이 내려온다
      e.pack = pack;
      e.packOx = e.x - cx;
      e.packOy = e.y - cy;
      pack.speed = Math.min(pack.speed, e.speed);
      pack.members++;
    }
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
    const line = this.field.defenseLineY;
    for (const p of this.packs) p.y += p.speed * dt;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const p = e.pack;
      if (p) {
        e.x = p.x + e.packOx;
        e.y = p.y + e.packOy;
      } else {
        e.y += e.speed * dt;
      }
      if (e.y >= line) {
        e.dead = true;
        // 최종 보스가 방어선을 넘으면 즉시 패배
        const damage = e.isFinalBoss ? this.life : e.def.leak;
        this.life -= damage;
        this.emit({ type: 'leak', x: e.x, damage });
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
    this.emit({
      type: 'explosion', x: ex.x, y: ex.y, radius: ex.radius, source: ex.source,
      chainId: ex.chainId, chainKills: chain?.kills ?? 0, crit: ex.crit,
    });
    const hits = this.collectEnemiesNear(ex.x, ex.y, ex.radius, this.hitBuf);
    for (const e of hits) this.hitEnemy(e, ex.damage, ex.source, ex.chainId, ex.crit);
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
        for (const e of hits) this.hitEnemy(e, z.dps * ZONE_TICK_SEC, z.source, z.chainId, false);
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
        const near = this.collectEnemiesNear(m.x, m.y, MINE_TRIGGER_RADIUS, this.hitBuf);
        if (near.length > 0) {
          this.spawnExplosion({ x: m.x, y: m.y, radius: m.radius, damage: m.damage, chainId: this.newChain(), source: 'mine' });
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
        this.emit({ type: 'chainEnd', chainId: id, kills: c.kills });
      }
      this.chains.delete(id);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 전투
  // ═══════════════════════════════════════════════════════════

  private hitEnemy(e: Enemy, amount: number, source: DamageSource, chainId: number, crit: boolean): void {
    if (e.dead) return;
    e.lastHitAt = this.time;
    if (e.shield > 0) {
      e.shield--;
      this.emit({ type: 'shieldBreak', x: e.x, y: e.y });
      return;
    }
    let dmg = amount;
    if (!isDirect(source) && e.def.indirectDamageTakenMul !== undefined) dmg *= e.def.indirectDamageTakenMul;
    e.hp -= dmg;
    this.emit({ type: 'hit', x: e.x, y: e.y, amount: dmg, crit });
    e.def.boss?.onDamaged?.(this, e);
    if (e.hp <= 0) this.killEnemy(e, chainId);
  }

  private killEnemy(e: Enemy, chainId: number): void {
    e.dead = true;
    e.hp = 0;
    this.kills++;
    const chain = this.chains.get(chainId) ?? this.chains.get(this.newChain())!;
    chain.kills++;
    if (chain.kills > this.maxChain) this.maxChain = chain.kills;
    this.emit({ type: 'kill', x: e.x, y: e.y, kind: e.def.id, chainKills: chain.kills, boss: !!e.def.boss });

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
    // "연쇄 반응" 증강이 있으면 모든 적. 연쇄 배율 = 1 + 처치당 증가 × 지금까지 처치 수
    const s = this.stats;
    const blast = e.def.deathBlast;
    if (blast || s.chainOnAllKills) {
      const mult = 1 + s.chainMultiplierPerKill * chain.kills;
      this.spawnExplosion({
        x: e.x,
        y: e.y,
        radius: s.chainRadius * (blast?.radiusMul ?? 1),
        damage: s.tapDamage * s.chainDamageRatio * (blast?.damageMul ?? 1) * mult,
        chainId: chain.id,
        source: 'chain',
        delay: s.chainDelaySec,
      });
    }

    this.gainXp(e.def.xp);

    if (e.def.boss) {
      this.emit({ type: 'bossKill', x: e.x, y: e.y, final: e.isFinalBoss });
      if (e.isFinalBoss) this.victoryPending = true;
      else this.queueOffer('boss');
    }

    this.augments.onKill(this, { enemy: e, chainId: chain.id, chainKills: chain.kills });
  }

  private gainXp(amount: number): void {
    this.xp += amount;
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
    });
  }

  spawnEnemy(kind: EnemyKind | BossId | string, x: number, y: number, hpMul = 1): Enemy | null {
    if (this.enemies.length >= BALANCE.limits.maxEnemies) return null;
    const def = getEnemyDef(kind);
    const hp = enemyHp(this.wave) * this.chapter.hpMul * def.hpMul * hpMul;
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
      pack: null,
      packOx: 0,
      packOy: 0,
    };
    this.enemies.push(e);
    this.grid.insert(e);
    return e;
  }

  newChain(): number {
    const id = this.nextId++;
    this.chains.set(id, { id, kills: 0, refs: 0 });
    return id;
  }

  addZone(spec: ZoneSpec): void {
    if (this.zones.length >= BALANCE.limits.maxZones) return;
    const chain = this.chains.get(spec.chainId);
    if (chain) chain.refs++;
    this.zones.push({ id: this.nextId++, ...spec, maxTtl: spec.ttl, tick: ZONE_TICK_SEC });
  }

  addMine(spec: MineSpec): void {
    if (this.mines.length >= BALANCE.limits.maxMines) return;
    this.mines.push({ id: this.nextId++, ...spec, armIn: MINE_ARM_SEC });
  }

  heal(amount: number): void {
    this.life = Math.min(this.stats.maxLife, this.life + amount);
  }

  gainGauge(amount: number): void {
    const max = this.stats.gaugeMax;
    if (this.gauge >= max) return;
    this.gauge = Math.min(max, this.gauge + amount);
    if (this.gauge >= max) this.emit({ type: 'gaugeFull' });
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

  /** 진행 중인 연쇄 중 가장 긴 것의 처치 수 */
  currentChain(): number {
    let best = 0;
    for (const c of this.chains.values()) if (c.refs > 0 && c.kills > best) best = c.kills;
    return best;
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
      level: this.level,
      durationSec: this.time,
      picks: [...this.augments.history],
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

