/**
 * 기본 수치. 기획서 v0.1 "인게임 코어 루프" 표의 프로토 v2 값을 옮겼다.
 * ⚠ 표시는 기획서에 값이 없어서 임시로 넣은 것 → 수치·밸런스 탭 값으로 교체할 것.
 *
 * 좌표계: 논리 해상도 360 × 640 (세로 9:16). 렌더러가 화면에 맞춰 확대한다.
 */

/** sim 고정 스텝 (초). 결정론을 위해 sim 은 항상 이 값으로만 진행한다. */
export const FIXED_DT = 1 / 60;

export const BALANCE = {
  field: {
    width: 360,
    height: 640,
    /** 적이 나타나는 y (화면 위 바깥) */
    spawnY: -20,
    /** 방어선 y. 적 중심이 이 선을 넘으면 LIFE 감소 */
    defenseLineY: 560,
  },

  tap: {
    /** 충전 3칸 */
    maxCharges: 3,
    /** 1.1초마다 1칸 회복 */
    rechargeSec: 1.1,
    /** ⚠ 탭 폭발 반경 R */
    radius: 60,
    /** ⚠ 탭 폭발 피해 D. 웨이브 1 적(HP 8)을 연쇄 피해(D×60%)로 잡을 수 있게 14로 둠 */
    damage: 14,
    /** 치명타 배율 (치명타 증강 획득 전에는 확률 0) */
    critMultiplier: 2,
  },

  chain: {
    /** 연쇄 폭발 반경 46 */
    radius: 46,
    /** 연쇄 피해 = D × 60% */
    damageRatio: 0.6,
    /** 연쇄 배율: 한 연쇄 안에서 처치 1회마다 이후 폭발 피해 +5% */
    multiplierPerKill: 0.05,
    /** ⚠ 처치 → 다음 폭발까지 지연. 0 이면 한 프레임에 다 터져서 "번지는" 느낌이 안 난다 */
    delaySec: 0.07,
  },

  life: {
    start: 5,
    /** 일반 적 -1, 보스 -3 은 적 정의(leak)에 있음 */
  },

  wave: {
    /** 18초마다 웨이브 +1 */
    durationSec: 18,
    /** HP(w) = 8 × 1.16^(w-1) */
    hpBase: 8,
    hpGrowth: 1.16,
    /** 등장 간격(w) = max(0.28, 1.1 - 0.07w) 초 */
    spawnIntervalBase: 1.1,
    spawnIntervalPerWave: 0.07,
    spawnIntervalMin: 0.28,
  },

  xp: {
    /** ⚠ 다음 레벨까지 필요 경험치 = base + perLevel × (레벨 - 1) */
    base: 6,
    perLevel: 8,
  },

  reward: {
    /** 판 종료 부품 = 웨이브 × 4 + 처치 / 6 */
    partsPerWave: 4,
    killsPerPart: 6,
  },

  augment: {
    offerCount: 3,
    /** 노말 : 레어 : 에픽 = 60 : 30 : 10. 프리즘은 보스 처치 보상에서만 */
    rarityWeights: { normal: 60, rare: 30, epic: 10 },
    /** 진화 조건을 갖추면 선택지에 75% 확률로 등장 */
    evolutionChance: 0.75,
    /** 프리즘은 판당 최대 1개 */
    maxPrismPerRun: 1,
    /** ⚠ 레벨업 선택창은 연쇄가 끝난 뒤 연다. 단, 이 시간 이상 기다리면 그냥 연다 */
    offerMaxWaitSec: 2,
  },

  prism: {
    supernova: {
      /** ⚠ 이 시간 동안 누르고 있으면 최대 충전 */
      fullChargeSec: 1.2,
      /** ⚠ 최대 충전 시 반경 +100%, 피해 +250% */
      radiusPerCharge: 1.0,
      damagePerCharge: 2.5,
      /** ⚠ 남은 충전 칸 1개당 반경 +12% (피해는 칸 수만큼 곱) */
      radiusPerExtraCharge: 0.12,
    },
    infiniteChain: {
      /** ⚠ 연쇄 중 무료 탭의 피해 배율 */
      freeTapDamageMul: 0.6,
    },
  },

  /** 성능 상한. 넘치면 새로 만들지 않는다 (기획서: 후반 동시 폭발 수백 개) */
  limits: {
    maxEnemies: 320,
    maxExplosions: 900,
    maxZones: 64,
    maxMines: 24,
  },

  fx: {
    /** 20연쇄 이상이면 0.3초 슬로모션 + 화면 가장자리 발광 */
    slowmoChain: 20,
    slowmoSec: 0.3,
    slowmoScale: 0.3,
  },
} as const;

export function enemyHp(wave: number): number {
  const w = BALANCE.wave;
  return w.hpBase * Math.pow(w.hpGrowth, wave - 1);
}

export function spawnInterval(wave: number): number {
  const w = BALANCE.wave;
  return Math.max(w.spawnIntervalMin, w.spawnIntervalBase - w.spawnIntervalPerWave * wave);
}

export function xpToNext(level: number): number {
  return BALANCE.xp.base + BALANCE.xp.perLevel * (level - 1);
}

export function runReward(wave: number, kills: number): number {
  const r = BALANCE.reward;
  return wave * r.partsPerWave + Math.floor(kills / r.killsPerPart);
}
