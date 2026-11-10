/**
 * 연출 미리보기 런타임: 실제 게임 규칙(src/sim)과 그리기(src/render)를 카드마다 하나씩 돌린다.
 * 페이지 정의(pages/*.ts)가 mount(page) 를 부르면 DOM 을 만들고, 보이는 카드만 돌린다.
 * 빌드: node tools/showcase/build.mjs <페이지 이름> → docs/showcase/<이름>.html (한 파일, 외부 의존 없음)
 */
import { BALANCE, FIXED_DT } from '../../src/data/balance';
import { ARMS } from '../../src/data/chaos';
import { Renderer } from '../../src/render/Renderer';
import { NO_META } from '../../src/sim/stats';
import type { Command } from '../../src/sim/types';
import { World } from '../../src/sim/World';
import type { InputPattern } from '../../src/data/combineV2';
import { InputDriver } from '../carry/input';

export interface Scene {
  /** 카드 제목 (이모지 포함) */
  title: string;
  /** 제목 옆 꼬리표 */
  tag?: string;
  /** 처음부터 들고 있는 무기 id 와 레벨 */
  weapons: string[];
  level?: number;
  /** 어떻게 싸우나 (한두 문장) */
  desc: string;
  /** 앞줄 적을 자동으로 탭 (손공격) */
  taps?: boolean;
  /** 몇 초마다 처음부터 (기본 18) */
  seconds?: number;
  /** 적: 화면에 늘 이만큼 살아 있게 (기본 14), 체력 배율 (기본 3). 위쪽 절반에서 바로 나타난다 (빨리 보려고) */
  keep?: number;
  hpMul?: number;
  /** 카드를 한 줄 전체로 */
  wide?: boolean;
  /** 합성: [나르는 무기, 실을 무기] 순서대로 싣는다 (Chaos.attach) */
  attach?: [string, string][];
  /** 설명 아래 작은 줄들 (특이점 등) */
  extra?: string[];
  /** 카드 맨 아래 작은 고정폭 글씨 (알려 줄 때 쓰는 이름, 예: gun>summon) */
  code?: string;
  /** 합성 v2: [A, B] 순서대로 B 를 A 안에 합친다 (Chaos.fuse) */
  fuse?: [string, string][];
  /** 손 입력을 이 모양으로 자동으로 누른다 (taps 대신) */
  input?: InputPattern;
}

export interface Section {
  id: string;
  title: string;
  lead?: string;
  /** 카드 앞에 놓는 표 (첫 줄이 머리) */
  table?: string[][];
  /** 카드 앞에 놓는 목록 */
  list?: string[];
  /** 카드를 작게 (한 줄에 더 많이) */
  compact?: boolean;
  /** 표·목록 대신 직접 그리는 칸 (도감 등) */
  render?: (host: HTMLElement) => void;
  scenes: Scene[];
}

export interface Page {
  /** 페이지 이름 (탭·앱 목록에 보이는 짧은 이름, 2~4 낱말) */
  name: string;
  /** 맨 위 제목 */
  title: string;
  lead: string;
  notes?: string[];
  sections: Section[];
}

const FW = BALANCE.field.width;
let speed = 1;
/** 합성 v2: 이 페이지의 카드들이 지금까지 해낸 짝 (갈래 A>B) — 도감이 읽는다 */
export const discovered = new Set<string>();

/** 레벨 업·시작 무기 고르기 창은 건너뛴다 (카드는 정해진 무기만 보여 준다) */
function skipOffers(w: World): void {
  const a = w as unknown as { offerQueue: unknown[]; offer: unknown; phase: string };
  a.offerQueue.length = 0;
  if (a.phase === 'choosing') {
    a.offer = null;
    a.phase = 'playing';
  }
}

