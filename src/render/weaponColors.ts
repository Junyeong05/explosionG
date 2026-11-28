import { ARMS } from '../data/chaos';
import type { Chaos } from '../sim/chaos';

/**
 * 무기마다 고유 색 (11-28 유저: "합성이 돼도 똑같아서 어떤 건지 구분이 전혀 안 된다. 무기마다 main source 가 되는 색깔을 하나씩,
 * 얻을 때마다. 합성되면 메인인 애가 가진 색만 유지. 그 무기에서 생성된 애들도 그 톤을 띄게").
 *
 * 그리기 쪽에서만 정한다 (판 규칙 · 난수와 무관). 얻은 순서대로 팔레트에서 아직 안 쓴 색을 하나씩.
 * 합치면 안에 든 무기의 색은 풀려서 다음에 얻는 무기가 쓰고, 그 몸이 낸 것(안에 든 무기의 반응까지)은 모두 몸(뿌리)의 색.
 * 어두운 바탕 · 적 색(빨강 · 주황 · 노랑 · 파랑 · 청록 · 보라)과 나란히 놓여도 서로 갈리게, 앞에서부터 가장 멀리 떨어진 순서.
 */
export const WEAPON_PALETTE = [
  '#3ce0ff', // 하늘
  '#ffd23e', // 금
  '#7dff4d', // 연두
  '#c58cff', // 보라
  '#ff8a3c', // 주황
  '#ff6ad5', // 자홍
  '#3effb0', // 민트
  '#6f9bff', // 파랑
  '#e8ff5a', // 노랑연두
  '#ffb08a', // 살구
  '#2fc9b5', // 청록
  '#f0f4ff', // 흰
] as const;

export class WeaponColors {
  /** 몸(뿌리) → 색 */
  private readonly col = new Map<string, string>();
  /** 가진 무기 → 그 몸(뿌리). 매 프레임 update 에서 */
  private readonly root = new Map<string, string>();

  reset(): void {
    this.col.clear();
    this.root.clear();
  }

  /** 가진 무기를 보고 색을 맞춘다 (매 프레임 한 번) */
  update(c: Chaos): void {
    this.root.clear();
    const roots: string[] = [];
    for (const id of c.owned()) {
      if (ARMS[id]?.cat === 'passive') continue;
      const r = c.rootOf(id);
      this.root.set(id, r);
      if (r === id) roots.push(id);
    }
    // 몸이 아니게 된 무기(합쳐져 안에 든 무기 · 사라진 무기)의 색은 푼다
    for (const id of [...this.col.keys()]) if (!roots.includes(id)) this.col.delete(id);
    const used = new Set(this.col.values());
    for (const id of roots) {
      if (this.col.has(id)) continue;
      const free = WEAPON_PALETTE.find((p) => !used.has(p)) ?? WEAPON_PALETTE[this.col.size % WEAPON_PALETTE.length];
      this.col.set(id, free);
      used.add(free);
    }
  }

  /** 이 무기(또는 그 무기가 든 몸)의 색. 모르는 무기면 null */
  of(id: string | undefined | null): string | null {
    if (!id) return null;
    return this.col.get(this.root.get(id) ?? id) ?? null;
  }
}
