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
import { augmentPicker, experimentsScreen, pauseScreen, resultScreen, titleScreen, toggleExperiment, upgradeScreen } from '../ui/screens';
import { RULE_IDS } from '../sim/types';
import { getChapter } from '../data/chapters';
import { GameLoop } from './GameLoop';
import { OFFER5, allReacts, fuseName, parseFuse, reactName } from '../data/combineV4';

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
      // 판 중에 바로 실험실로 (포기 → 타이틀 → 실험 고르기를 한 번에)
      h('button', { class: 'lab', ariaLabel: '실험실', text: '실험', onClick: () => this.openLabInRun() }),
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
        // 도파민 모드: 합성 카드가 새 합성 무기인지 몸에 더하는지, 레벨 업할 무기가 어느 합친 무기 안에 있는지, 처음 보는 반응인지
        note: (id) => this.cardNote(w, id),
        newReact: (id) => {
          const p = parseFuse(id);
          return !!p && !this.saves.data.reacts.includes(reactName(p[1]));
        },
        onPick: (index) => {
          this.input.push({ t: 'choose', index });
          this.overlay.clear();
        },
        onReroll: () => this.input.push({ t: 'reroll' }),
      }),
    );
  }

  private cardNote(w: World, id: string): string | null {
    const c = w.chaos;
    if (!c) return null;
    const p = parseFuse(id);
    if (p) return c.fusion.kids.has(p[0]) ? `몸에 더함 · 무기 ${c.bodySize(p[0]) + 1}/${OFFER5.bodyMax}` : `새 합성 무기 · 무기 2/${OFFER5.bodyMax}`;
    const root = c.parent.has(id) ? c.rootOf(id) : c.fusion.kids.has(id) ? id : null;
    if (!root) return null;
    const kid = c.fusion.kids.get(root)?.[0];
    return kid ? `합친 무기 「${fuseName(root, kid)}」 ${root === id ? '의 몸' : '안'}: 레벨이 오르면 그대로 세진다` : null;
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
        onLab: () => this.showExperiments(true),
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
    const newReacts = (summary.reacts ?? []).filter((r) => !save.reacts.includes(r));
    applyRunResult(save, summary);
    this.saves.persist();
    const opened = lockedBefore.find((c) => isChapterUnlocked(save, c.id));
    if (opened) this.chapterId = opened.id;
    this.overlay.show(
      resultScreen({
        summary,
        totalParts: save.parts,
        unlocked: opened?.name,
        reacts: summary.reacts ? { fresh: newReacts, seen: save.reacts.length, total: allReacts().length } : undefined,
        onRetry: () => this.makeConfig && this.startRun(this.makeConfig),
        onLab: () => this.showExperiments(false),
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
        onExperiments: () => this.showExperiments(false),
        onDopamine: () => {
          // 도파민 모드는 엔드리스 (끝없이 무기를 쌓아 가는 맛)
          for (const r of RULE_IDS) save.settings.rules[r] = r === 'chaos';
          this.saves.persist();
          this.startRun(() => createRunConfig(this.saves.data, 'endless', randomSeed()));
        },
        onFusionLab: () => {
          // 합성 시험판: 도파민 모드 엔드리스 + 무기 여섯 3레벨 + 레벨 업마다 합성 카드 둘
          for (const r of RULE_IDS) save.settings.rules[r] = r === 'chaos';
          this.saves.persist();
          this.startRun(() => ({ ...createRunConfig(this.saves.data, 'endless', randomSeed()), fusionLab: true }));
        },
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

  /** 판 중 실험 버튼: 멈추고 실험실을 띄운다 (돌아가면 이어서) */
  private openLabInRun(): void {
    const w = this.world;
    if (!w || w.phase === 'ended') return;
    this.paused = true;
    this.showExperiments(true);
  }

  /**
   * 실험실. inRun 이면 돌아가기 = 이어서 하기, ▶ = 지금 판을 버리고 새로 시작.
   * 켜고 끄기는 세이브(다음 판)에만 반영된다.
   */
  private showExperiments(inRun: boolean): void {
    const save = this.saves.data;
    const rules = save.settings.rules;
    const keep = this.overlayScroll();
    this.overlay.show(
      experimentsScreen({
        rules,
        inRun,
        chapterName: getChapter(this.chapterId).name,
        onToggle: (id) => {
          toggleExperiment(rules, id);
          this.saves.persist();
          this.showExperiments(inRun);
        },
        onTry: (ids) => {
          for (const r of RULE_IDS) rules[r] = ids.includes(r);
          this.saves.persist();
          const ch = this.chapterId;
          // 도파민 모드는 엔드리스, 나머지 실험은 고른 챕터
          const mode = ids.includes('chaos') ? 'endless' : 'chapter';
          this.startRun(() => createRunConfig(this.saves.data, mode, randomSeed(), ch));
        },
        onClear: () => {
          for (const r of RULE_IDS) rules[r] = false;
          this.saves.persist();
          this.showExperiments(inRun);
        },
        onBack: () => {
          if (!inRun || !this.world || this.world.phase === 'ended') {
            this.showTitle();
            return;
          }
          this.paused = false;
          this.input.clear();
          this.overlay.clear();
          // 증강 선택 중에 열었으면 선택창을 다시 띄운다
          this.shownOffer = null;
        },
      }),
    );
    this.overlayScroll(keep);
  }

  /** 다시 그려도 목록 스크롤 위치를 유지 (값을 주면 복원, 안 주면 지금 값) */
  private overlayScroll(top?: number): number {
    const el = this.overlay.element;
    if (!el) return 0;
    if (top !== undefined) el.scrollTop = top;
    return el.scrollTop;
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
    const json = this.saves.exportHistory();
    const download = () => {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `explosion-g-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    // 앱 대화창 안(다른 페이지 속)에서는 파일 받기가 막혀 있어서, 기록을 띄워 복사해 붙여 넣게 한다
    let embedded = true;
    try {
      embedded = window.top !== window;
    } catch {
      embedded = true;
    }
    if (!embedded) {
      download();
      return;
    }
    const ta = document.createElement('textarea');
    ta.className = 'export-text';
    ta.readOnly = true;
    ta.value = json;
    const note = h('p', { class: 'export-note', text: '아래 기록을 전부 복사해서 대화창에 붙여 넣어 주세요.' });
    const copy = async () => {
      ta.select();
      try {
        await navigator.clipboard.writeText(json);
        note.textContent = '복사했어요. 대화창에 붙여 넣어 주세요.';
      } catch {
        try {
          document.execCommand('copy');
          note.textContent = '복사했어요. 대화창에 붙여 넣어 주세요.';
        } catch {
          note.textContent = '자동 복사가 막혀 있어요. 칸을 길게 눌러 전체 선택 후 복사해 주세요.';
        }
      }
    };
    this.overlay.show(
      h('div', { class: 'overlay' },
        h('div', { class: 'panel' },
          h('h2', { class: 'heading', text: '플레이 기록' }),
          note,
          ta,
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', onClick: () => void copy(), text: '복사' }),
            h('button', { class: 'btn', onClick: () => this.showTitle(), text: '닫기' }),
          ),
        ),
      ),
    );
  }
}