class Stage {
  private w: World | null = null;
  private r: Renderer | null = null;
  private t = 0;
  private spawnT = 0;
  private tapT = 0;
  private acc = 0;
  private runs = 0;
  private leaks = 0;
  private drv: InputDriver | null = null;
  visible = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: Scene,
    private readonly stat: HTMLElement,
  ) {}

  /** 보일 때 처음 만들고, 안 보이면 놓는다 (카드가 수백 장이어도 보이는 것만 메모리를 쓴다) */
  show(on: boolean): void {
    this.visible = on;
    if (on && !this.r) {
      const cv = this.canvas;
      this.r = new Renderer(cv, () => ({ w: cv.clientWidth || 300, h: cv.clientHeight || 533 }));
      this.reset();
    } else if (!on && this.r) {
      this.r = null;
      this.w = null;
      this.canvas.width = 1;
      this.canvas.height = 1;
    }
  }

  reset(): void {
    if (!this.r) return;
    this.runs++;
    const w = new World({ seed: 11 + this.runs, mode: 'chapter', chapterId: 'ch1', meta: NO_META, sandbox: true, rules: { chaos: true }, recordEvents: true });
    skipOffers(w);
    for (const id of this.scene.weapons) {
      if (!ARMS[id]) throw new Error(`무기 없음: ${id}`);
      for (let i = 0; i < (this.scene.level ?? 3); i++) w.augments.acquire(id, w);
    }
    for (const [a, b] of this.scene.attach ?? []) if (!w.chaos!.attach(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
    for (const [a, b] of this.scene.fuse ?? []) if (!w.chaos!.fuse(a, b)) throw new Error(`못 합침: ${a} > ${b}`);
    this.drv = this.scene.input ? new InputDriver(this.scene.input) : null;
    this.w = w;
    this.r.reset();
    this.t = 0;
    this.spawnT = 0;
    this.tapT = 1;
    this.leaks = 0;
  }

  resize(): void {
    this.r?.resize();
  }

  private stepOnce(): void {
    const w = this.w!;
    const sc = this.scene;
    const cmds: Command[] = [];
    // 살아 있는 적이 keep 보다 적으면 위쪽 절반 아무 데서나 하나씩 (초당 최대 8마리)
    this.spawnT -= FIXED_DT;
    if (this.spawnT <= 0) {
      let alive = 0;
      for (const e of w.enemies) if (!e.dead) alive++;
      if (alive < (sc.keep ?? 14)) {
        this.spawnT = 1 / 8;
        const roll = w.rng.next();
        const kind = roll < 0.7 ? 'normal' : roll < 0.85 ? 'armored' : 'rusher';
        w.spawnEnemy(kind, w.rng.range(30, FW - 30), w.rng.range(90, BALANCE.field.height * 0.52), sc.hpMul ?? 3);
      }
    }
    if (this.drv) cmds.push(...this.drv.step(w, FIXED_DT));
    else if (sc.taps) {
      this.tapT -= FIXED_DT;
      if (this.tapT <= 0) {
        this.tapT = 0.45;
        let best: { x: number; y: number } | null = null;
        for (const e of w.enemies) if (!e.dead && e.y > 60 && (!best || e.y > best.y)) best = e;
        if (best) cmds.push({ t: 'press', x: best.x, y: best.y }, { t: 'release', x: best.x, y: best.y });
      }
    }
    skipOffers(w);
    w.step(FIXED_DT, cmds);
    skipOffers(w);
    const evs = w.drainEvents();
    for (const e of evs) if (e.type === 'leak') this.leaks++;
    if (evs.length) this.r!.consume(evs);
    // 판이 끝나지 않게 (놓친 수만 센다)
    (w as unknown as { life: number }).life = w.stats.maxLife;
    this.t += FIXED_DT;
    if (this.t >= (sc.seconds ?? 18)) this.reset();
  }

  frame(realDt: number): void {
    if (!this.visible || !this.r || !this.w) return;
    this.acc += realDt * speed;
    let n = 0;
    while (this.acc >= FIXED_DT && n < 6) {
      this.stepOnce();
      this.acc -= FIXED_DT;
      n++;
    }
    if (n === 6) this.acc = 0;
    this.r.draw(this.w, realDt * speed);
    const left = Math.max(0, (this.scene.seconds ?? 18) - this.t);
    let opens = 0;
    if (this.scene.attach) for (const n of this.w.chaos!.opened.values()) opens += n;
    let fired = 0;
    if (this.scene.fuse) {
      for (const [k, n] of this.w.chaos!.fusion.fired) {
        fired += n;
        const [a, b] = k.split('>');
        if (n > 0 && ARMS[a] && ARMS[b]) discovered.add(`${ARMS[a].cat}>${ARMS[b].cat}`);
      }
    }
    const pre = this.scene.attach ? `열림 ${opens} · ` : this.scene.fuse ? `합성 ${fired} · ` : '';
    this.stat.textContent = `${pre}처치 ${this.w.kills} · 놓침 ${this.leaks} · 다시 시작까지 ${left.toFixed(0)}초`;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function mount(page: Page): void {
  const main = document.querySelector('main')!;
  main.append(el('h1', '', page.title), el('p', 'lead', page.lead));
  for (const n of page.notes ?? []) main.append(el('p', 'note', n));

  const top = el('div', 'top');
  const nav = el('nav');
  for (const s of page.sections) {
    const a = el('a', '', s.title);
    a.href = `#${s.id}`;
    nav.append(a);
  }
  const sp = el('div');
  sp.id = 'speed';
  sp.append(el('span', '', '속도'));
  // 움직임 줄이기 설정이면 멈춘 채로 시작 (버튼으로 재생)
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) speed = 0;
  for (const s of [1, 0.5, 0.25, 0]) {
    const b = el('button', '', s === 0 ? '멈춤' : `${s}×`);
    b.setAttribute('aria-pressed', String(s === speed));
    b.onclick = () => {
      speed = s;
      for (const x of sp.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    };
    sp.append(b);
  }
  top.append(nav, sp);
  main.append(top);

  const stages: Stage[] = [];
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      const st = (en.target as HTMLElement & { stage?: Stage }).stage;
      if (st) st.show(en.isIntersecting);
    }
  }, { rootMargin: '120px' });

  for (const sec of page.sections) {
    const h = el('h2', '', sec.title);
    h.id = sec.id;
    main.append(h);
    if (sec.lead) main.append(el('p', 'lead', sec.lead));
    if (sec.table) {
      const wrap = el('div', 'tablewrap');
      const tb = el('table');
      sec.table.forEach((row, i) => {
        const tr = el('tr');
        for (const c of row) tr.append(el(i === 0 ? 'th' : 'td', '', c));
        tb.append(tr);
      });
      wrap.append(tb);
      main.append(wrap);
    }
    if (sec.render) {
      const host = el('div');
      main.append(host);
      sec.render(host);
    }
    if (sec.list) {
      const ul = el('ul', 'list');
      for (const li of sec.list) ul.append(el('li', '', li));
      main.append(ul);
    }
    if (sec.scenes.length === 0) continue;
    const grid = el('div', sec.compact ? 'grid compact' : 'grid');
    main.append(grid);
    for (const sc of sec.scenes) {
      const card = el('div', sc.wide ? 'card wide' : 'card');
      const cv = el('canvas');
      cv.title = '눌러서 처음부터';
      const stat = el('div', 'stat');
      const h4 = el('h4', '', sc.title);
      if (sc.tag) h4.append(' ', el('span', 'tag', sc.tag));
      const names = sc.weapons.map((id) => ARMS[id].name).join(' · ');
      card.append(cv, stat, h4, el('p', 'weap', `무기 (${sc.level ?? 3}레벨): ${names}`), el('p', '', sc.desc));
      for (const x of sc.extra ?? []) card.append(el('p', 'extra', x));
      if (sc.code) card.append(el('p', 'code', sc.code));
      grid.append(card);
      const st = new Stage(cv, sc, stat);
      (cv as HTMLCanvasElement & { stage?: Stage }).stage = st;
      cv.onclick = () => st.reset();
      io.observe(cv);
      new ResizeObserver(() => st.resize()).observe(cv);
      stages.push(st);
    }
  }

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    for (const s of stages) s.frame(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
