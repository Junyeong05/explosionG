/**
 * 균일 격자 공간 분할. 폭발 1개당 "반경 안의 적"을 찾을 때 전체 적을 훑지 않게 한다.
 * 후반 동시 폭발 수백 개 × 적 수백 마리 = O(n²) 를 피하기 위한 장치.
 * 매 스텝 rebuild 하고, 스텝 도중 생긴 적(분열체·소환)은 insert 한다.
 */
export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cells = new Map<number, T[]>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    // 음수 좌표(화면 위쪽 스폰 지점)도 들어오므로 오프셋을 둔다
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  clear(): void {
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(item);
  }

  /** (x, y) 반경 r 의 bbox 와 겹치는 칸의 항목을 out 에 담는다. 정확한 거리 판정은 호출자가 한다. */
  queryBox(x: number, y: number, r: number, out: T[]): T[] {
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs);
    const x1 = Math.floor((x + r) / cs);
    const y0 = Math.floor((y - r) / cs);
    const y1 = Math.floor((y + r) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (arr) for (const it of arr) out.push(it);
      }
    }
    return out;
  }
}
