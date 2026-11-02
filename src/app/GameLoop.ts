import { FIXED_DT } from '../data/balance';

/**
 * 고정 스텝 루프. sim 은 항상 FIXED_DT 로만 진행하고, 렌더는 화면 주사율대로.
 * timeScale 로 슬로모션·일시정지를 건다 (sim 은 슬로모션을 모른다 → 헤드리스 결과와 동일).
 */
export class GameLoop {
  timeScale = 1;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (realDt: number) => void,
    private readonly fixedDt = FIXED_DT,
    private readonly maxStepsPerFrame = 8,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.acc += realDt * this.timeScale;
    let n = 0;
    while (this.acc >= this.fixedDt && n < this.maxStepsPerFrame) {
      this.update(this.fixedDt);
      this.acc -= this.fixedDt;
      n++;
    }
    // 너무 밀리면 버린다 (저사양 기기에서 따라잡으려다 더 느려지는 것 방지)
    if (n === this.maxStepsPerFrame) this.acc = 0;
    this.render(realDt);
    this.raf = requestAnimationFrame(this.tick);
  };
}
