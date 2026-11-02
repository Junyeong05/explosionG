import type { Command } from '../sim/types';

const EMPTY: readonly Command[] = Object.freeze([]);

/**
 * 포인터(터치·마우스) → sim Command.
 * 탭은 손가락이 닿는 순간(press) 터진다. 떼는 순간까지 기다리면 반응이 늦게 느껴진다.
 * 초신성처럼 누르고 떼기 조작은 sim 이 press/move/release 를 해석한다.
 */
export class PointerInput {
  private queue: Command[] = [];
  private primary: number | null = null;
  private pendingMove: { x: number; y: number } | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly toLogical: (clientX: number, clientY: number) => { x: number; y: number },
  ) {
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private readonly onDown = (e: PointerEvent): void => {
    e.preventDefault();
    const p = this.toLogical(e.clientX, e.clientY);
    this.queue.push({ t: 'press', x: p.x, y: p.y });
    if (this.primary === null) {
      this.primary = e.pointerId;
      try {
        this.el.setPointerCapture(e.pointerId);
      } catch {
        /* 일부 브라우저 */
      }
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.primary) return;
    this.pendingMove = this.toLogical(e.clientX, e.clientY);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.primary) return;
    this.flushMove();
    const p = this.toLogical(e.clientX, e.clientY);
    this.queue.push({ t: 'release', x: p.x, y: p.y });
    this.primary = null;
  };

  private flushMove(): void {
    if (!this.pendingMove) return;
    this.queue.push({ t: 'move', x: this.pendingMove.x, y: this.pendingMove.y });
    this.pendingMove = null;
  }

  /** UI(증강 카드 등)에서 sim 으로 보내는 명령도 같은 큐로 → 리플레이 기록 지점이 하나 */
  push(c: Command): void {
    this.queue.push(c);
  }

  drain(): readonly Command[] {
    this.flushMove();
    if (this.queue.length === 0) return EMPTY;
    const out = this.queue;
    this.queue = [];
    return out;
  }

  clear(): void {
    this.queue = [];
    this.pendingMove = null;
  }
}
