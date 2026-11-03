import { BALANCE } from '../data/balance';
import type { SimEvent } from '../sim/events';

/**
 * BALANCE.fx.slowmoChain 연쇄 이상이면 0.3초 슬로모션 (연쇄 하나당 한 번).
 * 루프의 timeScale 만 바꾼다 → sim 결과는 슬로모션 유무와 무관.
 */
export class SlowMo {
  onTrigger: ((chainKills: number) => void) | null = null;
  private remaining = 0;
  private readonly fired = new Set<number>();

  consume(events: readonly SimEvent[]): void {
    const F = BALANCE.fx;
    for (const e of events) {
      if (e.type === 'explosion' && e.chainKills >= F.slowmoChain && !this.fired.has(e.chainId)) {
        this.fired.add(e.chainId);
        this.remaining = F.slowmoSec;
        this.onTrigger?.(e.chainKills);
      } else if (e.type === 'chainEnd') {
        this.fired.delete(e.chainId);
      }
    }
  }

  /** 실제 시간 기준으로 줄어든다 */
  update(realDt: number): number {
    if (this.remaining <= 0) return 1;
    this.remaining -= realDt;
    return BALANCE.fx.slowmoScale;
  }

  reset(): void {
    this.remaining = 0;
    this.fired.clear();
  }
}
