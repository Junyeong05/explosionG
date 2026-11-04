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

  /**
   * 모으는 탭 (플레이 피드백으로 프로토 v2 의 "충전 3칸"을 대체).
   * 게이지 하나가 계속 차오르고, 탭하면 게이지를 전부 써서 터진다. 많이 모을수록 크게 터진다.
   *   반경 = R × (radiusAt0 + (radiusAt1 - radiusAt0) × 게이지)
   *   피해 = D × (damageAt0 + (damageAt1 - damageAt0) × 게이지)
   * 반경이 게이지에 비례하므로 넓이는 제곱으로 커진다 → 반만 모아 두 번 쏘는 것보다 꽉 채워 한 번이 무리에 유리.
   */
  tap: {
    /** ⚠ 탭 폭발 기준 반경 R */
    radius: 60,
    /** ⚠ 탭 폭발 기준 피해 D */
    damage: 14,
    gauge: {
      /** ⚠ 0 → 100% 까지 걸리는 시간 (초) */
      fillSec: 3,
      /** ⚠ 이보다 적으면 헛탭 */
      minFire: 0.15,
      /** ⚠ 게이지 0%·100% 일 때 반경·피해 배율 (100% 를 넘으면 같은 직선으로 계속 커짐) */
      radiusAt0: 0.45,
      radiusAt1: 1.4,
      damageAt0: 0.5,
      damageAt1: 1.8,
    },
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
    /**
     * ⚠ 연쇄 환급: 한 연쇄(탭 폭발 직접 처치 포함)에서 이 수만큼 처치할 때마다 게이지 +refundGauge.
     * 크게 모아 많이 잡은 탭이 다음 탭을 벌어온다.
     */
    refundEveryKills: 8,
    refundGauge: 0.25,
  },

  life: {
    start: 5,
    /** 일반 적 -1, 보스 -3 은 적 정의(leak)에 있음 */
  },

  wave: {
    /** 18초마다 웨이브 +1 */
    durationSec: 18,
    /** HP(w) = 8 × 1.16^(w-1) (기획서 공식). 챕터별 배율은 chapters.ts 의 hpMul */
    hpBase: 8,
    hpGrowth: 1.16,
    /**
     * ⚠ 무리 스폰: 적이 한 마리씩이 아니라 무리로 내려온다 (프로토 v2 는 한 마리씩, 간격 max(0.28, 1.1 - 0.07w)초).
     * 무리 간격(w) = max(min, base - perWave × w) 초, 무리 크기(w) = min(max, base + perWave × w) ± 1
     */
    packIntervalBase: 3.4,
    packIntervalPerWave: 0.12,
    packIntervalMin: 1.5,
    packSizeBase: 4,
    packSizePerWave: 0.45,
    packSizeMax: 12,
    /** 무리 중심에서 구성원까지 최대 거리. 연쇄가 닿는 거리(46 + 적 반지름) 안쪽이라 무리 하나는 한 번에 번진다 */
    packSpread: 44,
  },

  enemy: {
    /**
     * ⚠ 보스를 뺀 모든 적의 하강 속도 배율. enemies.ts 의 speed 는 프로토 v2 값 그대로 두고 여기서 줄인다.
     * 플레이 피드백: 적을 많이, 느리게 내려야 모였을 때 한 번에 터뜨리는 맛이 산다.
     */
    speedMul: 0.6,
  },

  xp: {
    /** ⚠ 다음 레벨까지 필요 경험치 = base + perLevel × (레벨 - 1). 적이 많아진 만큼 프로토 v2(6, 8)보다 높게 */
    base: 6,
    perLevel: 11,
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
      /** ⚠ 초신성(과충전): 게이지 상한 */
      gaugeMax: 2.5,
      /** ⚠ 100% 를 넘긴 뒤 차는 속도 배율 */
      overfillRate: 0.5,
    },
    infiniteChain: {
      /** ⚠ 연쇄 중 무료 탭은 게이지를 쓰지 않고 최소 이 크기로 터진다 */
      freeTapPower: 0.5,
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
    /** ⚠ 30연쇄 이상이면 0.3초 슬로모션 + 화면 가장자리 발광 (기획서 20. 무리 스폰 후 20연쇄가 판당 20번 넘게 나와서 올림) */
    slowmoChain: 30,
    slowmoSec: 0.3,
    slowmoScale: 0.3,
  },
} as const;

export function enemyHp(wave: number): number {
  const w = BALANCE.wave;
  return w.hpBase * Math.pow(w.hpGrowth, wave - 1);
}

export function packInterval(wave: number): number {
  const w = BALANCE.wave;
  return Math.max(w.packIntervalMin, w.packIntervalBase - w.packIntervalPerWave * wave);
}

/** 무리 크기의 기준값. 실제 크기는 여기에 ±1 (World 가 spawnRng 로 정함) */
export function packSize(wave: number): number {
  const w = BALANCE.wave;
  return Math.min(w.packSizeMax, Math.round(w.packSizeBase + w.packSizePerWave * wave));
}

export function xpToNext(level: number): number {
  return BALANCE.xp.base + BALANCE.xp.perLevel * (level - 1);
}

export function runReward(wave: number, kills: number): number {
  const r = BALANCE.reward;
  return wave * r.partsPerWave + Math.floor(kills / r.killsPerPart);
}
