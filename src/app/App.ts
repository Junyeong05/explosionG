import { Haptics } from '../feedback/Haptics';
import { Sfx } from '../feedback/Sfx';
import { SlowMo } from '../feedback/SlowMo';
import { PointerInput } from '../input/PointerInput';
import { CHAPTERS } from '../data/chapters';
import { applyRunResult, buyUpgrade, createDailyRunConfig, createRunConfig, isChapterUnlocked, latestUnlockedChapter } from '../meta/progression';
import { GAME_SPEEDS, SaveManager } from '../meta/save';
import { LocalStore } from '../meta/storage';
import { Renderer } from '../render/Renderer';
import type { Offer, RunConfig } from '../sim/types';
import { World } from '../sim/World';
import { Overlay, h } from '../ui/dom';
import { augmentPicker, pauseScreen, resultScreen, titleScreen, upgradeScreen } from '../ui/screens';
import { GameLoop } from './GameLoop';

/** 판이 끝나고 결과 화면을 띄우기까지 (마지막 폭발 연출을 보여주는 시간) */
const RESULT_DELAY_SEC = 1.1;

function randomSeed(): number {
  // 앱 계층이라 Math.random 사용 OK. sim 안에서는 금지
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

/**
 * 화면 흐름과 루프를 묶는 최상위 객체.
 *   타이틀 → (영구 강화) → 판 [증강 선택 · 일시정지] → 결과 → 다시/타이틀
 */
export class App {
  private readonly saves = new SaveManager(new LocalStore());
  private readonly renderer: Renderer;
  private readonly input: PointerInput;
  private readonly overlay: Overlay;
  private readonly hud: HTMLElement;
  private readonly speedBtn: HTMLButtonElement;
  private readonly sfx = new Sfx();
  private readonly haptics = new Haptics();
  private readonly slowmo = new SlowMo();
  private readonly loop: GameLoop;

  private world: World | null = null;
  private makeConfig: (() => RunConfig) | null = null;
  private paused = false;
  private shownOffer: Offer | null = null;
  private resultIn = -1;
  /** 타이틀에서 고른 챕터 */
  private chapterId: string;

  constructor(root: HTMLElement) {
    const canvas = root.querySelector<HTMLCanvasElement>('#game');
    const ui = root.querySelector<HTMLElement>('#ui');
    if (!canvas || !ui) throw new Error('#game, #ui 가 필요합니다');

    this.renderer = new Renderer(canvas);
    this.input = new PointerInput(canvas, (x, y) => this.renderer.toLogical(x, y));
    this.overlay = new Overlay(ui);
    this.speedBtn = h('button', { class: 'speed', ariaLabel: '게임 배속', onClick: () => this.cycleSpeed() });
    this.hud = h('div', { class: 'hud' },
      h('button', { class: 'pause', ariaLabel: '일시정지', text: 'II', onClick: () => this.pause() }),
      this.speedBtn,
    );
    this.showSpeed();
    this.hud.hidden = true;
    ui.append(this.hud);

    this.chapterId = latestUnlockedChapter(this.saves.data);
    this.slowmo.onTrigger = (kills) => this.renderer.edgeFlash(kills);
    this.applySettings();

    // iOS: 오디오는 사용자 제스처 안에서 열어야 한다
    window.addEventListener('pointerdown', () => this.sfx.unlock(), { passive: true });
    window.addEventListener('resize', () => this.layout());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (realDt) => this.frame(realDt),
    );
    this.layout();
  }

  start(): void {
    this.loop.start();
    this.showTitle();
  }

  // ─── 루프 ──────────────────────────────────────────────────

  private update(dt: number): void {
    const w = this.world;
    if (!w) {
      this.input.clear();
      return;
    }
    w.step(dt, this.input.drain());
    const events = w.drainEvents();
    if (events.length > 0) {
      this.renderer.consume(events);
      this.sfx.consume(events);
      this.haptics.consume(events);
      this.slowmo.consume(events);
    }
    if (w.phase === 'choosing' && w.offer && w.offer !== this.shownOffer) this.showPicker(w, w.offer);
    if (w.phase === 'ended' && this.resultIn < 0) {
      this.resultIn = RESULT_DELAY_SEC;
      this.hud.hidden = true;
    }
  }

  private frame(realDt: number): void {
    const scale = this.slowmo.update(realDt);
    // 배속은 슬로모션 위에 곱한다. sim 은 여전히 FIXED_DT 로만 진행 → 결과는 배속과 무관
    const speed = this.saves.data.settings.speed;
    this.loop.timeScale = this.paused ? 0 : scale * speed;
    if (this.resultIn > 0) {
      this.resultIn -= realDt;
      if (this.resultIn <= 0) this.finishRun();
    }
    this.renderer.draw(this.world, this.paused ? 0 : realDt * (this.world ? scale * speed : 1));
  }

  private layout(): void {
    this.renderer.resize();
    const v = this.renderer.viewport();
    Object.assign(this.hud.style, { left: `${v.left}px`, top: `${v.top}px`, width: `${v.width}px`, height: `${v.height}px` });
  }

  // ─── 판 ────────────────────────────────────────────────────

  private startRun(makeConfig: () => RunConfig): void {
    this.makeConfig = makeConfig;
    this.world = new World(makeConfig());
    this.renderer.reset();
    this.slowmo.reset();
    this.input.clear();
    this.paused = false;
    this.shownOffer = null;
    this.resultIn = -1;
    this.overlay.clear();
    this.hud.hidden = false;
  }

  private showPicker(w: World, offer: Offer): void {
    this.shownOffer = offer;
    this.overlay.show(
      augmentPicker({
        offer,
        stacks: (id) => w.augments.stacks(id),
        rerollsLeft: w.rerollsLeft,
        onPick: (index) => {
          this.input.push({ t: 'choose', index });
          this.overlay.clear();
        },
        onReroll: () => this.input.push({ t: 'reroll' }),
      }),
    );
  }

  /** 배속 버튼: ×1 → ×1.5 → ×2 → ×1. 다음 판에도 유지 */
  private cycleSpeed(): void {
    const s = this.saves.data.settings;
    const i = GAME_SPEEDS.indexOf(s.speed);
    s.speed = GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length];
    this.saves.persist();
    this.showSpeed();
  }

  private showSpeed(): void {
    const sp = this.saves.data.settings.speed;
    this.speedBtn.textContent = `×${sp}`;
    this.speedBtn.classList.toggle('on', sp > 1);
  }

  private pause(): void {
    const w = this.world;
    if (!w || w.phase !== 'playing' || this.paused) return;
    this.paused = true;
    this.overlay.show(
      pauseScreen({
        onResume: () => {
          this.paused = false;
          this.input.clear();
          this.overlay.clear();
        },
        onQuit: () => {
          this.paused = false;
          this.overlay.clear();
          w.quit();
        },
      }),
    );
  }

  private finishRun(): void {
    const w = this.world;
    if (!w) return;
    const summary = w.summary();
    const save = this.saves.data;
    const lockedBefore = CHAPTERS.filter((c) => !isChapterUnlocked(save, c.id));
    applyRunResult(save, summary);
    this.saves.persist();
    const opened = lockedBefore.find((c) => isChapterUnlocked(save, c.id));
    if (opened) this.chapterId = opened.id;
    this.overlay.show(
      resultScreen({
        summary,
        totalParts: save.parts,
        unlocked: opened?.name,
        onRetry: () => this.makeConfig && this.startRun(this.makeConfig),
        onTitle: () => this.showTitle(),
      }),
    );
  }

  // ─── 메뉴 ──────────────────────────────────────────────────

  private showTitle(): void {
    this.world = null;
    this.hud.hidden = true;
    this.renderer.reset();
    const save = this.saves.data;
    const today = new Date().toISOString().slice(0, 10);
    this.overlay.show(
      titleScreen({
        save,
        today,
        chapterId: this.chapterId,
        onSelectChapter: (id) => {
          this.chapterId = id;
          this.showTitle();
        },
        onChapter: () => {
          const id = this.chapterId;
          this.startRun(() => createRunConfig(this.saves.data, 'chapter', randomSeed(), id));
        },
        onEndless: () => this.startRun(() => createRunConfig(this.saves.data, 'endless', randomSeed())),
        onDaily: () => this.startRun(() => createDailyRunConfig(new Date())),
        onUpgrades: () => this.showUpgrades(),
        onToggleSound: () => {
          save.settings.sound = !save.settings.sound;
          this.saves.persist();
          this.applySettings();
          this.showTitle();
        },
        onToggleHaptics: () => {
          save.settings.haptics = !save.settings.haptics;
          this.saves.persist();
          this.applySettings();
          this.showTitle();
        },
        onExport: () => this.exportHistory(),
      }),
    );
  }

  private showUpgrades(): void {
    this.overlay.show(
      upgradeScreen({
        save: this.saves.data,
        onBuy: (id) => {
          if (buyUpgrade(this.saves.data, id)) this.saves.persist();
          this.showUpgrades();
        },
        onBack: () => this.showTitle(),
      }),
    );
  }

  private applySettings(): void {
    this.sfx.enabled = this.saves.data.settings.sound;
    this.haptics.enabled = this.saves.data.settings.haptics;
  }

  /** 플레이테스트: 테스터가 판 기록 JSON 을 보내면 자동 플레이 결과와 같은 형식으로 비교할 수 있다 */
  private exportHistory(): void {
    const blob = new Blob([this.saves.exportHistory()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `explosion-g-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
