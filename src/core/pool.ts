/**
 * 오브젝트 풀. 후반에는 폭발·파티클이 프레임당 수백 개씩 생겼다 사라지므로
 * new 를 반복하지 않고 재사용한다 (GC 스파이크 = 모바일 프레임 드랍).
 */
export class Pool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void = () => {},
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(create());
  }

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(item: T): void {
    this.reset(item);
    this.free.push(item);
  }

  get freeCount(): number {
    return this.free.length;
  }
}

/**
 * 고정 용량 링 버퍼형 풀: 상한을 넘으면 가장 오래된 것을 덮어쓴다.
 * 파티클·피해 숫자처럼 "넘치면 버려도 되는" 연출용.
 */
export class CappedList<T extends { alive: boolean }> {
  readonly items: T[] = [];
  private cursor = 0;

  constructor(
    readonly capacity: number,
    create: () => T,
  ) {
    for (let i = 0; i < capacity; i++) this.items.push(create());
  }

  /** 비어 있는 슬롯을 주고, 없으면 가장 오래된 슬롯을 재사용 */
  spawn(): T {
    for (let n = 0; n < this.capacity; n++) {
      const idx = (this.cursor + n) % this.capacity;
      const it = this.items[idx];
      if (!it.alive) {
        this.cursor = (idx + 1) % this.capacity;
        it.alive = true;
        return it;
      }
    }
    const it = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.capacity;
    it.alive = true;
    return it;
  }

  get aliveCount(): number {
    let n = 0;
    for (const it of this.items) if (it.alive) n++;
    return n;
  }
}
