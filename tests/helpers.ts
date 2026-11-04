import { FIXED_DT } from '../src/data/balance';
import { NO_META, type MetaModifiers } from '../src/sim/stats';
import type { Command, RunConfig } from '../src/sim/types';
import { World } from '../src/sim/World';

/** 스폰이 꺼진 빈 판. 적을 직접 배치해서 규칙을 확인한다 */
export function sandbox(overrides: Partial<RunConfig> = {}, meta: Partial<MetaModifiers> = {}): World {
  return new World({
    seed: 1,
    mode: 'chapter',
    chapterId: 'ch1',
    meta: { ...NO_META, ...meta },
    sandbox: true,
    ...overrides,
  });
}

export function stepFor(w: World, seconds: number, commands: Command[] = []): void {
  const steps = Math.ceil(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) w.step(FIXED_DT, i === 0 ? commands : []);
}

export function tap(w: World, x: number, y: number): void {
  w.step(FIXED_DT, [{ t: 'press', x, y }, { t: 'release', x, y }]);
}

/** 증강을 얻은 것처럼 (선택창 흐름 없이) */
export function grant(w: World, id: string): void {
  w.augments.acquire(id, w);
  // World.recomputeStats 는 private 이라 선택 흐름을 그대로 탄다
  (w as unknown as { recomputeStats(): void }).recomputeStats();
}

/** 적이 움직이지 않게 (위치 고정 테스트용) */
export function freeze(w: World): void {
  for (const e of w.enemies) e.speed = 0;
}
