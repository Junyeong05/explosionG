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
   *   피해 = D × damageAt1 × 게이지^damageExp
   * 피해가 게이지보다 빨리 커져서(지수 > 1) 게이지 1%당 피해는 꽉 채울수록 크다 → 연타보다 모아 쏘기가 이득.
   * 반경도 게이지에 비례하니 넓이는 제곱으로 커진다.
   */
  tap: {
    /** ⚠ 탭 폭발 기준 반경 R */
    radius: 60,
    /** ⚠ 탭 폭발 기준 피해 D */
    damage: 14,
    /**
     * ⚠ 탭 폭발은 가장자리로 갈수록 약하다: 중심 100% → 가장자리 이 비율 (거리에 비례).
     * 원 안의 적이 다 한 방에 죽지 않게 하고, 무리 한가운데를 노릴 이유를 만든다.
     */
    edgeDamageMul: 0.5,
    gauge: {
      /** ⚠ 0 → 100% 까지 걸리는 시간 (초) */
      fillSec: 3,
      /** ⚠ 이보다 적으면 헛탭 */
      minFire: 0.15,
      /**
       * ⚠ 게이지 0%·100% 일 때 반경 배율 (100% 를 넘으면 같은 직선으로 계속 커짐).
       * 꽉 채워도 반경 60 (플레이 피드백: 초반부터 너무 컸다, 이전 84). 더 크게는 "폭발 반경" 증강으로.
       */
      radiusAt0: 0.4,
      radiusAt1: 1,
      /** ⚠ 게이지 100% 일 때 피해 배율과 지수 */
      damageAt1: 1.8,
      damageExp: 1.4,
    },
    /** 치명타 배율 (치명타 증강 획득 전에는 확률 0) */
    critMultiplier: 2,
  },

  chain: {
    /** 연쇄 폭발 반경 46 */
    radius: 46,
    /**
     * 이월 피해 (플레이 피드백으로 기획서의 "연쇄 피해 = D × 60%"를 대체):
     * 적이 죽을 때 체력을 넘긴 피해(넘친 피해) × carry 가 연쇄 폭발 피해가 된다.
     * 폭발형·보스는 여기에 자기 폭약(deathBlast.charge × D × 연쇄 배율)을 더한다.
     * 매 단계 체력만큼 깎이므로 연쇄는 저절로 약해지다 끊긴다. 크게 쏠수록 멀리 간다.
     */
    carry: 1,
    /** 연쇄 폭발 피해가 이보다 작으면 터지지 않는다 (연쇄 끝) */
    minDamage: 1,
    /** 연쇄 배율: 한 연쇄 안에서 처치 1회마다 이후 폭발형·보스의 자기 폭약 +5% (넘친 피해에는 안 곱함) */
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

  /**
   * 피해 배율 (곱연산). 판 안에서 쌓여 모든 피해에 곱해진다. HUD 에 ×1.32 처럼 보인다.
   * 덧셈 강화(고폭 화약 +10%)와 달리 곱으로 쌓여서 후반 체력 증가를 따라잡는 축.
   */
  mult: {
    /** ⚠ 중간 보스를 잡을 때마다 × */
    bossKill: 1.1,
    /** ⚠ 판 동안 쌓이는 배율(보스·연쇄 공명) 상한 */
    runMax: 4,
  },

  life: {
    start: 5,
    /** 일반 적 -1, 보스 -3 은 적 정의(leak)에 있음 */
  },

  wave: {
    /** 18초마다 웨이브 +1 */
    durationSec: 18,
    /**
     * ⚠ HP(w) = 13 × 1.22^(w-1). 기획서는 8 × 1.16^(w-1).
     * 시작값 13: 8 이면 꽉 채운 탭이 웨이브 7까지 원 안의 적을 전부 한 방에 잡아서 성장하는 맛이 없었다.
     * 증가율 1.22: 플레이 피드백(난이도 상승률을 높이자). 피해 배율(mult)로 따라잡는다.
     * 챕터별 배율은 chapters.ts 의 hpMul.
     */
    hpBase: 13,
    hpGrowth: 1.22,
    /**
     * ⚠ 무리 스폰: 적이 한 마리씩이 아니라 무리로 내려온다 (프로토 v2 는 한 마리씩, 간격 max(0.28, 1.1 - 0.07w)초).
     * 무리 간격(w) = max(min, base - perWave × w) 초, 무리 크기(w) = min(max, base + perWave × w) ± 1
     */
    packIntervalBase: 3,
    packIntervalPerWave: 0.1,
    packIntervalMin: 1.3,
    packSizeBase: 6,
    packSizePerWave: 0.6,
    packSizeMax: 18,
    /**
     * 무리 중심에서 구성원까지 최대 거리 (packSpreadRefSize 마리 기준). 더 큰 무리는 √(크기/기준) 배로 넓어져서
     * 구성원끼리 겹치지 않는다. 구성원 간격은 연쇄가 닿는 거리(46 + 적 반지름) 안쪽.
     */
    packSpread: 44,
    packSpreadRefSize: 5,
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

  /** 실험 규칙 수치 (sim/types.ts RULE_IDS). 전부 ⚠ 임시 */
  experiment: {
    overcharge: {
      /** 게이지 상한. 100% 에서 꾹 누르고 있으면 여기까지 차고, 떼면 그 크기로 쏜다 */
      max: 1.5,
      /** 100% 를 넘으면 차는 속도가 1 → 1 + accel 배로 점점 빨라진다 (마지막 구간일수록 순식간) */
      accel: 2,
      /** 상한에 닿으면 폭주: 게이지 0, 이 시간 동안 쏠 수 없음 */
      overheatSec: 1,
    },
    combo: {
      /** 마지막 처치 뒤 이 시간 안에 또 잡으면 콤보가 이어진다 (1초는 너무 안 끊겨서 0.6) */
      windowSec: 0.6,
      /** 콤보 처치 1마다 탭 피해·폭발형 자기 폭약 + (넘친 피해에는 안 곱함) */
      perKill: 0.03,
      maxMult: 3,
    },
    brink: {
      /** 방어선 위 이 거리 안에서 잡으면 벼랑 끝 처치 */
      zone: 120,
      /**
       * 벼랑 끝 처치 1마다 게이지 + (100% 까지만).
       * 봇 시험에서 6%·15%·25% 모두 "일부러 끌어내리는 욕심"이 손해였다 → 탈락 후보, 체감 확인용으로만 남김
       */
      refundPerKill: 0.25,
    },
  },

  /** 성능 상한. 넘치면 새로 만들지 않는다 (기획서: 후반 동시 폭발 수백 개) */
  limits: {
    /** ⚠ 화면 안 적 상한. 무리가 들어갈 자리가 없으면 다음 무리는 자리가 날 때까지 미룬다 (버리지 않음) */
    maxEnemies: 240,
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
