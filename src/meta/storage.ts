/** 저장소 추상화: 브라우저는 localStorage, 테스트·Node 는 메모리. 출시 시 Capacitor Preferences 로 교체 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}

export class LocalStore implements KeyValueStore {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // 사생활 보호 모드 등: 저장 실패해도 게임은 계속
    }
  }
}
