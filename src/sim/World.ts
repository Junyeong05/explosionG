import { BALANCE, enemyHp, runReward, spawnInterval, xpToNext } from '../data/balance';
import type { BossId } from '../data/bosses';
import { getChapter, type ChapterDef } from '../data/chapters';
import { REGULAR_ENEMIES, type EnemyKind } from '../data/enemies';
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
  charges: number;
  rechargeTimer = 0;
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
  rerollsLeft: number;
  bonusParts = 0;
  /** 초신성 모드에서 누르고 있는 중 */
  hold: { x: number; y: number; startedAt: number } | null = null;

  readonly enemies: Enemy[] = [];
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
    this.charges = this.stats.maxCharges;
    this.rerollsLeft = config.meta.rerolls;
    for (let i = 0; i < config.meta.headStartPicks; i++) this.offerQueue.push('start');
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
    this.updateCharges(dt);
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
    this.hold = null;
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
        if (this.hold) {
          this.hold.x = clamp(c.x, 0, this.field.width);
          this.hold.y = clamp(c.y, 0, this.field.height);
        }
        break;
      case 'release':
        if (this.phase === 'playing') this.onRelease();
        break;
      case 'choose':
        if (this.phase === 'choosing') this.choose(c.index);
        break;
      case 'reroll':
        if (this.phase === 'choosing') this.reroll();
        break;
    }
  }

  private onPress(px: number, py: number): void {
    const x = clamp(px, 0, this.field.width);
    const y = clamp(py, 0, this.field.height);
    const s = this.stats;

    if (s.inputMode === 'supernova') {
      if (this.charges >= 1 && !this.hold) this.hold = { x, y, startedAt: this.time };
      else if (this.charges < 1) this.emit({ type: 'dryTap', x, y });
      return;
    }

    const free = s.freeTapDuringChain && this.explosions.length > 0;
    if (!free) {
      if (this.charges < 1) {
        this.emit({ type: 'dryTap', x, y });
        return;
      }
      this.charges--;
    }

    const crit = this.rng.chance(s.critChance);
    let damage = s.tapDamage * (free ? BALANCE.prism.infiniteChain.freeTapDamageMul : 1);
    if (crit) damage *= s.critMultiplier;
    this.emit({ type: 'tap', x, y, free });
    this.spawnExplosion({ x, y, radius: s.tapRadius, damage, chainId: this.newChain(), source: 'tap', crit });
  }

  private onRelease(): void {
    const h = this.hold;
    if (!h) return;
    const charge = this.holdCharge();
    this.hold = null;
    if (this.charges < 1) return;

    // 남은 충전을 전부 쓴다. 오래 누를수록, 충전이 많을수록 크게
    const S = BALANCE.prism.supernova;
    const s = this.stats;
    const n = Math.floor(this.charges);
    this.charges -= n;
    const crit = this.rng.chance(s.critChance);
    const radius = s.tapRadius * (1 + S.radiusPerCharge * charge) * (1 + S.radiusPerExtraCharge * (n - 1));
    let damage = s.tapDamage * (1 + S.damagePerCharge * charge) * n;
    if (crit) damage *= s.critMultiplier;
    this.emit({ type: 'tap', x: h.x, y: h.y, free: false });
    this.spawnExplosion({ x: h.x, y: h.y, radius, damage, chainId: this.newChain(), source: 'supernova', crit });
  }

  /** 초신성 충전도 0~1 (렌더러가 링을 그릴 때 사용) */
  holdCharge(): number {
    if (!this.hold) return 0;
    return clamp((this.time - this.hold.startedAt) / BALANCE.prism.supernova.fullChargeSec, 0, 1);
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
      this.hold = null;
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
    this.charges = Math.min(this.charges, this.stats.maxCharges);
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

  private updateCharges(dt: number): void {
    const s = this.stats;
    if (this.charges >= s.maxCharges) {
      this.rechargeTimer = 0;
      return;
    }
    this.rechargeTimer += dt;
    while (this.rechargeTimer >= s.rechargeSec && this.charges < s.maxCharges) {
      this.rechargeTimer -= s.rechargeSec;
      this.charges++;
    }
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
    const interval = spawnInterval(this.wave);
    while (this.spawnTimer >= interval) {
      this.spawnTimer -= interval;
      this.spawnRegular();
    }
  }

  private spawnRegular(): void {
    const pool = REGULAR_ENEMIES.filter((d) => d.unlockWave <= this.wave);
    const mul = this.chapter.enemyWeightMul as Record<string, number> | undefined;
    const def = this.spawnRng.weighted(pool, (d) => d.spawnWeight * (mul?.[d.id] ?? 1));
    if (!def) return;
    const x = this.spawnRng.range(def.radius + 6, this.field.width - def.radius - 6);
    this.spawnEnemy(def.id, x, this.field.spawnY);
  }

  private spawnBoss(id: BossId, final: boolean): void {
    const e = this.spawnEnemy(id, this.field.width / 2, this.field.spawnY - 10, final ? this.chapter.finalBossHpMul : 1);
    if (!e) return;
    e.isFinalBoss = final;
    this.emit({ type: 'bossSpawn', id, final });
  }

  private moveEnemies(dt: number): void {
    const line = this.field.defenseLineY;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.y += e.speed * dt;
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
    let write = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.dead) this.enemies[write++] = e;
    }
    this.enemies.length = write;
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

    // 분열: 자기 연쇄 폭발 반경 안에 떨어뜨려서 "분열체까지 연쇄에 물리기"가 되게
    const split = e.def.splitInto;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.spawnEnemy(split.kind, e.x + this.rng.range(-split.spread, split.spread), e.y + this.rng.range(-split.spread, split.spread * 0.5));
      }
    }

    // 연쇄: 처치된 적이 그 자리에서 다시 폭발. 연쇄 배율 = 1 + 처치당 증가 × 지금까지 처치 수
    const s = this.stats;
    const blast = e.def.deathBlast;
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
    const hp = enemyHp(this.wave) * def.hpMul * hpMul;
    const e: Enemy = {
      id: this.nextId++,
      def,
      x: clamp(x, def.radius, this.field.width - def.radius),
      y,
      hp,
      maxHp: hp,
      shield: def.shields ?? 0,
      radius: def.radius,
      speed: def.speed,
      dead: false,
      phase: 0,
      lastHitAt: -1,
      isFinalBoss: false,
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

  gainCharge(amount: number): void {
    this.charges = Math.min(this.stats.maxCharges, this.charges + amount);
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
    mix(this.charges);
    mix(this.wave);
    for (const e of this.enemies) {
      mix(e.x);
      mix(e.y);
      mix(e.hp);
    }
    return `${(h >>> 0).toString(16)}:${this.enemies.length}:${this.kills}`;
  }
}

