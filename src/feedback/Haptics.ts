import type { SimEvent } from '../sim/events';

/**
 * 진동. 기획서: 탭·보스 처치·전설(에픽/프리즘) 증강 획득에만.
 * 웹은 Android 크롬만 navigator.vibrate 지원. 앱 빌드에서는 Capacitor Haptics 로 교체.
 */
export class Haptics {
  enabled = true;

  consume(events: readonly SimEvent[]): void {
    if (!this.enabled) return;
    for (const e of events) {
      if (e.type === 'tap') this.vibrate(8);
      else if (e.type === 'bossKill') this.vibrate([30, 40, 60]);
      else if (e.type === 'augment' && (e.rarity === 'epic' || e.rarity === 'prism')) this.vibrate([20, 30, 20]);
    }
  }

  private vibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* 미지원 */
    }
  }
}
