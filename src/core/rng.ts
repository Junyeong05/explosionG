/**
 * 시드 기반 난수 (mulberry32).
 *
 * 같은 시드 + 같은 입력이면 같은 판이 나와야 한다.
 * 일일 도전(모두 같은 시드), 리플레이, 자동 플레이 검증이 전부 이 전제 위에 있다.
 * → sim/ 와 data/ 코드에서는 Math.random() 을 쓰지 않는다. (렌더·사운드 연출은 상관없음)
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** [0, maxExclusive) 정수 */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: 빈 배열');
    return items[this.int(items.length)];
  }

  /** 가중치 뽑기. 가중치 합이 0 이하이면 undefined */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of items) total += Math.max(0, weightOf(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of items) {
      r -= Math.max(0, weightOf(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  }

  /** 제자리 셔플 (Fisher–Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

/** FNV-1a 32bit 문자열 해시 */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 하나의 판 시드에서 용도별 스트림 시드를 만든다.
 * 스폰/전투/증강 스트림을 분리해두면, 예를 들어 연쇄가 한 번 더 터져도
 * 증강 선택지가 바뀌지 않는다 (일일 도전 공정성).
 */
export function deriveSeed(seed: number, label: string): number {
  return hashString(`${seed >>> 0}:${label}`);
}

/** 일일 도전 시드: 같은 날짜(UTC)면 모두 같은 시드 */
export function dailySeed(date: Date): number {
  const ymd = date.toISOString().slice(0, 10);
  return hashString(`daily:${ymd}`);
}
