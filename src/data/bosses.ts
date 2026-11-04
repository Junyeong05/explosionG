import type { EnemyDef } from './enemies';

export type BossId = 'proliferator';

/**
 * 보스 정의. 기획서 보스 3종 중 증식체만 구현.
 * TODO(프로토 v3): 방벽(보호막 드론 줄 세우기), 흡수체(근처 연쇄 폭발을 흡수해 회복)
 *   - 방벽: onSpawn 훅을 추가해 shielded 드론을 보스 앞에 배치
 *   - 흡수체: World.detonate 에서 반경 안 보스에게 onNearbyExplosion 훅 호출
 */
export const BOSSES: Record<BossId, EnemyDef> = {
  proliferator: {
    id: 'proliferator', name: '증식체', spawnWeight: 0,
    // ⚠ 보스 HP 배율·속도는 임시값. 기본 연쇄가 없어진 뒤 25 → 18 (챕터 1 봇 클리어율 약 90%)
    hpMul: 18, speed: 12, radius: 28, xp: 15, leak: 3,
    color: '#ff3cc8', shape: 'octagon', mark: 'thick',
    deathBlast: { radiusMul: 2.6, damageMul: 3 },
    boss: {
      title: '증식체',
      // 체력 25%마다 돌격형 3마리 소환
      onDamaged(api, self) {
        const thresholds = [0.75, 0.5, 0.25];
        while (self.phase < thresholds.length && self.hp / self.maxHp <= thresholds[self.phase]) {
          self.phase++;
          for (let i = 0; i < 3; i++) {
            api.spawnEnemy('rusher', self.x + api.rng.range(-36, 36), self.y + api.rng.range(-6, 18));
          }
          api.emit({ type: 'bossSummon', x: self.x, y: self.y });
        }
      },
    },
  },
};
